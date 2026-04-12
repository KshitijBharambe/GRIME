"""Guest rate limiting dependencies."""

import logging

from fastapi import HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.auth import OrgContext
from app.models import GuestUsage
from app.core.config import (
    GUEST_UPLOAD_LIMIT,
    GUEST_EXECUTION_LIMIT,
    GUEST_MAX_FILE_SIZE_BYTES,
)

logger = logging.getLogger(__name__)


def check_guest_upload_limit(org_context: OrgContext, db: Session):
    """Check if guest has exceeded upload limit. Use as dependency on upload routes."""
    if not org_context.is_guest:
        return

    usage = (
        db.query(GuestUsage)
        .filter(GuestUsage.organization_id == org_context.organization_id)
        .first()
    )

    if not usage:
        return

    if usage.uploads_count >= GUEST_UPLOAD_LIMIT:
        raise HTTPException(
            status_code=429,
            detail=f"Guest upload limit reached ({GUEST_UPLOAD_LIMIT} uploads). Sign up for unlimited access.",
        )


def check_guest_execution_limit(org_context: OrgContext, db: Session):
    """Check if guest has exceeded execution limit. Use as dependency on execution routes."""
    if not org_context.is_guest:
        return

    usage = (
        db.query(GuestUsage)
        .filter(GuestUsage.organization_id == org_context.organization_id)
        .first()
    )

    if not usage:
        return

    if usage.executions_count >= GUEST_EXECUTION_LIMIT:
        raise HTTPException(
            status_code=429,
            detail=f"Guest execution limit reached ({GUEST_EXECUTION_LIMIT} executions). Sign up for unlimited access.",
        )


def check_guest_file_size(file: UploadFile, org_context: OrgContext):
    """Check file size for guest uploads."""
    if not org_context.is_guest:
        return

    if file.size and file.size > GUEST_MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"Guest file size limit exceeded (max {GUEST_MAX_FILE_SIZE_BYTES // 1024 // 1024}MB). Sign up for unlimited access.",
        )


def increment_guest_upload(org_context: OrgContext, db: Session):
    """Increment guest upload counter after successful upload."""
    if not org_context.is_guest:
        return

    usage = (
        db.query(GuestUsage)
        .filter(GuestUsage.organization_id == org_context.organization_id)
        .first()
    )
    if usage:
        usage.uploads_count += 1
        db.flush()


def increment_guest_execution(org_context: OrgContext, db: Session):
    """Increment guest execution counter after successful execution."""
    if not org_context.is_guest:
        return

    usage = (
        db.query(GuestUsage)
        .filter(GuestUsage.organization_id == org_context.organization_id)
        .first()
    )
    if usage:
        usage.executions_count += 1
        db.flush()
