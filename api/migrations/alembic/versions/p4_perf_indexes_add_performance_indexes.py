"""Add performance indexes for common query patterns.

Revision ID: p4_perf_indexes
Revises: a1b2c3d4e5f7
Create Date: 2026-04-10

"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "p4_perf_indexes"
down_revision: Union[str, None] = "a1b2c3d4e5f7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Composite indexes for common query patterns

    # Datasets: filtered by org, sorted by upload time
    op.create_index(
        "idx_datasets_org_uploaded",
        "datasets",
        ["organization_id", "uploaded_at"],
    )

    # Rules: filtered by org + active status (rule listing)
    op.create_index(
        "idx_rules_org_active",
        "rules",
        ["organization_id", "is_active"],
    )

    # Audit logs: filtered by org, sorted by created_at
    op.create_index(
        "idx_audit_logs_org_created",
        "audit_logs",
        ["organization_id", "created_at"],
    )

    # Guest usage: lookup by org
    op.create_index(
        "idx_guest_usage_org",
        "guest_usage",
        ["organization_id"],
    )

    # Users: guest expiry cleanup queries
    op.create_index(
        "idx_users_guest_expires",
        "users",
        ["is_guest", "guest_expires_at"],
    )

    # Issues: lookup by execution + resolved status
    op.create_index(
        "idx_issues_execution_resolved",
        "issues",
        ["execution_id", "resolved"],
    )

    # Executions: lookup by dataset version + status
    op.create_index(
        "idx_executions_version_status",
        "executions",
        ["dataset_version_id", "status"],
    )


def downgrade() -> None:
    op.drop_index("idx_executions_version_status", table_name="executions")
    op.drop_index("idx_issues_execution_resolved", table_name="issues")
    op.drop_index("idx_users_guest_expires", table_name="users")
    op.drop_index("idx_guest_usage_org", table_name="guest_usage")
    op.drop_index("idx_audit_logs_org_created", table_name="audit_logs")
    op.drop_index("idx_rules_org_active", table_name="rules")
    op.drop_index("idx_datasets_org_uploaded", table_name="datasets")
