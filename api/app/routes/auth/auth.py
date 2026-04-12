from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime, timedelta, timezone
import uuid
import secrets

from app.database import get_session
from app.models import (
    User,
    Organization,
    OrganizationMember,
    OrganizationInvite,
    UserRole,
    InviteStatus,
    AccountType,
)
from app.schemas import (
    OrganizationCreate,
    OrganizationResponse,
    OrganizationTokenResponse,
    OrganizationLoginRequest,
    UserResponse,
    SwitchOrganizationRequest,
    InviteCreate,
    InviteResponse,
    AcceptInvite,
    OrganizationMemberResponse,
    MemberRoleUpdate,
    OrganizationUpdate,
    PersonalRegisterRequest,
    PersonalRegisterResponse,
    GuestLoginResponse,
)
from app.services.guest import create_guest_session
from app.services.email import send_invite_email
from app.auth import (
    get_password_hash,
    verify_password,
    create_access_token,
    get_current_user,
    get_org_context,
    get_owner_or_admin_context,
    get_user_organizations,
    check_org_membership,
    OrgContext,
)

import logging

from app.utils.pii import redact_email, hash_email

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["Authentication"])

# Organization Registration & Login


@router.post("/register-organization", response_model=OrganizationTokenResponse)
async def register_organization(
    org_data: OrganizationCreate, db: Session = Depends(get_session)
):
    """
    Register a new organization with an owner account.
    This creates both the organization and the first owner user.
    """
    # Validate slug format (alphanumeric and hyphens only)
    if not org_data.slug.replace("-", "").isalnum():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Organization slug must contain only alphanumeric characters and hyphens",
        )

    # Check if organization slug already exists
    existing_org = (
        db.query(Organization).filter(Organization.slug == org_data.slug).first()
    )
    if existing_org:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Organization slug already taken",
        )

    # Check if user email already exists
    existing_user = db.query(User).filter(User.email == org_data.admin_email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered"
        )

    # Create organization
    new_org = Organization(
        id=str(uuid.uuid4()),
        name=org_data.name,
        slug=org_data.slug,
        contact_email=org_data.contact_email,
        is_active=True,
    )
    db.add(new_org)
    db.flush()  # Get the org ID

    # Create owner user
    hashed_password = get_password_hash(org_data.admin_password)
    new_user = User(
        id=str(uuid.uuid4()),
        name=org_data.admin_name,
        email=org_data.admin_email,
        auth_provider="local",
        auth_subject=hashed_password,
        is_active=True,
    )
    db.add(new_user)
    db.flush()  # Get the user ID

    # Create organization membership (owner role)
    membership = OrganizationMember(
        id=str(uuid.uuid4()),
        organization_id=new_org.id,
        user_id=new_user.id,
        role=UserRole.owner,
        invited_by=None,  # First owner is not invited
    )
    db.add(membership)

    db.commit()
    db.refresh(new_org)
    db.refresh(new_user)

    logger.info(
        f"[OK] Created organization {new_org.name} ({new_org.slug}) with owner {redact_email(new_user.email)} ({hash_email(new_user.email)})"
    )

    # Create access token
    access_token = create_access_token(
        user_id=new_user.id,
        email=new_user.email,
        organization_id=new_org.id,
        role=UserRole.owner,
    )

    return OrganizationTokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse.model_validate(new_user),
        organization=OrganizationResponse.model_validate(new_org),
        role=UserRole.owner,
        available_organizations=[OrganizationResponse.model_validate(new_org)],
    )


@router.post("/login", response_model=OrganizationTokenResponse)
async def login_user(
    credentials: OrganizationLoginRequest, db: Session = Depends(get_session)
):
    """
    Login with email/password and organization context.
    If user is in multiple organizations and no organization_id is provided,
    returns list of available organizations.
    """
    logger.info(f"[AUTH] Login attempt for {hash_email(credentials.email)}")

    # Find user by email
    user = (
        db.query(User).filter(User.email == credentials.email, User.is_active).first()
    )
    if not user:
        logger.warning(f"[WARN] User not found: {hash_email(credentials.email)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password"
        )

    logger.info(
        f"[OK] User found: {hash_email(credentials.email)}, verifying password..."
    )

    # Verify password
    if not verify_password(credentials.password, user.auth_subject):
        logger.warning(
            f"[WARN] Password verification failed for: {hash_email(credentials.email)}"
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password"
        )

    logger.info(f"[OK] Password verified for: {hash_email(credentials.email)}")

    # Get user's organizations
    user_orgs = get_user_organizations(user.id, db)

    if not user_orgs:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User is not a member of any organization. Please accept an invite or create an organization.",
        )

    # If user provided organization_id, validate it
    if credentials.organization_id:
        selected_org = None
        selected_role = None
        for org, role in user_orgs:
            if org.id == credentials.organization_id:
                selected_org = org
                selected_role = role
                break

        if not selected_org:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User is not a member of the specified organization",
            )
    else:
        # Default to first organization
        selected_org, selected_role = user_orgs[0]

    logger.info(
        f"[OK] User {redact_email(user.email)} ({hash_email(user.email)}) logging into org {selected_org.name} with role {selected_role.value}"
    )

    # Create access token
    access_token = create_access_token(
        user_id=user.id,
        email=user.email,
        organization_id=selected_org.id,
        role=selected_role,
        account_type=selected_org.account_type,
    )

    return OrganizationTokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse.model_validate(user),
        organization=OrganizationResponse.model_validate(selected_org),
        role=selected_role,
        available_organizations=[
            OrganizationResponse.model_validate(org) for org, _ in user_orgs
        ],
    )


