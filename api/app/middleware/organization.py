"""
Organization Middleware

Provides helper functions and utilities for enforcing organization-based
data isolation across all API endpoints.
"""

from typing import Optional, List, Any
from sqlalchemy.orm import Query, Session
from sqlalchemy import and_, or_
from fastapi import HTTPException, status

from app.models import OrganizationMember, ResourceShare, SharePermission
from app.auth import OrgContext


class OrganizationFilter:
    """
    Helper class for applying organization-based filters to database queries.
    Ensures users can only access resources within their organization.
    """

    @staticmethod
    def filter_by_org(
        query: Query, model: Any, org_context: OrgContext, include_shared: bool = False
    ) -> Query:
        """
        Apply organization filter to a query.

        Args:
            query: SQLAlchemy query object
            model: The model class being queried (e.g., Dataset, Rule)
            org_context: Organization context from JWT
            include_shared: If True, also include resources shared with this org

        Returns:
            Filtered query
        """
        # Base filter: resources owned by the organization
        base_filter = model.organization_id == org_context.organization_id

        if include_shared:
            # Also include resources shared with this organization
            # This requires a join with the resource_shares table
            from sqlalchemy import exists, select

            shared_filter = exists(
                select(ResourceShare.id).where(
                    and_(
                        ResourceShare.resource_type == model.__tablename__,
                        ResourceShare.resource_id == model.id,
                        ResourceShare.shared_with_org_id == org_context.organization_id,
                        ResourceShare.revoked_at.is_(None),
                        or_(
                            ResourceShare.expires_at.is_(None),
                            ResourceShare.expires_at > Query._now(),
                        ),
                    )
                )
            )

            return query.filter(or_(base_filter, shared_filter))

        return query.filter(base_filter)

    @staticmethod
    def ensure_org_ownership(
        resource: Any, org_context: OrgContext, resource_name: str = "Resource"
    ) -> None:
        """
        Verify that a resource belongs to the current organization.
        Raises HTTPException if not.

        Args:
            resource: The resource object to check
            org_context: Organization context from JWT
            resource_name: Name of the resource type for error messages

        Raises:
            HTTPException: If resource doesn't belong to the organization
        """
        if not resource:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"{resource_name} not found",
            )

        if not hasattr(resource, "organization_id"):
            # Resource doesn't have organization_id, might be a shared resource
            return

        if resource.organization_id != org_context.organization_id:
            # Check if it's a shared resource
            if hasattr(resource, "id") and hasattr(resource, "__tablename__"):

                # This is a simplified check - in production, inject the session
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"{resource_name} does not belong to your organization",
                )
            else:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"{resource_name} does not belong to your organization",
                )

    @staticmethod
    def check_resource_access(
        resource: Any,
        org_context: OrgContext,
        required_permission: Optional[SharePermission] = None,
        db: Optional[Session] = None,
    ) -> tuple[bool, Optional[SharePermission]]:
        """
        Check if the organization has access to a resource.
        Returns (is_owner, permission_level).

        Args:
            resource: The resource to check access for
            org_context: Organization context
            required_permission: Minimum required permission level
            db: Database session (required if checking shared resources)

        Returns:
            Tuple of (is_owner: bool, permission: Optional[SharePermission])
        """
        # Check if organization owns the resource
        if hasattr(resource, "organization_id"):
            if resource.organization_id == org_context.organization_id:
                return (True, None)  # Owner has full access

        # Check if resource is shared with the organization
        if db and hasattr(resource, "id") and hasattr(resource, "__tablename__"):
            share = (
                db.query(ResourceShare)
                .filter(
                    ResourceShare.resource_type == resource.__tablename__,
                    ResourceShare.resource_id == resource.id,
                    ResourceShare.shared_with_org_id == org_context.organization_id,
                    ResourceShare.revoked_at.is_(None),
                )
                .first()
            )

            if share:
                # Check expiration
                from datetime import datetime, timezone

                if share.expires_at and datetime.now(timezone.utc) > share.expires_at:
                    return (False, None)  # Share expired

                # Check if permission level is sufficient
                if required_permission:
                    permission_hierarchy = {
                        SharePermission.view: 1,
                        SharePermission.use: 2,
                        SharePermission.clone: 3,
                    }
                    if permission_hierarchy.get(
                        share.permission, 0
                    ) >= permission_hierarchy.get(required_permission, 0):
                        return (False, share.permission)
                    return (False, None)  # Insufficient permission

                return (False, share.permission)

        return (False, None)  # No access


