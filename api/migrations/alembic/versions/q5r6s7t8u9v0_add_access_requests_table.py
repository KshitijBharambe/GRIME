"""add_access_requests_table

Revision ID: q5r6s7t8u9v0
Revises: 93238c9bcc77
Create Date: 2026-04-11 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'q5r6s7t8u9v0'
down_revision: Union[str, None] = '93238c9bcc77'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'access_requests',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('organization_id', sa.String(), nullable=False),
        sa.Column('request_type', sa.String(), nullable=False),
        sa.Column('status', sa.String(), nullable=False, server_default='pending'),
        sa.Column('requester_id', sa.String(), nullable=False),
        sa.Column('required_approver_role', sa.String(), nullable=False, server_default='admin'),
        sa.Column('approver_id', sa.String(), nullable=True),
        sa.Column('request_data', sa.Text(), nullable=True),
        sa.Column('reason', sa.Text(), nullable=True),
        sa.Column('admin_notes', sa.Text(), nullable=True),
        sa.Column('created_at', postgresql.TIMESTAMP(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', postgresql.TIMESTAMP(timezone=True), server_default=sa.func.now()),
        sa.Column('expires_at', postgresql.TIMESTAMP(timezone=True), nullable=True),
        sa.Column('approved_at', postgresql.TIMESTAMP(timezone=True), nullable=True),
        sa.Column('rejected_at', postgresql.TIMESTAMP(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['requester_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['approver_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_access_requests_id', 'access_requests', ['id'])
    op.create_index('ix_access_requests_org', 'access_requests', ['organization_id'])
    op.create_index('ix_access_requests_requester', 'access_requests', ['requester_id'])
    op.create_index('ix_access_requests_status', 'access_requests', ['status'])


def downgrade() -> None:
    op.drop_index('ix_access_requests_status', table_name='access_requests')
    op.drop_index('ix_access_requests_requester', table_name='access_requests')
    op.drop_index('ix_access_requests_org', table_name='access_requests')
    op.drop_index('ix_access_requests_id', table_name='access_requests')
    op.drop_table('access_requests')