@router.get("/me", response_model=dict)
async def get_current_user_info(org_context: OrgContext = Depends(get_org_context)):
    """Get current user info including organization context."""
    return {
        "user": UserResponse.model_validate(org_context.user),
        "organization": OrganizationResponse.model_validate(org_context.organization),
        "role": org_context.role,
    }


@router.get("/organizations", response_model=list[OrganizationResponse])
async def list_user_organizations(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_session)
):
    """List all organizations the current user is a member of."""
    user_orgs = get_user_organizations(current_user.id, db)
    return [OrganizationResponse.model_validate(org) for org, _ in user_orgs]


@router.post("/switch-organization", response_model=OrganizationTokenResponse)
async def switch_organization(
    switch_request: SwitchOrganizationRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
):
    """
    Switch to a different organization (for users who are members of multiple orgs).
    Returns a new JWT token with the new organization context.
    """
    # Check if user is a member of the target organization
    role = check_org_membership(current_user.id, switch_request.organization_id, db)
    if not role:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User is not a member of the specified organization",
        )

    # Get organization
    organization = (
        db.query(Organization)
        .filter(
            Organization.id == switch_request.organization_id,
            Organization.is_active,
        )
        .first()
    )
    if not organization:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found or inactive",
        )

    # Create new access token
    access_token = create_access_token(
        user_id=current_user.id,
        email=current_user.email,
        organization_id=organization.id,
        role=role,
    )

    # Get all user organizations
    user_orgs = get_user_organizations(current_user.id, db)

    return OrganizationTokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse.model_validate(current_user),
        organization=OrganizationResponse.model_validate(organization),
        role=role,
        available_organizations=[
            OrganizationResponse.model_validate(org) for org, _ in user_orgs
        ],
    )


# Organization Management


@router.get("/organization/details", response_model=OrganizationResponse)
async def get_organization_details(org_context: OrgContext = Depends(get_org_context)):
    """Get current organization details."""
    return OrganizationResponse.model_validate(org_context.organization)


@router.put("/organization/details", response_model=OrganizationResponse)
async def update_organization_details(
    updates: OrganizationUpdate,
    org_context: OrgContext = Depends(get_owner_or_admin_context),
    db: Session = Depends(get_session),
):
    """Update organization details (owner/admin only)."""
    org = org_context.organization

    if updates.name is not None:
        org.name = updates.name
    if updates.contact_email is not None:
        org.contact_email = updates.contact_email

    org.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(org)

    return OrganizationResponse.model_validate(org)


# Team Management (Invites & Members)


@router.post("/invite-user", response_model=InviteResponse)
async def invite_user_to_organization(
    invite_data: InviteCreate,
    org_context: OrgContext = Depends(get_owner_or_admin_context),
    db: Session = Depends(get_session),
):
    """
    Invite a user to join the organization (owner/admin only).
    Sends an invite token that can be used to accept the invite.
    """
    # Check if user already exists and is a member
    existing_user = db.query(User).filter(User.email == invite_data.email).first()
    if existing_user:
        existing_membership = (
            db.query(OrganizationMember)
            .filter(
                OrganizationMember.user_id == existing_user.id,
                OrganizationMember.organization_id == org_context.organization_id,
            )
            .first()
        )
        if existing_membership:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User is already a member of this organization",
            )

    # Check if there's already a pending invite
    existing_invite = (
        db.query(OrganizationInvite)
        .filter(
            OrganizationInvite.organization_id == org_context.organization_id,
            OrganizationInvite.email == invite_data.email,
            OrganizationInvite.status == InviteStatus.pending,
        )
        .first()
    )
    if existing_invite:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="There is already a pending invite for this email",
        )

    # Create invite
    invite_token = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)  # 7 days expiry

    new_invite = OrganizationInvite(
        id=str(uuid.uuid4()),
        organization_id=org_context.organization_id,
        email=invite_data.email,
        role=invite_data.role,
        invited_by=org_context.user_id,
        status=InviteStatus.pending,
        invite_token=invite_token,
        expires_at=expires_at,
    )
    db.add(new_invite)
    db.commit()
    db.refresh(new_invite)

    # Send invite email (fire-and-forget — don't fail the request if email fails)
    try:
        await send_invite_email(
            to_email=invite_data.email,
            org_name=org_context.organization.name,
            inviter_name=org_context.user.name or org_context.user.email,
            invite_token=invite_token,
        )
    except Exception:
        logger.exception("Failed to send invite email, continuing anyway")

    return InviteResponse.model_validate(new_invite)


