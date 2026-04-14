"""Merge performance and advanced features heads

Revision ID: 6b7a2e3f4d5c
Revises: p4_perf_indexes, b3edb349abff
Create Date: 2026-04-14 03:13:42.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '6b7a2e3f4d5c'
down_revision: Union[str, None] = ('p4_perf_indexes', 'b3edb349abff')
branch_labels: Union[Sequence[str], str, None] = None
depends_on: Union[Sequence[str], str, None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