def create_org_scoped_resource(
    resource_data: dict, org_context: OrgContext, created_by_field: str = "created_by"
) -> dict:
    """
    Helper to add organization context to resource creation data.

    Args:
        resource_data: Dictionary of resource fields
        org_context: Organization context
        created_by_field: Name of the field for creator user ID

    Returns:
        Updated resource data with organization_id and created_by
    """
    resource_data["organization_id"] = org_context.organization_id
    if created_by_field:
        resource_data[created_by_field] = org_context.user_id
    return resource_data


def validate_org_member_access(
    user_id: str,
    organization_id: str,
    db: Session,
    min_role: Optional[List[str]] = None,
) -> bool:
    """
    Validate that a user is a member of an organization with sufficient role.

    Args:
        user_id: User ID to check
        organization_id: Organization ID
        db: Database session
        min_role: List of acceptable roles (e.g., ['owner', 'admin'])

    Returns:
        True if user has access, False otherwise
    """

    membership = (
        db.query(OrganizationMember)
        .filter(
            OrganizationMember.user_id == user_id,
            OrganizationMember.organization_id == organization_id,
        )
        .first()
    )

    if not membership:
        return False

    if min_role:
        return membership.role.value in min_role

    return True


class AuditLogger:
    """Helper class for logging organization actions to audit log."""

    @staticmethod
    def log_action(
        db: Session,
        org_context: OrgContext,
        action: str,
        resource_type: Optional[str] = None,
        resource_id: Optional[str] = None,
        details: Optional[dict] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ):
        """
        Log an action to the audit log.

        Args:
            db: Database session
            org_context: Organization context
            action: Action name (e.g., 'create_dataset', 'delete_rule')
            resource_type: Type of resource affected
            resource_id: ID of resource affected
            details: Additional details as dict
            ip_address: IP address of request
            user_agent: User agent string
        """
        from app.models import AuditLog
        import uuid
        import json

        log_entry = AuditLog(
            id=str(uuid.uuid4()),
            organization_id=org_context.organization_id,
            user_id=org_context.user_id,
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            details=json.dumps(details) if details else None,
            ip_address=ip_address,
            user_agent=user_agent,
        )
        db.add(log_entry)
        # Note: Caller should commit the transaction

    @staticmethod
    def log_login(
        db: Session,
        user_id: str,
        organization_id: str,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ):
        """Log a user login event."""
        from app.models import AuditLog
        import uuid

        log_entry = AuditLog(
            id=str(uuid.uuid4()),
            organization_id=organization_id,
            user_id=user_id,
            action="user_login",
            ip_address=ip_address,
            user_agent=user_agent,
        )
        db.add(log_entry)
        # Note: Caller should commit the transaction

    @staticmethod
    def log_invite(
        db: Session,
        org_context: OrgContext,
        invited_email: str,
        role: str,
        ip_address: Optional[str] = None,
    ):
        """Log a user invitation."""
        AuditLogger.log_action(
            db=db,
            org_context=org_context,
            action="invite_user",
            resource_type="user",
            details={"email": invited_email, "role": role},
            ip_address=ip_address,
        )

    @staticmethod
    def log_member_role_change(
        db: Session,
        org_context: OrgContext,
        member_id: str,
        old_role: str,
        new_role: str,
        ip_address: Optional[str] = None,
    ):
        """Log a member role change."""
        AuditLogger.log_action(
            db=db,
            org_context=org_context,
            action="change_member_role",
            resource_type="organization_member",
            resource_id=member_id,
            details={"old_role": old_role, "new_role": new_role},
            ip_address=ip_address,
        )

    @staticmethod
    def log_resource_share(
        db: Session,
        org_context: OrgContext,
        resource_type: str,
        resource_id: str,
        shared_with_org_id: str,
        permission: str,
        ip_address: Optional[str] = None,
    ):
        """Log a resource sharing event."""
        AuditLogger.log_action(
            db=db,
            org_context=org_context,
            action="share_resource",
            resource_type=resource_type,
            resource_id=resource_id,
            details={
                "shared_with_org_id": shared_with_org_id,
                "permission": permission,
            },
            ip_address=ip_address,
        )