@router.post("/accept-invite", response_model=OrganizationTokenResponse)
async def accept_organization_invite(
    accept_data: AcceptInvite, db: Session = Depends(get_session)
):
    """
    Accept an organization invite using the invite token.
    If user doesn't exist, creates a new user account.
    """
    # Find invite
    invite = (
        db.query(OrganizationInvite)
        .filter(OrganizationInvite.invite_token == accept_data.invite_token)
        .first()
    )

    if not invite:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Invalid invite token"
        )

    # Check invite status
    if invite.status != InviteStatus.pending:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invite has already been {invite.status.value}",
        )

    # Check expiration
    if datetime.now(timezone.utc) > invite.expires_at:
        invite.status = InviteStatus.expired
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Invite has expired"
        )

    # Get organization
    organization = (
        db.query(Organization).filter(Organization.id == invite.organization_id).first()
    )
    if not organization or not organization.is_active:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found or inactive",
        )

    # Check if user exists
    user = db.query(User).filter(User.email == invite.email).first()
    if user:
        # Existing user accepting invite
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="User account is inactive"
            )
    else:
        # Create new user
        hashed_password = get_password_hash(accept_data.password)
        user = User(
            id=str(uuid.uuid4()),
            name=accept_data.name,
            email=invite.email,
            auth_provider="local",
            auth_subject=hashed_password,
            is_active=True,
        )
        db.add(user)
        db.flush()

    # Create membership
    membership = OrganizationMember(
        id=str(uuid.uuid4()),
        organization_id=organization.id,
        user_id=user.id,
        role=invite.role,
        invited_by=invite.invited_by,
    )
    db.add(membership)

    # Update invite status
    invite.status = InviteStatus.accepted
    invite.accepted_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(user)

    # Create access token
    access_token = create_access_token(
        user_id=user.id,
        email=user.email,
        organization_id=organization.id,
        role=invite.role,
    )

    # Get all user organizations
    user_orgs = get_user_organizations(user.id, db)

    return OrganizationTokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse.model_validate(user),
        organization=OrganizationResponse.model_validate(organization),
        role=invite.role,
        available_organizations=[
            OrganizationResponse.model_validate(org) for org, _ in user_orgs
        ],
    )


@router.get("/invites", response_model=list[InviteResponse])
async def list_organization_invites(
    org_context: OrgContext = Depends(get_owner_or_admin_context),
    db: Session = Depends(get_session),
):
    """List all invites for the current organization (owner/admin only)."""
    invites = (
        db.query(OrganizationInvite)
        .filter(OrganizationInvite.organization_id == org_context.organization_id)
        .order_by(OrganizationInvite.created_at.desc())
        .all()
    )

    return [InviteResponse.model_validate(invite) for invite in invites]


@router.delete("/invites/{invite_id}")
async def revoke_invite(
    invite_id: str,
    org_context: OrgContext = Depends(get_owner_or_admin_context),
    db: Session = Depends(get_session),
):
    """Revoke a pending invite (owner/admin only)."""
    invite = (
        db.query(OrganizationInvite)
        .filter(
            OrganizationInvite.id == invite_id,
            OrganizationInvite.organization_id == org_context.organization_id,
        )
        .first()
    )

    if not invite:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Invite not found"
        )

    if invite.status != InviteStatus.pending:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Can only revoke pending invites",
        )

    invite.status = InviteStatus.revoked
    db.commit()

    return {"message": "Invite revoked successfully"}


