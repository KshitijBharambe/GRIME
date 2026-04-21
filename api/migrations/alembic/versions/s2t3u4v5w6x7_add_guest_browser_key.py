"""add_guest_browser_key

Revision ID: s2t3u4v5w6x7
Revises: r1s2t3u4v5w6
Create Date: 2026-04-19 01:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "s2t3u4v5w6x7"
down_revision: Union[str, None] = "r1s2t3u4v5w6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "guest_usage",
        sa.Column("browser_key", sa.String(), nullable=True),
    )
    op.create_index("ix_guest_usage_browser_key", "guest_usage", ["browser_key"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_guest_usage_browser_key", table_name="guest_usage")
    op.drop_column("guest_usage", "browser_key")
