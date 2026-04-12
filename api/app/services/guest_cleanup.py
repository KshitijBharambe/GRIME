"""Background task to clean up expired guest sessions."""

import asyncio
import logging
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models import User, Organization, OrganizationMember, GuestUsage, AccountType
from app.core.config import GUEST_CLEANUP_INTERVAL_SECONDS

logger = logging.getLogger(__name__)


def cleanup_expired_guests(db: Session) -> int:
    """Delete expired guest users and their sandbox organizations.

    Returns number of cleaned up sessions.
    """
    now = datetime.now(timezone.utc)

    expired_users = (
        db.query(User)
        .filter(
            User.is_guest == True,
            User.guest_expires_at != None,
            User.guest_expires_at < now,
        )
        .all()
    )

    if not expired_users:
        return 0

    count = 0
    for user in expired_users:
        try:
            # Delete usage tracking
            db.query(GuestUsage).filter(GuestUsage.user_id == user.id).delete()

            # Get guest org IDs before deleting memberships
            org_ids = [
                m.organization_id
                for m in db.query(OrganizationMember)
                .filter(OrganizationMember.user_id == user.id)
                .all()
            ]

            # Delete memberships
            db.query(OrganizationMember).filter(
                OrganizationMember.user_id == user.id
            ).delete()

            # Delete user
            db.delete(user)

            # Delete guest orgs (only if account_type is GUEST)
            for org_id in org_ids:
                org = (
                    db.query(Organization)
                    .filter(
                        Organization.id == org_id,
                        Organization.account_type == AccountType.GUEST,
                    )
                    .first()
                )
                if org:
                    db.delete(org)

            count += 1
        except Exception:
            logger.exception(f"Failed to clean up guest user {user.id}")
            db.rollback()
            continue

    db.commit()
    logger.info(f"Cleaned up {count} expired guest sessions")
    return count


async def guest_cleanup_loop(session_factory):
    """Background loop that runs cleanup every 15 minutes.

    Args:
        session_factory: Callable that returns a new DB session (e.g. SessionLocal).
    """
    while True:
        try:
            await asyncio.sleep(GUEST_CLEANUP_INTERVAL_SECONDS)
            db = session_factory()
            try:
                cleaned = cleanup_expired_guests(db)
                if cleaned > 0:
                    logger.info(f"Guest cleanup: removed {cleaned} expired sessions")
            finally:
                db.close()
        except asyncio.CancelledError:
            logger.info("Guest cleanup task cancelled")
            break
        except Exception:
            logger.exception("Error in guest cleanup loop")
