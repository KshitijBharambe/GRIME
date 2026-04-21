"""Create comprehensive data hygiene schema

Revision ID: f3f72ff529c3
Revises: 04ca9eab8c98
Create Date: 2025-08-13 15:01:28.651569

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'f3f72ff529c3'
down_revision: Union[str, None] = '04ca9eab8c98'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Pre-create ENUM types idempotently. SQLAlchemy's postgresql.ENUM with
    # default create_type=True will attempt CREATE TYPE during op.create_table,
    # which fails with "duplicate type" if a prior partial run, downgrade, or
    # manual intervention left the types behind. Creating them here with
    # DO/EXCEPTION blocks guarantees the migration is safe to re-run.
    op.execute(
        "DO $$ BEGIN "
        "CREATE TYPE userrole AS ENUM ('admin', 'analyst', 'viewer'); "
        "EXCEPTION WHEN duplicate_object THEN null; END $$;"
    )
    op.execute(
        "DO $$ BEGIN "
        "CREATE TYPE sourcetype AS ENUM ('csv', 'excel', 'sap', 'ms_dynamics', 'other'); "
        "EXCEPTION WHEN duplicate_object THEN null; END $$;"
    )
    op.execute(
        "DO $$ BEGIN "
        "CREATE TYPE datasetstatus AS ENUM ('uploaded', 'profiled', 'validated', 'cleaned', 'exported'); "
        "EXCEPTION WHEN duplicate_object THEN null; END $$;"
    )
    op.execute(
        "DO $$ BEGIN "
        "CREATE TYPE rulekind AS ENUM ('missing_data', 'standardization', 'value_list', 'length_range', 'cross_field', 'char_restriction', 'regex', 'custom'); "
        "EXCEPTION WHEN duplicate_object THEN null; END $$;"
    )
    op.execute(
        "DO $$ BEGIN "
        "CREATE TYPE criticality AS ENUM ('low', 'medium', 'high', 'critical'); "
        "EXCEPTION WHEN duplicate_object THEN null; END $$;"
    )
    op.execute(
        "DO $$ BEGIN "
        "CREATE TYPE executionstatus AS ENUM ('queued', 'running', 'succeeded', 'failed', 'partially_succeeded'); "
        "EXCEPTION WHEN duplicate_object THEN null; END $$;"
    )
    op.execute(
        "DO $$ BEGIN "
        "CREATE TYPE exportformat AS ENUM ('csv', 'excel', 'json', 'api', 'datalake'); "
        "EXCEPTION WHEN duplicate_object THEN null; END $$;"
    )

    op.create_table('users',
    sa.Column('id', sa.String(), nullable=False),
    sa.Column('name', sa.String(), nullable=False),
    sa.Column('email', sa.String(), nullable=False),
    sa.Column('role', postgresql.ENUM('admin', 'analyst', 'viewer', name='userrole', create_type=False), nullable=False),
    sa.Column('auth_provider', sa.String(), nullable=True),
    sa.Column('auth_subject', sa.String(), nullable=True),
    sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
    sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('email')
    )
    op.create_index(op.f('ix_users_id'), 'users', ['id'], unique=False)
    op.create_table('datasets',
    sa.Column('id', sa.String(), nullable=False),
    sa.Column('name', sa.String(), nullable=False),
    sa.Column('source_type', postgresql.ENUM('csv', 'excel', 'sap', 'ms_dynamics', 'other', name='sourcetype', create_type=False), nullable=False),
    sa.Column('original_filename', sa.String(), nullable=True),
    sa.Column('checksum', sa.String(), nullable=True),
    sa.Column('uploaded_by', sa.String(), nullable=False),
    sa.Column('uploaded_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
    sa.Column('status', postgresql.ENUM('uploaded', 'profiled', 'validated', 'cleaned', 'exported', name='datasetstatus', create_type=False), nullable=True),
    sa.Column('row_count', sa.Integer(), nullable=True),
    sa.Column('column_count', sa.Integer(), nullable=True),
    sa.Column('notes', sa.Text(), nullable=True),
    sa.ForeignKeyConstraint(['uploaded_by'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_datasets_id'), 'datasets', ['id'], unique=False)
    op.create_table('rules',
    sa.Column('id', sa.String(), nullable=False),
    sa.Column('name', sa.String(), nullable=False),
    sa.Column('description', sa.Text(), nullable=True),
    sa.Column('kind', postgresql.ENUM('missing_data', 'standardization', 'value_list', 'length_range', 'cross_field', 'char_restriction', 'regex', 'custom', name='rulekind', create_type=False), nullable=False),
    sa.Column('criticality', postgresql.ENUM('low', 'medium', 'high', 'critical', name='criticality', create_type=False), nullable=False),
    sa.Column('is_active', sa.Boolean(), nullable=True),
    sa.Column('target_table', sa.String(), nullable=True),
    sa.Column('target_columns', sa.Text(), nullable=True),
    sa.Column('params', sa.Text(), nullable=True),
    sa.Column('created_by', sa.String(), nullable=False),
    sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
    sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
    sa.ForeignKeyConstraint(['created_by'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('name')
    )
    op.create_index(op.f('ix_rules_id'), 'rules', ['id'], unique=False)
    op.create_table('dataset_columns',
    sa.Column('id', sa.String(), nullable=False),
    sa.Column('dataset_id', sa.String(), nullable=False),
    sa.Column('name', sa.String(), nullable=False),
    sa.Column('ordinal_position', sa.Integer(), nullable=False),
    sa.Column('inferred_type', sa.String(), nullable=True),
    sa.Column('is_nullable', sa.Boolean(), nullable=True),
    sa.ForeignKeyConstraint(['dataset_id'], ['datasets.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_dataset_columns_id'), 'dataset_columns', ['id'], unique=False)
    op.create_table('dataset_versions',
    sa.Column('id', sa.String(), nullable=False),
    sa.Column('dataset_id', sa.String(), nullable=False),
    sa.Column('version_no', sa.Integer(), nullable=False),
    sa.Column('created_by', sa.String(), nullable=False),
    sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
    sa.Column('rows', sa.Integer(), nullable=True),
    sa.Column('columns', sa.Integer(), nullable=True),
    sa.Column('change_note', sa.Text(), nullable=True),
    sa.ForeignKeyConstraint(['created_by'], ['users.id'], ),
    sa.ForeignKeyConstraint(['dataset_id'], ['datasets.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_dataset_versions_id'), 'dataset_versions', ['id'], unique=False)
    op.create_table('executions',
    sa.Column('id', sa.String(), nullable=False),
    sa.Column('dataset_version_id', sa.String(), nullable=False),
    sa.Column('started_by', sa.String(), nullable=False),
    sa.Column('started_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
    sa.Column('finished_at', sa.DateTime(), nullable=True),
    sa.Column('status', postgresql.ENUM('queued', 'running', 'succeeded', 'failed', 'partially_succeeded', name='executionstatus', create_type=False), nullable=True),
    sa.Column('total_rows', sa.Integer(), nullable=True),
    sa.Column('total_rules', sa.Integer(), nullable=True),
    sa.Column('rows_affected', sa.Integer(), nullable=True),
    sa.Column('columns_affected', sa.Integer(), nullable=True),
    sa.Column('summary', sa.Text(), nullable=True),
    sa.ForeignKeyConstraint(['dataset_version_id'], ['dataset_versions.id'], ),
    sa.ForeignKeyConstraint(['started_by'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_executions_id'), 'executions', ['id'], unique=False)
    op.create_table('rule_columns',
    sa.Column('id', sa.String(), nullable=False),
    sa.Column('rule_id', sa.String(), nullable=False),
    sa.Column('column_id', sa.String(), nullable=False),
    sa.ForeignKeyConstraint(['column_id'], ['dataset_columns.id'], ),
    sa.ForeignKeyConstraint(['rule_id'], ['rules.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_rule_columns_id'), 'rule_columns', ['id'], unique=False)
    op.create_table('version_journal',
    sa.Column('id', sa.String(), nullable=False),
    sa.Column('dataset_version_id', sa.String(), nullable=False),
    sa.Column('event', sa.String(), nullable=False),
    sa.Column('rows_affected', sa.Integer(), nullable=True),
    sa.Column('columns_affected', sa.Integer(), nullable=True),
    sa.Column('details', sa.Text(), nullable=True),
    sa.Column('occurred_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
    sa.ForeignKeyConstraint(['dataset_version_id'], ['dataset_versions.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_version_journal_id'), 'version_journal', ['id'], unique=False)
    op.create_table('execution_rules',
    sa.Column('id', sa.String(), nullable=False),
    sa.Column('execution_id', sa.String(), nullable=False),
    sa.Column('rule_id', sa.String(), nullable=False),
    sa.Column('error_count', sa.Integer(), nullable=True),
    sa.Column('rows_flagged', sa.Integer(), nullable=True),
    sa.Column('cols_flagged', sa.Integer(), nullable=True),
    sa.Column('note', sa.Text(), nullable=True),
    sa.ForeignKeyConstraint(['execution_id'], ['executions.id'], ),
    sa.ForeignKeyConstraint(['rule_id'], ['rules.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_execution_rules_id'), 'execution_rules', ['id'], unique=False)
    op.create_table('exports',
    sa.Column('id', sa.String(), nullable=False),
    sa.Column('dataset_version_id', sa.String(), nullable=False),
    sa.Column('execution_id', sa.String(), nullable=True),
    sa.Column('format', postgresql.ENUM('csv', 'excel', 'json', 'api', 'datalake', name='exportformat', create_type=False), nullable=False),
    sa.Column('location', sa.String(), nullable=True),
    sa.Column('created_by', sa.String(), nullable=False),
    sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
    sa.ForeignKeyConstraint(['created_by'], ['users.id'], ),
    sa.ForeignKeyConstraint(['dataset_version_id'], ['dataset_versions.id'], ),
    sa.ForeignKeyConstraint(['execution_id'], ['executions.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_exports_id'), 'exports', ['id'], unique=False)
    op.create_table('issues',
    sa.Column('id', sa.String(), nullable=False),
    sa.Column('execution_id', sa.String(), nullable=False),
    sa.Column('rule_id', sa.String(), nullable=False),
    sa.Column('row_index', sa.Integer(), nullable=False),
    sa.Column('column_name', sa.String(), nullable=False),
    sa.Column('current_value', sa.Text(), nullable=True),
    sa.Column('suggested_value', sa.Text(), nullable=True),
    sa.Column('message', sa.Text(), nullable=True),
    sa.Column('category', sa.String(), nullable=True),
    sa.Column('severity', postgresql.ENUM('low', 'medium', 'high', 'critical', name='criticality', create_type=False), nullable=False),
    sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
    sa.Column('resolved', sa.Boolean(), nullable=True),
    sa.ForeignKeyConstraint(['execution_id'], ['executions.id'], ),
    sa.ForeignKeyConstraint(['rule_id'], ['rules.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_issues_id'), 'issues', ['id'], unique=False)
    op.create_table('fixes',
    sa.Column('id', sa.String(), nullable=False),
    sa.Column('issue_id', sa.String(), nullable=False),
    sa.Column('fixed_by', sa.String(), nullable=False),
    sa.Column('fixed_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
    sa.Column('new_value', sa.Text(), nullable=True),
    sa.Column('comment', sa.Text(), nullable=True),
    sa.ForeignKeyConstraint(['fixed_by'], ['users.id'], ),
    sa.ForeignKeyConstraint(['issue_id'], ['issues.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_fixes_id'), 'fixes', ['id'], unique=False)
    op.drop_table('employee')
    # ### end Alembic commands ###


def downgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.create_table('employee',
    sa.Column('Id', sa.INTEGER(), autoincrement=True, nullable=False),
    sa.Column('name', sa.VARCHAR(length=50), autoincrement=False, nullable=False),
    sa.Column('Current', sa.BOOLEAN(), autoincrement=False, nullable=True),
    sa.PrimaryKeyConstraint('Id', name=op.f('employee_pkey'))
    )
    op.drop_index(op.f('ix_fixes_id'), table_name='fixes')
    op.drop_table('fixes')
    op.drop_index(op.f('ix_issues_id'), table_name='issues')
    op.drop_table('issues')
    op.drop_index(op.f('ix_exports_id'), table_name='exports')
    op.drop_table('exports')
    op.drop_index(op.f('ix_execution_rules_id'), table_name='execution_rules')
    op.drop_table('execution_rules')
    op.drop_index(op.f('ix_version_journal_id'), table_name='version_journal')
    op.drop_table('version_journal')
    op.drop_index(op.f('ix_rule_columns_id'), table_name='rule_columns')
    op.drop_table('rule_columns')
    op.drop_index(op.f('ix_executions_id'), table_name='executions')
    op.drop_table('executions')
    op.drop_index(op.f('ix_dataset_versions_id'), table_name='dataset_versions')
    op.drop_table('dataset_versions')
    op.drop_index(op.f('ix_dataset_columns_id'), table_name='dataset_columns')
    op.drop_table('dataset_columns')
    op.drop_index(op.f('ix_rules_id'), table_name='rules')
    op.drop_table('rules')
    op.drop_index(op.f('ix_datasets_id'), table_name='datasets')
    op.drop_table('datasets')
    op.drop_index(op.f('ix_users_id'), table_name='users')
    op.drop_table('users')

    # Drop ENUM types created in upgrade. PostgreSQL ENUMs survive table drops,
    # so explicit cleanup is required for the migration to be idempotent
    # (re-running upgrade after downgrade would otherwise fail with
    # "type already exists"). IF EXISTS guards against partial state.
    op.execute("DROP TYPE IF EXISTS exportformat")
    op.execute("DROP TYPE IF EXISTS executionstatus")
    op.execute("DROP TYPE IF EXISTS criticality")
    op.execute("DROP TYPE IF EXISTS rulekind")
    op.execute("DROP TYPE IF EXISTS datasetstatus")
    op.execute("DROP TYPE IF EXISTS sourcetype")
    op.execute("DROP TYPE IF EXISTS userrole")
    # ### end Alembic commands ###
