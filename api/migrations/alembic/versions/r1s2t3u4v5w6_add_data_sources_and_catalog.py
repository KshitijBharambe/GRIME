"""add_data_sources_and_catalog

Revision ID: r1s2t3u4v5w6
Revises: 6b7a2e3f4d5c
Create Date: 2026-04-19 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "r1s2t3u4v5w6"
down_revision: Union[str, None] = "6b7a2e3f4d5c"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        "CREATE TYPE datasourcetype AS ENUM ('postgresql', 'mysql', 'snowflake', 's3_csv', 'local_simulator')"
    )
    op.execute(
        "CREATE TYPE datasourcestatus AS ENUM ('active', 'inactive', 'error')"
    )

    op.create_table(
        "data_sources",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("organization_id", sa.String(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column(
            "source_type",
            postgresql.ENUM("postgresql", "mysql", "snowflake", "s3_csv", "local_simulator", name="datasourcetype", create_type=False),
            nullable=False,
        ),
        sa.Column(
            "status",
            postgresql.ENUM("active", "inactive", "error", name="datasourcestatus", create_type=False),
            nullable=False,
            server_default="active",
        ),
        sa.Column("connection_params", sa.Text(), nullable=False),
        sa.Column("last_synced_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.Column("created_by", sa.String(), nullable=False),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_data_sources_id", "data_sources", ["id"])
    op.create_index("ix_data_sources_organization_id", "data_sources", ["organization_id"])

    op.create_table(
        "data_catalog_entries",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("organization_id", sa.String(), nullable=False),
        sa.Column("data_source_id", sa.String(), nullable=False),
        sa.Column("schema_name", sa.String(), nullable=True),
        sa.Column("table_name", sa.String(), nullable=False),
        sa.Column("column_count", sa.Integer(), nullable=True),
        sa.Column("row_estimate", sa.BigInteger(), nullable=True),
        sa.Column("column_metadata", sa.Text(), nullable=True),
        sa.Column("tags", sa.Text(), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("discovered_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["data_source_id"], ["data_sources.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_data_catalog_entries_id", "data_catalog_entries", ["id"])
    op.create_index("ix_data_catalog_entries_organization_id", "data_catalog_entries", ["organization_id"])
    op.create_index("ix_data_catalog_entries_data_source_id", "data_catalog_entries", ["data_source_id"])


def downgrade() -> None:
    op.drop_table("data_catalog_entries")
    op.drop_table("data_sources")
    op.execute("DROP TYPE IF EXISTS datasourcestatus")
    op.execute("DROP TYPE IF EXISTS datasourcetype")