@router.get("/members", response_model=list[OrganizationMemberResponse])
async def list_organization_members(
    org_context: OrgContext = Depends(get_org_context),
    db: Session = Depends(get_session),
):
    """List all members of the current organization."""
    members = (
        db.query(OrganizationMember, User)
        .join(User, OrganizationMember.user_id == User.id)
        .filter(OrganizationMember.organization_id == org_context.organization_id)
        .all()
    )

    return [
        OrganizationMemberResponse(
            id=member.id,
            organization_id=member.organization_id,
            user_id=member.user_id,
            role=member.role,
            user_name=user.name,
            user_email=user.email,
            joined_at=member.joined_at,
        )
        for member, user in members
    ]


@router.put("/members/{member_id}/role", response_model=OrganizationMemberResponse)
async def update_member_role(
    member_id: str,
    role_update: MemberRoleUpdate,
    org_context: OrgContext = Depends(get_owner_or_admin_context),
    db: Session = Depends(get_session),
):
    """Update a member's role (owner/admin only)."""
    member = (
        db.query(OrganizationMember)
        .filter(
            OrganizationMember.id == member_id,
            OrganizationMember.organization_id == org_context.organization_id,
        )
        .first()
    )

    if not member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Member not found"
        )

    # Cannot change your own role
    if member.user_id == org_context.user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot change your own role",
        )

    member.role = role_update.role
    member.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(member)

    # Get user info
    user = db.query(User).filter(User.id == member.user_id).first()

    return OrganizationMemberResponse(
        id=member.id,
        organization_id=member.organization_id,
        user_id=member.user_id,
        role=member.role,
        user_name=user.name,
        user_email=user.email,
        joined_at=member.joined_at,
    )


@router.delete("/members/{member_id}")
async def remove_member(
    member_id: str,
    org_context: OrgContext = Depends(get_owner_or_admin_context),
    db: Session = Depends(get_session),
):
    """Remove a member from the organization (owner/admin only)."""
    member = (
        db.query(OrganizationMember)
        .filter(
            OrganizationMember.id == member_id,
            OrganizationMember.organization_id == org_context.organization_id,
        )
        .first()
    )

    if not member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Member not found"
        )

    # Cannot remove yourself
    if member.user_id == org_context.user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot remove yourself. Transfer ownership first.",
        )

    # Check if this is the last owner
    if member.role == UserRole.owner:
        owner_count = (
            db.query(OrganizationMember)
            .filter(
                OrganizationMember.organization_id == org_context.organization_id,
                OrganizationMember.role == UserRole.owner,
            )
            .count()
        )
        if owner_count <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot remove the last owner. Promote another member to owner first.",
            )

    db.delete(member)
    db.commit()

    return {"message": "Member removed successfully"}


# Guest & Personal Authentication


@router.post("/guest-login", response_model=GuestLoginResponse)
async def guest_login(db: Session = Depends(get_session)):
    """Create a temporary guest session with a sandbox organization."""
    result = create_guest_session(db)
    return GuestLoginResponse(
        user_id=result["user_id"],
        email=result["email"],
        organization_id=result["organization_id"],
        access_token=result["access_token"],
        expires_at=result["expires_at"],
    )


@router.post("/register-personal", response_model=PersonalRegisterResponse)
async def register_personal(
    data: PersonalRegisterRequest, db: Session = Depends(get_session)
):
    """
    Register a personal workspace account.
    Creates a user, a personal organization, and links them.
    """
    # Check if email already exists
    existing_user = db.query(User).filter(User.email == data.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )

    slug = f"personal-{str(uuid.uuid4())[:8]}"

    # Create personal organization
    org = Organization(
        id=str(uuid.uuid4()),
        name=f"{data.full_name}'s Workspace",
        slug=slug,
        contact_email=data.email,
        account_type=AccountType.PERSONAL.value,
        is_active=True,
    )
    db.add(org)
    db.flush()

    # Create user
    user = User(
        id=str(uuid.uuid4()),
        name=data.full_name,
        email=data.email,
        auth_provider="local",
        auth_subject=get_password_hash(data.password),
        is_active=True,
    )
    db.add(user)
    db.flush()

    # Create membership
    member = OrganizationMember(
        id=str(uuid.uuid4()),
        user_id=user.id,
        organization_id=org.id,
        role=UserRole.owner,
    )
    db.add(member)
    db.flush()

    # Create access token
    access_token = create_access_token(
        user_id=user.id,
        email=user.email,
        organization_id=org.id,
        role=UserRole.owner,
        account_type=AccountType.PERSONAL.value,
    )

    logger.info(
        f"Registered personal account for {redact_email(user.email)} ({hash_email(user.email)})"
    )

    return PersonalRegisterResponse(
        user_id=user.id,
        email=user.email,
        organization_id=org.id,
        access_token=access_token,
    )
