"""Merge rule dependency management with data quality metrics

Revision ID: 1903bb90c0fb
Revises: 21f9a9779f17, 1a2b3c4d5e6f
Create Date: 2025-10-16 00:01:51.455347

This is a **merge-only migration**. It contains no schema changes.

Two independent migration branches were created in parallel:
  - 21f9a9779f17: add_data_quality_metrics_table
  - 1a2b3c4d5e6f: add_rule_dependency_management

Both branches descended from different points in the revision history,
causing Alembic to detect multiple heads. This migration exists solely
to reunify those heads into a single linear history.

See: https://alembic.sqlalchemy.org/en/latest/branches.html#merging-branches
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "1903bb90c0fb"
down_revision: Union[str, None] = ("21f9a9779f17", "1a2b3c4d5e6f")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Merge-only migration — no schema changes.
    # This revision reunifies divergent heads into a single history.
    pass


def downgrade() -> None:
    # Merge-only migration — nothing to reverse.
    pass
