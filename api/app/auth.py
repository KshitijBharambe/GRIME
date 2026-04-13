import logging
import warnings
from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple
from fastapi import HTTPException, status, Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from passlib.context import CryptContext
from jose import JWTError, jwt
import os
from sqlalchemy.orm import Session
from app.models import User, UserRole, Organization, OrganizationMember, AccountType
from app.database import get_session
from app.utils.pii import redact_email, hash_email, redact_token

logger = logging.getLogger(__name__)

_GUEST_ALLOWED_MUTATION_PATHS = {
    "/data/upload/file",
    "/data/upload/json",
}
_MUTATING_HTTP_METHODS = {"POST", "PUT", "PATCH", "DELETE"}

SECRET_KEY = os.getenv("JWT_SECRET_KEY")
if not SECRET_KEY:
    raise RuntimeError("JWT_SECRET_KEY environment variable must be set")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))

security = HTTPBearer()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def create_access_token(
    user_id: str,
    email: str,
    organization_id: str,
    role: UserRole,
    expires_delta: Optional[timedelta] = None,
    account_type: Optional[AccountType] = None,
) -> str:
    """
    Create a JWT access token with organization context.

    Args:
        user_id: User's unique identifier
        email: User's email address
        organization_id: Organization the user is accessing
        role: User's role within the organization
        expires_delta: Optional expiration time delta
        account_type: Optional account type (personal, organization, guest)

    Returns:
        Encoded JWT token string
    """
    to_encode = {
        "sub": user_id,
        "email": email,
        "organization_id": organization_id,
        "role": role.value if isinstance(role, UserRole) else role,
    }
    if account_type is not None:
        to_encode["account_type"] = (
            account_type.value
            if isinstance(account_type, AccountType)
            else account_type
        )

    # For demo purposes, don't set expiration if ACCESS_TOKEN_EXPIRE_MINUTES is None
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
        to_encode.update({"exp": expire})
    elif ACCESS_TOKEN_EXPIRE_MINUTES is not None:
        expire = datetime.now(timezone.utc) + timedelta(
            minutes=ACCESS_TOKEN_EXPIRE_MINUTES
        )
        to_encode.update({"exp": expire})

    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def verify_token(token: str) -> Optional[dict]:
    """Decode and verify JWT token."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        return None


class OrgContext:
    """Container for organization context extracted from JWT."""

    def __init__(
        self,
        user: User,
        organization: Organization,
        role: UserRole,
        account_type: AccountType = AccountType.ORGANIZATION,
    ):
        self.user = user
        self.organization = organization
        self.role = role
        self.account_type = account_type

    @property
    def user_id(self) -> str:
        return self.user.id

    @property
    def organization_id(self) -> str:
        return self.organization.id

    @property
    def is_owner(self) -> bool:
        return self.role == UserRole.owner

    @property
    def is_admin(self) -> bool:
        return self.role == UserRole.admin

    @property
    def is_owner_or_admin(self) -> bool:
        return self.role in [UserRole.owner, UserRole.admin]

    @property
    def is_personal(self) -> bool:
        return self.account_type == AccountType.PERSONAL

    @property
    def is_guest(self) -> bool:
        return self.account_type == AccountType.GUEST


def _is_guest_expired(user: User, now: Optional[datetime] = None) -> bool:
    if not user.is_guest:
        return False

    if user.guest_expires_at is None:
        return True

    current_time = now or datetime.now(timezone.utc)
    return user.guest_expires_at <= current_time


def _enforce_guest_request_policy(org_context: OrgContext, request: Request) -> None:
    if not org_context.is_guest:
        return

    method = request.method.upper()
    path = request.url.path

    if method in _MUTATING_HTTP_METHODS and path not in _GUEST_ALLOWED_MUTATION_PATHS:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Guest accounts cannot perform this mutation. Sign up to unlock full write access.",
        )


def get_org_context(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_session),
) -> OrgContext:
    """
    Extract and validate organization context from JWT token.
    This is the primary authentication dependency for all org-aware endpoints.

    Returns:
        OrgContext with user, organization, and role information

    Raises:
        HTTPException: If token is invalid or user/org not found
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    token = credentials.credentials
    logger.info(f"[AUTH] Verifying token: {redact_token(token)}")

    # Decode token
    payload = verify_token(token)
    if payload is None:
        logger.warning("[WARN] Token verification failed")
        raise credentials_exception

    # Extract claims
    user_id: str = payload.get("sub")
    organization_id: str = payload.get("organization_id")
    role_str: str = payload.get("role")
    account_type_str: Optional[str] = payload.get("account_type")

    if not user_id or not organization_id or not role_str:
        logger.warning("[WARN] Missing required claims in token payload")
        raise credentials_exception

    logger.info(
        f"[OK] Token verified for user_id: {user_id}, org: {organization_id}, role: {role_str}"
    )

    # Validate user exists
    user = db.query(User).filter(User.id == user_id, User.is_active).first()
    if user is None:
        logger.warning(f"[WARN] User not found or inactive: {user_id}")
        raise credentials_exception

    if _is_guest_expired(user):
        logger.info("[AUTH] Guest session expired for user_id=%s", user_id)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Guest session has expired. Please start a new guest session.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Validate organization exists
    organization = (
        db.query(Organization)
        .filter(Organization.id == organization_id, Organization.is_active)
        .first()
    )
    if organization is None:
        logger.warning(f"[WARN] Organization not found or inactive: {organization_id}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found or inactive",
        )

    # Validate membership
    membership = (
        db.query(OrganizationMember)
        .filter(
            OrganizationMember.user_id == user_id,
            OrganizationMember.organization_id == organization_id,
        )
        .first()
    )

    if membership is None:
        logger.warning(
            f"[WARN] User {user_id} is not a member of organization {organization_id}"
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User is not a member of this organization",
        )

    # Parse role
    try:
        role = UserRole(role_str)
    except ValueError:
        logger.warning(f"[WARN] Invalid role in token: {role_str}")
        raise credentials_exception

    # Verify role matches membership
    if membership.role != role:
        logger.warning(
            f"[WARN] Role mismatch: token has {role_str}, membership has {membership.role.value}"
        )
        raise credentials_exception

    # Use authoritative DB account classification when available.
    if user.is_guest or organization.account_type == AccountType.GUEST:
        account_type = AccountType.GUEST
    else:
        account_type = organization.account_type
        if isinstance(account_type, str):
            try:
                account_type = AccountType(account_type)
            except ValueError:
                logger.warning(
                    "[WARN] Invalid organization account_type in DB: %s",
                    organization.account_type,
                )
                account_type = AccountType.ORGANIZATION

        if account_type_str:
            try:
                AccountType(account_type_str)
            except ValueError:
                logger.warning(
                    f"[WARN] Invalid account_type in token: {account_type_str}"
                )
                raise credentials_exception

    logger.info(
        f"[OK] User authenticated: {redact_email(user.email)} ({hash_email(user.email)}) in org {organization.name} as {role.value} (account_type={account_type.value})"
    )

    org_context = OrgContext(
        user=user, organization=organization, role=role, account_type=account_type
    )

    _enforce_guest_request_policy(org_context, request)

    return org_context


