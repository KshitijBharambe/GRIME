import uuid
import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.models import (
    User,
    Organization,
    OrganizationMember,
    GuestUsage,
    AccountType,
    UserRole,
)
from app.auth import create_access_token, get_password_hash
from app.utils.pii import redact_email, hash_email
from app.core.config import (
    GUEST_SESSION_TTL_HOURS,
    GUEST_UPLOAD_LIMIT,
    GUEST_EXECUTION_LIMIT,
    GUEST_MAX_FILE_SIZE_BYTES,
)

logger = logging.getLogger(__name__)


def create_guest_session(db: Session) -> dict:
    """Create a temporary guest user with a sandbox organization.

    Returns dict with user_id, email, organization_id, access_token, expires_at.
    """
    guest_id = str(uuid.uuid4())
    short_id = guest_id[:8]
    guest_email = f"guest-{short_id}@example.com"
    expires_at = datetime.now(timezone.utc) + timedelta(hours=GUEST_SESSION_TTL_HOURS)

    # Create guest organization (sandbox)
    org = Organization(
        id=str(uuid.uuid4()),
        name=f"Guest Sandbox {short_id}",
        slug=f"guest-{short_id}",
        contact_email=guest_email,
        account_type=AccountType.GUEST.value,
        is_active=True,
    )
    db.add(org)
    db.flush()

    # Create guest user with random unusable password
    user = User(
        id=str(uuid.uuid4()),
        name=f"Guest {short_id}",
        email=guest_email,
        auth_provider="local",
        auth_subject=get_password_hash(str(uuid.uuid4())),
        is_active=True,
        is_guest=True,
        guest_expires_at=expires_at,
    )
    db.add(user)
    db.flush()

    # Create membership
    member = OrganizationMember(
        id=str(uuid.uuid4()),
        user_id=user.id,
        organization_id=org.id,
        role=UserRole.admin,
    )
    db.add(member)

    # Create usage tracker
    usage = GuestUsage(
        id=str(uuid.uuid4()),
        user_id=user.id,
        organization_id=org.id,
    )
    db.add(usage)

    db.flush()

    # Create token
    token = create_access_token(
        user_id=user.id,
        email=user.email,
        organization_id=org.id,
        role=UserRole.admin,
        account_type=AccountType.GUEST.value,
    )

    logger.info(
        f"Created guest session for {redact_email(user.email)} ({hash_email(user.email)}) in org {org.slug}"
    )

    return {
        "user_id": user.id,
        "email": user.email,
        "organization_id": org.id,
        "access_token": token,
        "expires_at": expires_at.isoformat(),
    }
