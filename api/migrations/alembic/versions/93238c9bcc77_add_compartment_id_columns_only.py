"""add_compartment_id_columns_only

Revision ID: 93238c9bcc77
Revises: h3i4j5k6l7m8
Create Date: 2025-11-12 22:50:21.053110

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '93238c9bcc77'
down_revision: Union[str, None] = 'h3i4j5k6l7m8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    from sqlalchemy.dialects import postgresql

    # Create compartments table first
    op.create_table('compartments',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('organization_id', sa.String(), nullable=False),
        sa.Column('parent_compartment_id', sa.String(), nullable=True),
        sa.Column('path', sa.String(), nullable=False),
        sa.Column('created_at', postgresql.TIMESTAMP(timezone=True), nullable=True),
        sa.Column('updated_at', postgresql.TIMESTAMP(timezone=True), nullable=True),
        sa.Column('created_by', sa.String(), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=True, default=True),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['parent_compartment_id'], ['compartments.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['created_by'], ['users.id']),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_compartments_id'), 'compartments', ['id'], unique=False)
    op.create_index(op.f('ix_compartments_organization_id'), 'compartments', ['organization_id'], unique=False)
    op.create_index(op.f('ix_compartments_parent_compartment_id'), 'compartments', ['parent_compartment_id'], unique=False)
    op.create_index(op.f('ix_compartments_path'), 'compartments', ['path'], unique=False)

    # Create compartment_members table
    op.create_table('compartment_members',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('compartment_id', sa.String(), nullable=False),
        sa.Column('user_id', sa.String(), nullable=False),
        sa.Column('role', postgresql.ENUM('owner', 'admin', 'analyst', 'viewer', name='userrole', create_type=False), nullable=False),
        sa.Column('inherit_from_parent', sa.Boolean(), nullable=True, default=True),
        sa.Column('added_at', postgresql.TIMESTAMP(timezone=True), nullable=True),
        sa.Column('added_by', sa.String(), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=True, default=True),
        sa.ForeignKeyConstraint(['compartment_id'], ['compartments.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['added_by'], ['users.id']),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_compartment_members_id'), 'compartment_members', ['id'], unique=False)
    op.create_index(op.f('ix_compartment_members_compartment_id'), 'compartment_members', ['compartment_id'], unique=False)
    op.create_index(op.f('ix_compartment_members_user_id'), 'compartment_members', ['user_id'], unique=False)

    # Now add compartment_id column to datasets table
    op.add_column('datasets', sa.Column('compartment_id', sa.String(), nullable=True))
    op.create_index(op.f('ix_datasets_compartment_id'), 'datasets', ['compartment_id'], unique=False)
    op.create_foreign_key('datasets_compartment_id_fkey', 'datasets', 'compartments', ['compartment_id'], ['id'], ondelete='SET NULL')

    # Add compartment_id column to rules table
    op.add_column('rules', sa.Column('compartment_id', sa.String(), nullable=True))
    op.create_index(op.f('ix_rules_compartment_id'), 'rules', ['compartment_id'], unique=False)
    op.create_foreign_key('rules_compartment_id_fkey', 'rules', 'compartments', ['compartment_id'], ['id'], ondelete='SET NULL')

    # Add compartment_id column to executions table
    op.add_column('executions', sa.Column('compartment_id', sa.String(), nullable=True))
    op.create_index(op.f('ix_executions_compartment_id'), 'executions', ['compartment_id'], unique=False)
    op.create_foreign_key('executions_compartment_id_fkey', 'executions', 'compartments', ['compartment_id'], ['id'], ondelete='SET NULL')


def downgrade() -> None:
    # Remove compartment_id from executions
    op.drop_constraint('executions_compartment_id_fkey', 'executions', type_='foreignkey')
    op.drop_index(op.f('ix_executions_compartment_id'), table_name='executions')
    op.drop_column('executions', 'compartment_id')

    # Remove compartment_id from rules
    op.drop_constraint('rules_compartment_id_fkey', 'rules', type_='foreignkey')
    op.drop_index(op.f('ix_rules_compartment_id'), table_name='rules')
    op.drop_column('rules', 'compartment_id')

    # Remove compartment_id from datasets
    op.drop_constraint('datasets_compartment_id_fkey', 'datasets', type_='foreignkey')
    op.drop_index(op.f('ix_datasets_compartment_id'), table_name='datasets')
    op.drop_column('datasets', 'compartment_id')

    # Drop compartment_members table
    op.drop_index(op.f('ix_compartment_members_user_id'), table_name='compartment_members')
    op.drop_index(op.f('ix_compartment_members_compartment_id'), table_name='compartment_members')
    op.drop_index(op.f('ix_compartment_members_id'), table_name='compartment_members')
    op.drop_table('compartment_members')

    # Drop compartments table
    op.drop_index(op.f('ix_compartments_path'), table_name='compartments')
    op.drop_index(op.f('ix_compartments_parent_compartment_id'), table_name='compartments')
    op.drop_index(op.f('ix_compartments_organization_id'), table_name='compartments')
    op.drop_index(op.f('ix_compartments_id'), table_name='compartments')
    op.drop_table('compartments')