def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_session),
) -> User:
    """
    .. deprecated::
        Use :func:`get_org_context` for new organization-aware endpoints.
        This legacy function only returns the User and discards organization context.
    """
    warnings.warn(
        "get_current_user() is deprecated. Use get_org_context() instead for "
        "organization-aware endpoints.",
        DeprecationWarning,
        stacklevel=2,
    )
    org_context = get_org_context(request, credentials, db)
    return org_context.user


def require_role(allowed_roles: list[UserRole]):
    """
    Create a dependency that requires the user to have one of the specified roles
    within their organization context.

    Args:
        allowed_roles: List of UserRole enums that are permitted

    Returns:
        Dependency function that validates role and returns OrgContext
    """

    def role_checker(org_context: OrgContext = Depends(get_org_context)) -> OrgContext:
        logger.info(
            f"[AUTH] Checking role: user={redact_email(org_context.user.email)} ({hash_email(org_context.user.email)}), "
            f"org={org_context.organization.name}, "
            f"role={org_context.role.value}, "
            f"allowed={[r.value for r in allowed_roles]}"
        )

        if org_context.role not in allowed_roles:
            logger.warning(
                f"[WARN] Access denied: user role {org_context.role.value} not in "
                f"{[r.value for r in allowed_roles]}"
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Insufficient permissions. Required roles: {[r.value for r in allowed_roles]}",
            )

        logger.info(
            f"[OK] Access granted for {redact_email(org_context.user.email)} ({hash_email(org_context.user.email)}) in {org_context.organization.name}"
        )
        return org_context

    return role_checker


