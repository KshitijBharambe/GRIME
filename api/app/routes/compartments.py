from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
import uuid

from app.database import get_session
from app.models import Compartment, CompartmentMember, User, UserRole
from app.auth import (
    OrgContext,
    get_any_org_member_context,
    get_owner_or_admin_context,
)

router = APIRouter(prefix="/compartments", tags=["Compartments"])


def _serialize_compartment(c: Compartment, include_children: bool = True) -> Dict[str, Any]:
    data: Dict[str, Any] = {
        "id": c.id,
        "name": c.name,
        "description": c.description,
        "organization_id": c.organization_id,
        "parent_compartment_id": c.parent_compartment_id,
        "path": c.path,
        "created_at": c.created_at.isoformat() if c.created_at else None,
        "updated_at": c.updated_at.isoformat() if c.updated_at else None,
        "created_by": c.created_by,
        "is_active": c.is_active,
    }
    if include_children:
        data["children"] = [_serialize_compartment(child) for child in c.children if child.is_active]
    return data


def _serialize_member(m: CompartmentMember) -> Dict[str, Any]:
    return {
        "id": m.id,
        "compartment_id": m.compartment_id,
        "user_id": m.user_id,
        "user_name": m.user.name if m.user else "",
        "user_email": m.user.email if m.user else "",
        "role": m.role.value if isinstance(m.role, UserRole) else m.role,
        "inherit_from_parent": m.inherit_from_parent,
        "added_at": m.added_at.isoformat() if m.added_at else None,
        "added_by": m.added_by,
        "is_active": m.is_active,
    }


@router.get("", response_model=List[Dict[str, Any]])
async def list_compartments(
    db: Session = Depends(get_session),
    org_context: OrgContext = Depends(get_any_org_member_context),
):
    """List all root compartments (with nested children) for the current organization."""
    roots = (
        db.query(Compartment)
        .filter(
            Compartment.organization_id == org_context.organization_id,
            Compartment.parent_compartment_id == None,  # noqa: E711
            Compartment.is_active == True,  # noqa: E712
        )
        .all()
    )
    return [_serialize_compartment(c) for c in roots]


@router.get("/{compartment_id}", response_model=Dict[str, Any])
async def get_compartment(
    compartment_id: str,
    db: Session = Depends(get_session),
    org_context: OrgContext = Depends(get_any_org_member_context),
):
    c = db.query(Compartment).filter(
        Compartment.id == compartment_id,
        Compartment.organization_id == org_context.organization_id,
    ).first()
    if not c:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Compartment not found")
    return _serialize_compartment(c)


@router.post("", response_model=Dict[str, Any], status_code=status.HTTP_201_CREATED)
async def create_compartment(
    data: Dict[str, Any],
    db: Session = Depends(get_session),
    org_context: OrgContext = Depends(get_owner_or_admin_context),
):
    name = data.get("name", "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Name is required")

    parent_id: Optional[str] = data.get("parent_compartment_id")
    parent_path = ""
    if parent_id:
        parent = db.query(Compartment).filter(
            Compartment.id == parent_id,
            Compartment.organization_id == org_context.organization_id,
        ).first()
        if not parent:
            raise HTTPException(status_code=404, detail="Parent compartment not found")
        parent_path = parent.path

    path = f"{parent_path}/{name.lower().replace(' ', '-')}"

    compartment = Compartment(
        id=str(uuid.uuid4()),
        name=name,
        description=data.get("description"),
        organization_id=org_context.organization_id,
        parent_compartment_id=parent_id,
        path=path,
        created_by=org_context.user.id,
        is_active=True,
    )
    db.add(compartment)
    db.commit()
    db.refresh(compartment)
    return _serialize_compartment(compartment)


@router.put("/{compartment_id}", response_model=Dict[str, Any])
async def update_compartment(
    compartment_id: str,
    data: Dict[str, Any],
    db: Session = Depends(get_session),
    org_context: OrgContext = Depends(get_owner_or_admin_context),
):
    c = db.query(Compartment).filter(
        Compartment.id == compartment_id,
        Compartment.organization_id == org_context.organization_id,
    ).first()
    if not c:
        raise HTTPException(status_code=404, detail="Compartment not found")

    if "name" in data and data["name"]:
        c.name = data["name"].strip()
    if "description" in data:
        c.description = data.get("description")
    c.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(c)
    return _serialize_compartment(c)


@router.delete("/{compartment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_compartment(
    compartment_id: str,
    db: Session = Depends(get_session),
    org_context: OrgContext = Depends(get_owner_or_admin_context),
):
    c = db.query(Compartment).filter(
        Compartment.id == compartment_id,
        Compartment.organization_id == org_context.organization_id,
    ).first()
    if not c:
        raise HTTPException(status_code=404, detail="Compartment not found")
    c.is_active = False
    c.updated_at = datetime.now(timezone.utc)
    db.commit()


@router.get("/{compartment_id}/members", response_model=List[Dict[str, Any]])
async def list_members(
    compartment_id: str,
    db: Session = Depends(get_session),
    org_context: OrgContext = Depends(get_any_org_member_context),
):
    c = db.query(Compartment).filter(
        Compartment.id == compartment_id,
        Compartment.organization_id == org_context.organization_id,
    ).first()
    if not c:
        raise HTTPException(status_code=404, detail="Compartment not found")

    members = db.query(CompartmentMember).filter(
        CompartmentMember.compartment_id == compartment_id,
        CompartmentMember.is_active == True,  # noqa: E712
    ).all()
    return [_serialize_member(m) for m in members]


@router.post("/{compartment_id}/members", response_model=Dict[str, Any], status_code=status.HTTP_201_CREATED)
async def add_member(
    compartment_id: str,
    data: Dict[str, Any],
    db: Session = Depends(get_session),
    org_context: OrgContext = Depends(get_owner_or_admin_context),
):
    c = db.query(Compartment).filter(
        Compartment.id == compartment_id,
        Compartment.organization_id == org_context.organization_id,
    ).first()
    if not c:
        raise HTTPException(status_code=404, detail="Compartment not found")

    user_email = data.get("user_email", "").strip()
    if not user_email:
        raise HTTPException(status_code=400, detail="user_email is required")

    # Verify user is registered
    target_user = db.query(User).filter(User.email == user_email, User.is_active == True).first()  # noqa: E712
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with email '{user_email}' is not registered on this platform",
        )

    # Check not already a member
    existing = db.query(CompartmentMember).filter(
        CompartmentMember.compartment_id == compartment_id,
        CompartmentMember.user_id == target_user.id,
        CompartmentMember.is_active == True,  # noqa: E712
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="User is already a member of this compartment")

    role_str = data.get("role", "analyst")
    try:
        role = UserRole(role_str)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid role: {role_str}")

    member = CompartmentMember(
        id=str(uuid.uuid4()),
        compartment_id=compartment_id,
        user_id=target_user.id,
        role=role,
        inherit_from_parent=data.get("inherit_from_parent", True),
        added_by=org_context.user.id,
        is_active=True,
    )
    db.add(member)
    db.commit()
    db.refresh(member)
    return _serialize_member(member)


@router.delete("/{compartment_id}/members/{member_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_member(
    compartment_id: str,
    member_id: str,
    db: Session = Depends(get_session),
    org_context: OrgContext = Depends(get_owner_or_admin_context),
):
    member = db.query(CompartmentMember).filter(
        CompartmentMember.id == member_id,
        CompartmentMember.compartment_id == compartment_id,
    ).first()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    member.is_active = False
    db.commit()
