"""add_account_type_guest_fields_guest_usage

Revision ID: a1b2c3d4e5f7
Revises: 93238c9bcc77
Create Date: 2026-04-10 00:00:00.000000

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "a1b2c3d4e5f7"
down_revision: str = "93238c9bcc77"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create accounttype enum
    op.execute(
        "DO $$ BEGIN "
        "CREATE TYPE accounttype AS ENUM ('personal', 'organization', 'guest'); "
        "EXCEPTION WHEN duplicate_object THEN null; "
        "END $$;"
    )

    # Add account_type column to organizations table
    op.add_column(
        "organizations",
        sa.Column(
            "account_type",
            postgresql.ENUM(
                "personal",
                "organization",
                "guest",
                name="accounttype",
                create_type=False,
            ),
            nullable=False,
            server_default="organization",
        ),
    )

    # Add guest fields to users table
    op.add_column(
        "users",
        sa.Column("is_guest", sa.Boolean(), nullable=False, server_default="false"),
    )
    op.add_column(
        "users",
        sa.Column("guest_expires_at", sa.TIMESTAMP(timezone=True), nullable=True),
    )

    # Create guest_usage table
    op.create_table(
        "guest_usage",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column(
            "user_id",
            sa.String(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column(
            "organization_id",
            sa.String(),
            sa.ForeignKey("organizations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("uploads_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("executions_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "total_file_size_bytes", sa.BigInteger(), nullable=False, server_default="0"
        ),
        sa.Column(
            "created_at", sa.TIMESTAMP(timezone=True), server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at", sa.TIMESTAMP(timezone=True), server_default=sa.func.now()
        ),
    )
    op.create_index("ix_guest_usage_id", "guest_usage", ["id"])

    # Backfill: ensure all existing organizations have account_type set
    op.execute(
        "UPDATE organizations SET account_type = 'organization' WHERE account_type IS NULL"
    )


def downgrade() -> None:
    # Drop guest_usage table
    op.drop_index("ix_guest_usage_id", table_name="guest_usage")
    op.drop_table("guest_usage")

    # Remove guest fields from users
    op.drop_column("users", "guest_expires_at")
    op.drop_column("users", "is_guest")

    # Remove account_type from organizations
    op.drop_column("organizations", "account_type")

    # Drop accounttype enum
    op.execute("DROP TYPE IF EXISTS accounttype")