# Role-specific dependencies for organization context


def get_owner_context(
    org_context: OrgContext = Depends(require_role([UserRole.owner])),
) -> OrgContext:
    """Require owner role within organization."""
    return org_context


def get_owner_or_admin_context(
    org_context: OrgContext = Depends(require_role([UserRole.owner, UserRole.admin]))
) -> OrgContext:
    """Require owner or admin role within organization."""
    return org_context


def get_owner_admin_or_analyst_context(
    org_context: OrgContext = Depends(
        require_role([UserRole.owner, UserRole.admin, UserRole.analyst])
    )
) -> OrgContext:
    """Require owner, admin, or analyst role within organization."""
    return org_context


def get_any_org_member_context(
    org_context: OrgContext = Depends(get_org_context),
) -> OrgContext:
    """Require any authenticated user within an organization."""
    return org_context


# Legacy compatibility dependencies (deprecated - use OrgContext versions above)


def get_admin_user(current_user: User = Depends(get_current_user)) -> User:
    """
    .. deprecated::
        Use :func:`get_owner_or_admin_context` instead.
        This legacy function does not enforce admin role checks and lacks organization context.
    """
    warnings.warn(
        "get_admin_user() is deprecated. Use get_owner_or_admin_context() instead, "
        "which properly enforces role-based access within an organization.",
        DeprecationWarning,
        stacklevel=2,
    )
    return current_user


def get_admin_or_analyst_user(current_user: User = Depends(get_current_user)) -> User:
    """
    .. deprecated::
        Use :func:`get_owner_admin_or_analyst_context` instead.
        This legacy function does not enforce role checks and lacks organization context.
    """
    warnings.warn(
        "get_admin_or_analyst_user() is deprecated. Use "
        "get_owner_admin_or_analyst_context() instead, which properly enforces "
        "role-based access within an organization.",
        DeprecationWarning,
        stacklevel=2,
    )
    return current_user


def get_any_authenticated_user(current_user: User = Depends(get_current_user)) -> User:
    """
    .. deprecated::
        Use :func:`get_any_org_member_context` instead.
        This legacy function lacks organization context needed by org-aware endpoints.
    """
    warnings.warn(
        "get_any_authenticated_user() is deprecated. Use "
        "get_any_org_member_context() instead, which provides full organization context.",
        DeprecationWarning,
        stacklevel=2,
    )
    return current_user


# Helper functions for organization membership


def get_user_organizations(
    user_id: str, db: Session
) -> list[Tuple[Organization, UserRole]]:
    """
    Get all organizations a user is a member of along with their roles.

    Args:
        user_id: User's unique identifier
        db: Database session

    Returns:
        List of (Organization, UserRole) tuples
    """
    memberships = (
        db.query(OrganizationMember, Organization)
        .join(Organization, OrganizationMember.organization_id == Organization.id)
        .filter(OrganizationMember.user_id == user_id, Organization.is_active)
        .all()
    )

    return [(org, membership.role) for membership, org in memberships]


def check_org_membership(
    user_id: str, organization_id: str, db: Session
) -> Optional[UserRole]:
    """
    Check if a user is a member of an organization and return their role.

    Args:
        user_id: User's unique identifier
        organization_id: Organization's unique identifier
        db: Database session

    Returns:
        UserRole if user is a member, None otherwise
    """
    membership = (
        db.query(OrganizationMember)
        .filter(
            OrganizationMember.user_id == user_id,
            OrganizationMember.organization_id == organization_id,
        )
        .first()
    )

    return membership.role if membership else None
