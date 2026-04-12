from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Dict, Any
from datetime import datetime, timezone
import uuid

from app.database import get_session
from app.models import AccessRequest
from app.auth import OrgContext, get_any_org_member_context, get_owner_or_admin_context

router = APIRouter(prefix="/access-requests", tags=["Access Requests"])


def _serialize(req: AccessRequest) -> Dict[str, Any]:
    return {
        "id": req.id,
        "organization_id": req.organization_id,
        "request_type": req.request_type,
        "status": req.status,
        "requester_id": req.requester_id,
        "requester_name": req.requester.name if req.requester else "",
        "requester_email": req.requester.email if req.requester else "",
        "required_approver_role": req.required_approver_role,
        "approver_id": req.approver_id,
        "approver_name": req.approver.name if req.approver else None,
        "request_data": req.request_data,
        "reason": req.reason,
        "admin_notes": req.admin_notes,
        "created_at": req.created_at.isoformat() if req.created_at else None,
        "updated_at": req.updated_at.isoformat() if req.updated_at else None,
        "expires_at": req.expires_at.isoformat() if req.expires_at else None,
        "approved_at": req.approved_at.isoformat() if req.approved_at else None,
        "rejected_at": req.rejected_at.isoformat() if req.rejected_at else None,
    }


@router.get("", response_model=List[Dict[str, Any]])
async def get_my_requests(
    db: Session = Depends(get_session),
    org_context: OrgContext = Depends(get_any_org_member_context),
):
    """Get all access requests submitted by the current user in this org."""
    reqs = db.query(AccessRequest).filter(
        AccessRequest.organization_id == org_context.organization_id,
        AccessRequest.requester_id == org_context.user.id,
    ).order_by(AccessRequest.created_at.desc()).all()
    return [_serialize(r) for r in reqs]


@router.get("/pending", response_model=List[Dict[str, Any]])
async def get_pending_approvals(
    db: Session = Depends(get_session),
    org_context: OrgContext = Depends(get_owner_or_admin_context),
):
    """Get all pending requests awaiting approval (admin/owner only)."""
    reqs = db.query(AccessRequest).filter(
        AccessRequest.organization_id == org_context.organization_id,
        AccessRequest.status == "pending",
    ).order_by(AccessRequest.created_at.desc()).all()
    return [_serialize(r) for r in reqs]


@router.post("", response_model=Dict[str, Any], status_code=status.HTTP_201_CREATED)
async def create_request(
    data: Dict[str, Any],
    db: Session = Depends(get_session),
    org_context: OrgContext = Depends(get_any_org_member_context),
):
    """Create a new access request."""
    request_type = data.get("request_type", "")
    if not request_type:
        raise HTTPException(status_code=400, detail="request_type is required")

    # Password change not allowed for personal accounts
    if request_type == "password_change" and org_context.is_personal:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Password change requests are not available for personal accounts. Use the password reset flow instead.",
        )

    req = AccessRequest(
        id=str(uuid.uuid4()),
        organization_id=org_context.organization_id,
        request_type=request_type,
        status="pending",
        requester_id=org_context.user.id,
        required_approver_role=data.get("required_approver_role", "admin"),
        request_data=data.get("request_data"),
        reason=data.get("reason"),
    )
    db.add(req)
    db.commit()
    db.refresh(req)
    return _serialize(req)


@router.post("/password-change", response_model=Dict[str, Any], status_code=status.HTTP_201_CREATED)
async def request_password_change(
    data: Dict[str, Any],
    db: Session = Depends(get_session),
    org_context: OrgContext = Depends(get_any_org_member_context),
):
    """Submit a password change request (org accounts only)."""
    if org_context.is_personal:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Password change requests are not available for personal accounts.",
        )

    req = AccessRequest(
        id=str(uuid.uuid4()),
        organization_id=org_context.organization_id,
        request_type="password_change",
        status="pending",
        requester_id=org_context.user.id,
        required_approver_role="admin",
        reason=data.get("reason"),
    )
    db.add(req)
    db.commit()
    db.refresh(req)
    return _serialize(req)


@router.put("/{request_id}/approve", response_model=Dict[str, Any])
async def approve_request(
    request_id: str,
    data: Dict[str, Any],
    db: Session = Depends(get_session),
    org_context: OrgContext = Depends(get_owner_or_admin_context),
):
    req = db.query(AccessRequest).filter(
        AccessRequest.id == request_id,
        AccessRequest.organization_id == org_context.organization_id,
    ).first()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    if req.status != "pending":
        raise HTTPException(status_code=400, detail=f"Request is already {req.status}")

    req.status = "approved"
    req.approver_id = org_context.user.id
    req.admin_notes = data.get("admin_notes")
    req.approved_at = datetime.now(timezone.utc)
    req.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(req)
    return _serialize(req)


@router.put("/{request_id}/reject", response_model=Dict[str, Any])
async def reject_request(
    request_id: str,
    data: Dict[str, Any],
    db: Session = Depends(get_session),
    org_context: OrgContext = Depends(get_owner_or_admin_context),
):
    req = db.query(AccessRequest).filter(
        AccessRequest.id == request_id,
        AccessRequest.organization_id == org_context.organization_id,
    ).first()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    if req.status != "pending":
        raise HTTPException(status_code=400, detail=f"Request is already {req.status}")

    req.status = "rejected"
    req.approver_id = org_context.user.id
    req.admin_notes = data.get("admin_notes")
    req.rejected_at = datetime.now(timezone.utc)
    req.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(req)
    return _serialize(req)


@router.delete("/{request_id}", status_code=status.HTTP_204_NO_CONTENT)
async def cancel_request(
    request_id: str,
    db: Session = Depends(get_session),
    org_context: OrgContext = Depends(get_any_org_member_context),
):
    req = db.query(AccessRequest).filter(
        AccessRequest.id == request_id,
        AccessRequest.organization_id == org_context.organization_id,
        AccessRequest.requester_id == org_context.user.id,
    ).first()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    if req.status != "pending":
        raise HTTPException(status_code=400, detail="Only pending requests can be cancelled")

    req.status = "cancelled"
    req.updated_at = datetime.now(timezone.utc)
    db.commit()
