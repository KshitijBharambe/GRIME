from sqlalchemy import (
    Column,
    String,
    Integer,
    BigInteger,
    Boolean,
    Text,
    ForeignKey,
    func,
)
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import ENUM, TIMESTAMP
from sqlalchemy import Enum as SAEnum
from app.database import Base
from app.core.config import DatabaseTableRefs
import uuid
import enum

# Enums


class AccountType(str, enum.Enum):
    PERSONAL = "personal"
    ORGANIZATION = "organization"
    GUEST = "guest"


class UserRole(enum.Enum):
    owner = "owner"  # Organization owner
    admin = "admin"
    analyst = "analyst"
    viewer = "viewer"


class SourceType(enum.Enum):
    csv = "csv"
    excel = "excel"
    sap = "sap"
    ms_dynamics = "ms_dynamics"
    other = "other"


class DataSourceType(str, enum.Enum):
    postgresql = "postgresql"
    mysql = "mysql"
    snowflake = "snowflake"
    s3_csv = "s3_csv"
    local_simulator = "local_simulator"


class DataSourceStatus(str, enum.Enum):
    active = "active"
    inactive = "inactive"
    error = "error"


class DatasetStatus(enum.Enum):
    uploaded = "uploaded"
    profiled = "profiled"
    validated = "validated"
    cleaned = "cleaned"
    exported = "exported"


class Criticality(enum.Enum):
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"


class RuleKind(enum.Enum):
    missing_data = "missing_data"
    standardization = "standardization"
    value_list = "value_list"
    length_range = "length_range"
    cross_field = "cross_field"
    char_restriction = "char_restriction"
    regex = "regex"
    custom = "custom"
    statistical_outlier = "statistical_outlier"
    distribution_check = "distribution_check"
    correlation_validation = "correlation_validation"
    ml_anomaly = "ml_anomaly"


class ExecutionStatus(enum.Enum):
    queued = "queued"
    running = "running"
    succeeded = "succeeded"
    failed = "failed"
    partially_succeeded = "partially_succeeded"


class ExportFormat(enum.Enum):
    csv = "csv"
    excel = "excel"
    json = "json"
    api = "api"
    datalake = "datalake"


class VersionSource(enum.Enum):
    upload = "upload"  # Original upload
    fixes_applied = "fixes_applied"  # Created by applying fixes
    manual_edit = "manual_edit"  # Manual modifications
    transformation = "transformation"  # Other transformations


class SharePermission(enum.Enum):
    view = "view"  # Can view the resource
    use = "use"  # Can use/execute the resource
    clone = "clone"  # Can clone to own organization


class InviteStatus(enum.Enum):
    pending = "pending"
    accepted = "accepted"
    expired = "expired"
    revoked = "revoked"


# Models


class Organization(Base):
    __tablename__ = "organizations"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    name = Column(String, nullable=False)
    slug = Column(String, unique=True, nullable=False, index=True)
    contact_email = Column(String, nullable=False)
    account_type = Column(
        # Use SAEnum with values_callable so SQLAlchemy binds the enum's .value
        SAEnum(
            AccountType,
            name="accounttype",
            values_callable=lambda obj: [e.value for e in obj],
            native_enum=True,
        ),
        default=AccountType.ORGANIZATION.value,
        nullable=False,
        server_default="organization",
    )
    settings = Column(Text)  # JSON for org-specific settings
    is_active = Column(Boolean, default=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(
        TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    members = relationship("OrganizationMember", back_populates="organization")
    invites = relationship("OrganizationInvite", back_populates="organization")
    datasets = relationship("Dataset", back_populates="organization")
    rules = relationship("Rule", back_populates="organization")
    shared_resources = relationship(
        "ResourceShare",
        foreign_keys="ResourceShare.owner_org_id",
        back_populates="owner_org",
    )
    received_shares = relationship(
        "ResourceShare",
        foreign_keys="ResourceShare.shared_with_org_id",
        back_populates="shared_with_org",
    )
    audit_logs = relationship("AuditLog", back_populates="organization")


class OrganizationMember(Base):
    __tablename__ = "organization_members"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    organization_id = Column(
        String,
        ForeignKey(DatabaseTableRefs.ORGANIZATIONS_ID, ondelete="CASCADE"),
        nullable=False,
    )
    user_id = Column(
        String,
        ForeignKey(DatabaseTableRefs.USERS_ID, ondelete="CASCADE"),
        nullable=False,
    )
    role = Column(ENUM(UserRole), nullable=False)
    invited_by = Column(String, ForeignKey(DatabaseTableRefs.USERS_ID), nullable=True)
    joined_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(
        TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    organization = relationship("Organization", back_populates="members")
    user = relationship("User", foreign_keys=[user_id], back_populates="memberships")
    inviter = relationship("User", foreign_keys=[invited_by])


class OrganizationInvite(Base):
    __tablename__ = "organization_invites"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    organization_id = Column(
        String,
        ForeignKey(DatabaseTableRefs.ORGANIZATIONS_ID, ondelete="CASCADE"),
        nullable=False,
    )
    email = Column(String, nullable=False, index=True)
    role = Column(ENUM(UserRole), nullable=False)
    invited_by = Column(String, ForeignKey(DatabaseTableRefs.USERS_ID), nullable=False)
    status = Column(ENUM(InviteStatus), default=InviteStatus.pending)
    invite_token = Column(String, unique=True, nullable=False, index=True)
    expires_at = Column(TIMESTAMP(timezone=True), nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    accepted_at = Column(TIMESTAMP(timezone=True), nullable=True)

    # Relationships
    organization = relationship("Organization", back_populates="invites")
    inviter = relationship("User")


class ResourceShare(Base):
    __tablename__ = "resource_shares"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    resource_type = Column(String, nullable=False)  # 'rule', 'template', etc.
    resource_id = Column(String, nullable=False, index=True)
    owner_org_id = Column(
        String,
        ForeignKey(DatabaseTableRefs.ORGANIZATIONS_ID, ondelete="CASCADE"),
        nullable=False,
    )
    shared_with_org_id = Column(
        String,
        ForeignKey(DatabaseTableRefs.ORGANIZATIONS_ID, ondelete="CASCADE"),
        nullable=False,
    )
    permission = Column(ENUM(SharePermission), nullable=False)
    shared_by = Column(String, ForeignKey(DatabaseTableRefs.USERS_ID), nullable=False)
    expires_at = Column(TIMESTAMP(timezone=True), nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    revoked_at = Column(TIMESTAMP(timezone=True), nullable=True)
    revoked_by = Column(String, ForeignKey(DatabaseTableRefs.USERS_ID), nullable=True)

    # Relationships
    owner_org = relationship(
        "Organization", foreign_keys=[owner_org_id], back_populates="shared_resources"
    )
    shared_with_org = relationship(
        "Organization",
        foreign_keys=[shared_with_org_id],
        back_populates="received_shares",
    )
    sharer = relationship("User", foreign_keys=[shared_by])
    revoker = relationship("User", foreign_keys=[revoked_by])


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    organization_id = Column(
        String,
        ForeignKey(DatabaseTableRefs.ORGANIZATIONS_ID, ondelete="CASCADE"),
        nullable=False,
    )
    user_id = Column(String, ForeignKey(DatabaseTableRefs.USERS_ID), nullable=True)
    action = Column(String, nullable=False, index=True)
    resource_type = Column(String, nullable=True)
    resource_id = Column(String, nullable=True)
    details = Column(Text)  # JSON with additional details (renamed from metadata)
    ip_address = Column(String, nullable=True)
    user_agent = Column(String, nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), index=True)

    # Relationships
    organization = relationship("Organization", back_populates="audit_logs")
    user = relationship("User")


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False, index=True)
    auth_provider = Column(String, default="local")
    auth_subject = Column(String)  # hashed password for local, external ID for OAuth
    is_active = Column(Boolean, default=True)
    is_guest = Column(Boolean, default=False, nullable=False, server_default="false")
    guest_expires_at = Column(TIMESTAMP(timezone=True), nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(
        TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    memberships = relationship(
        "OrganizationMember",
        foreign_keys="OrganizationMember.user_id",
        back_populates="user",
    )
    uploaded_datasets = relationship("Dataset", back_populates="uploader")
    created_rules = relationship("Rule", back_populates="creator")
    started_executions = relationship("Execution", back_populates="starter")
    fixed_issues = relationship("Fix", back_populates="fixer")
    created_exports = relationship("Export", back_populates="creator")


class GuestUsage(Base):
    __tablename__ = "guest_usage"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    user_id = Column(
        String,
        ForeignKey(DatabaseTableRefs.USERS_ID, ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    organization_id = Column(
        String,
        ForeignKey(DatabaseTableRefs.ORGANIZATIONS_ID, ondelete="CASCADE"),
        nullable=False,
    )
    uploads_count = Column(Integer, default=0, nullable=False, server_default="0")
    executions_count = Column(Integer, default=0, nullable=False, server_default="0")
    total_file_size_bytes = Column(
        BigInteger, default=0, nullable=False, server_default="0"
    )
    browser_key = Column(String, nullable=True, index=True, unique=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(
        TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    user = relationship("User", backref="guest_usage")
    organization = relationship("Organization")


class Dataset(Base):
    __tablename__ = "datasets"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    organization_id = Column(
        String,
        ForeignKey(DatabaseTableRefs.ORGANIZATIONS_ID, ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name = Column(String, nullable=False)
    source_type = Column(ENUM(SourceType), nullable=False)
    original_filename = Column(String)
    checksum = Column(String)
    uploaded_by = Column(String, ForeignKey(DatabaseTableRefs.USERS_ID), nullable=False)
    uploaded_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    status = Column(ENUM(DatasetStatus), default=DatasetStatus.uploaded)
    row_count = Column(Integer)
    column_count = Column(Integer)
    notes = Column(Text)

    # Relationships
    organization = relationship("Organization", back_populates="datasets")
    uploader = relationship("User", back_populates="uploaded_datasets")
    versions = relationship("DatasetVersion", back_populates="dataset")
    columns = relationship("DatasetColumn", back_populates="dataset")


class DatasetVersion(Base):
    __tablename__ = "dataset_versions"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    dataset_id = Column(
        String, ForeignKey(DatabaseTableRefs.DATASETS_ID), nullable=False
    )
    version_no = Column(Integer, nullable=False)
    created_by = Column(String, ForeignKey(DatabaseTableRefs.USERS_ID), nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    rows = Column(Integer)
    columns = Column(Integer)
    change_note = Column(Text)

    # Track version lineage and source
    parent_version_id = Column(
        String, ForeignKey(DatabaseTableRefs.DATASET_VERSIONS_ID), nullable=True
    )
    source = Column(ENUM(VersionSource), default=VersionSource.upload, nullable=False)
    file_path = Column(String)  # Path to the actual data file

    # Relationships
    dataset = relationship("Dataset", back_populates="versions")
    creator = relationship("User")
    executions = relationship("Execution", back_populates="dataset_version")
    exports = relationship("Export", back_populates="dataset_version")
    journal_entries = relationship("VersionJournal", back_populates="dataset_version")
    parent_version = relationship(
        "DatasetVersion", remote_side=[id], foreign_keys=[parent_version_id]
    )


class DatasetColumn(Base):
    __tablename__ = "dataset_columns"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    dataset_id = Column(
        String, ForeignKey(DatabaseTableRefs.DATASETS_ID), nullable=False
    )
    name = Column(String, nullable=False)
    ordinal_position = Column(Integer, nullable=False)
    inferred_type = Column(String)
    is_nullable = Column(Boolean, default=True)

    # Relationships
    dataset = relationship("Dataset", back_populates="columns")
    rule_columns = relationship("RuleColumn", back_populates="column")


class Rule(Base):
    __tablename__ = "rules"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    organization_id = Column(
        String,
        ForeignKey(DatabaseTableRefs.ORGANIZATIONS_ID, ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # Removed unique constraint for versioning
    name = Column(String, nullable=False, index=True)
    description = Column(Text)
    kind = Column(ENUM(RuleKind), nullable=False)
    criticality = Column(ENUM(Criticality), nullable=False)
    is_active = Column(Boolean, default=True)
    target_table = Column(String)
    target_columns = Column(Text)
    params = Column(Text)  # JSON as text
    created_by = Column(String, ForeignKey(DatabaseTableRefs.USERS_ID), nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(
        TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Versioning fields
    version = Column(Integer, default=1, nullable=False)
    parent_rule_id = Column(
        String, ForeignKey(DatabaseTableRefs.RULES_ID), nullable=True
    )
    is_latest = Column(Boolean, default=True, nullable=False, index=True)
    change_log = Column(Text, nullable=True)  # JSON string of changes
    # Denormalized root rule ID for faster queries
    rule_family_id = Column(
        String, ForeignKey(DatabaseTableRefs.RULES_ID), nullable=True, index=True
    )

    # Dependency management fields
    # JSON string of dependent rule IDs
    dependencies = Column(Text, nullable=True)
    # Lower numbers = higher priority
    priority = Column(Integer, nullable=True, default=0)
    # Explicit execution order
    execution_order = Column(Integer, nullable=True)
    dependency_group = Column(String, nullable=True)  # Group for related rules

    # Relationships
    organization = relationship("Organization", back_populates="rules")
    creator = relationship("User", back_populates="created_rules")
    rule_columns = relationship("RuleColumn", back_populates="rule")
    execution_rules = relationship("ExecutionRule", back_populates="rule")
    issues = relationship("Issue", back_populates="rule")
    child_versions = relationship(
        "Rule",
        backref="parent_version",
        remote_side=[id],
        foreign_keys=[parent_rule_id],
    )


class RuleColumn(Base):
    __tablename__ = "rule_columns"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    rule_id = Column(String, ForeignKey(DatabaseTableRefs.RULES_ID), nullable=False)
    column_id = Column(String, ForeignKey("dataset_columns.id"), nullable=False)

    # Relationships
    rule = relationship("Rule", back_populates="rule_columns")
    column = relationship("DatasetColumn", back_populates="rule_columns")


class Execution(Base):
    __tablename__ = "executions"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    dataset_version_id = Column(
        String, ForeignKey(DatabaseTableRefs.DATASET_VERSIONS_ID), nullable=False
    )
    started_by = Column(String, ForeignKey(DatabaseTableRefs.USERS_ID), nullable=False)
    started_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    finished_at = Column(TIMESTAMP(timezone=True))
    status = Column(ENUM(ExecutionStatus), default=ExecutionStatus.queued)
    total_rows = Column(Integer)
    total_rules = Column(Integer)
    rows_affected = Column(Integer)
    columns_affected = Column(Integer)
    summary = Column(Text)  # JSON as text

    # Relationships
    dataset_version = relationship("DatasetVersion", back_populates="executions")
    starter = relationship("User", back_populates="started_executions")
    execution_rules = relationship("ExecutionRule", back_populates="execution")
    issues = relationship("Issue", back_populates="execution")
    exports = relationship("Export", back_populates="execution")


class ExecutionRule(Base):
    __tablename__ = "execution_rules"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    execution_id = Column(
        String, ForeignKey(DatabaseTableRefs.EXECUTIONS_ID), nullable=False
    )
    rule_id = Column(
        String,
        ForeignKey(DatabaseTableRefs.RULES_ID, ondelete="SET NULL"),
        nullable=True,
    )  # Nullable to allow rule deletion
    # JSON snapshot of rule at execution time
    rule_snapshot = Column(Text, nullable=True)
    error_count = Column(Integer, default=0)
    rows_flagged = Column(Integer, default=0)
    cols_flagged = Column(Integer, default=0)
    note = Column(Text)

    # Relationships
    execution = relationship("Execution", back_populates="execution_rules")
    rule = relationship("Rule", back_populates="execution_rules")


class Issue(Base):
    __tablename__ = "issues"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    execution_id = Column(
        String, ForeignKey(DatabaseTableRefs.EXECUTIONS_ID), nullable=False
    )
    rule_id = Column(
        String,
        ForeignKey(DatabaseTableRefs.RULES_ID, ondelete="SET NULL"),
        nullable=True,
    )  # Nullable to allow rule deletion
    # Lightweight JSON snapshot of rule info
    rule_snapshot = Column(Text, nullable=True)
    row_index = Column(Integer, nullable=False)
    column_name = Column(String, nullable=False)
    current_value = Column(Text)
    suggested_value = Column(Text)
    message = Column(Text)
    category = Column(String)
    severity = Column(ENUM(Criticality), nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    resolved = Column(Boolean, default=False)

    # Relationships
    execution = relationship("Execution", back_populates="issues")
    rule = relationship("Rule", back_populates="issues")
    fixes = relationship("Fix", back_populates="issue")


class Fix(Base):
    __tablename__ = "fixes"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    issue_id = Column(String, ForeignKey("issues.id"), nullable=False)
    fixed_by = Column(String, ForeignKey(DatabaseTableRefs.USERS_ID), nullable=False)
    fixed_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    new_value = Column(Text)
    comment = Column(Text)

    # Track if and when this fix was applied to create a new dataset version
    applied_in_version_id = Column(
        String, ForeignKey(DatabaseTableRefs.DATASET_VERSIONS_ID), nullable=True
    )
    applied_at = Column(TIMESTAMP(timezone=True), nullable=True)

    # Relationships
    issue = relationship("Issue", back_populates="fixes")
    fixer = relationship("User", back_populates="fixed_issues")
    applied_version = relationship(
        "DatasetVersion", foreign_keys=[applied_in_version_id]
    )


class Export(Base):
    __tablename__ = "exports"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    dataset_version_id = Column(
        String, ForeignKey(DatabaseTableRefs.DATASET_VERSIONS_ID), nullable=False
    )
    execution_id = Column(String, ForeignKey(DatabaseTableRefs.EXECUTIONS_ID))
    format = Column(ENUM(ExportFormat), nullable=False)
    location = Column(String)
    created_by = Column(String, ForeignKey(DatabaseTableRefs.USERS_ID), nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())

    # Relationships
    dataset_version = relationship("DatasetVersion", back_populates="exports")
    execution = relationship("Execution", back_populates="exports")
    creator = relationship("User", back_populates="created_exports")


class VersionJournal(Base):
    __tablename__ = "version_journal"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    dataset_version_id = Column(
        String, ForeignKey(DatabaseTableRefs.DATASET_VERSIONS_ID), nullable=False
    )
    event = Column(String, nullable=False)
    rows_affected = Column(Integer)
    columns_affected = Column(Integer)
    details = Column(Text)
    occurred_at = Column(TIMESTAMP(timezone=True), server_default=func.now())

    # Relationships
    dataset_version = relationship("DatasetVersion", back_populates="journal_entries")


class DataQualityMetrics(Base):
    __tablename__ = "data_quality_metrics"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    execution_id = Column(
        String,
        ForeignKey(DatabaseTableRefs.EXECUTIONS_ID, ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    dataset_version_id = Column(
        String,
        ForeignKey(DatabaseTableRefs.DATASET_VERSIONS_ID, ondelete="CASCADE"),
        nullable=False,
    )
    dqi = Column(Integer, nullable=False, default=0)
    clean_rows_pct = Column(Integer, nullable=False, default=0)
    hybrid = Column(Integer, nullable=False, default=0)
    status = Column(String, nullable=False, default="not_available")
    message = Column(Text)
    computed_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(
        TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    execution = relationship("Execution")
    dataset_version = relationship("DatasetVersion")


# Advanced Features Models


class RuleTemplate(Base):
    __tablename__ = "rule_templates"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    name = Column(String, nullable=False, index=True)
    description = Column(Text)
    # e.g., 'statistical', 'ml', 'validation'
    category = Column(String, nullable=False, index=True)
    template_kind = Column(ENUM(RuleKind), nullable=False)
    template_params = Column(Text)  # JSON template with placeholders
    is_active = Column(Boolean, default=True)
    usage_count = Column(Integer, default=0)
    created_by = Column(String, ForeignKey(DatabaseTableRefs.USERS_ID), nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(
        TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    creator = relationship("User")
    suggestions = relationship("RuleSuggestion", back_populates="template")


class RuleSuggestion(Base):
    __tablename__ = "rule_suggestions"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    dataset_id = Column(
        String, ForeignKey(DatabaseTableRefs.DATASETS_ID), nullable=False
    )
    template_id = Column(String, ForeignKey("rule_templates.id"), nullable=True)
    suggested_rule_name = Column(String, nullable=False)
    suggested_params = Column(Text)  # JSON with filled-in parameters
    confidence_score = Column(Integer)  # 0-100 confidence in suggestion
    # 'template_based', 'ml_based', 'statistical'
    suggestion_type = Column(String)
    reasoning = Column(Text)  # Why this rule is suggested
    is_applied = Column(Boolean, default=False)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    applied_at = Column(TIMESTAMP(timezone=True), nullable=True)
    applied_by = Column(String, ForeignKey(DatabaseTableRefs.USERS_ID), nullable=True)

    # Relationships
    dataset = relationship("Dataset")
    template = relationship("RuleTemplate", back_populates="suggestions")
    applier = relationship("User")


class MLModel(Base):
    __tablename__ = "ml_models"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    name = Column(String, nullable=False, index=True)
    # 'isolation_forest', 'one_class_svm', etc.
    model_type = Column(String, nullable=False)
    version = Column(String, nullable=False)
    model_path = Column(String)  # Path to serialized model file
    # JSON with training parameters, feature names, etc.
    model_metadata = Column(Text)
    training_dataset_id = Column(
        String, ForeignKey(DatabaseTableRefs.DATASETS_ID), nullable=True
    )
    # JSON with accuracy, precision, recall, etc.
    training_metrics = Column(Text)
    is_active = Column(Boolean, default=True)
    created_by = Column(String, ForeignKey(DatabaseTableRefs.USERS_ID), nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(
        TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    creator = relationship("User")
    anomaly_scores = relationship("AnomalyScore", back_populates="model")


class AnomalyScore(Base):
    __tablename__ = "anomaly_scores"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    execution_id = Column(
        String, ForeignKey(DatabaseTableRefs.EXECUTIONS_ID), nullable=False
    )
    model_id = Column(String, ForeignKey("ml_models.id"), nullable=False)
    row_index = Column(Integer, nullable=False)
    # 0-100, higher = more anomalous
    anomaly_score = Column(Integer, nullable=False)
    features_used = Column(Text)  # JSON list of feature names used for scoring
    # JSON with actual feature values for this row
    feature_values = Column(Text)
    # Threshold that classified this as anomaly
    threshold_used = Column(Integer)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())

    # Relationships
    execution = relationship("Execution")
    model = relationship("MLModel", back_populates="anomaly_scores")


class StatisticalMetrics(Base):
    __tablename__ = "statistical_metrics"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    dataset_version_id = Column(
        String,
        ForeignKey(DatabaseTableRefs.DATASET_VERSIONS_ID, ondelete="CASCADE"),
        nullable=False,
    )
    column_name = Column(String, nullable=False)
    # 'descriptive', 'distribution', 'correlation'
    metric_type = Column(String, nullable=False)
    # 'mean', 'std', 'skewness', etc.
    metric_name = Column(String, nullable=False)
    metric_value = Column(Integer)  # Store as integer for consistency
    additional_data = Column(Text)  # JSON for complex metrics like histograms
    computed_at = Column(TIMESTAMP(timezone=True), server_default=func.now())

    # Relationships
    dataset_version = relationship("DatasetVersion")


class DatasetProfile(Base):
    __tablename__ = "dataset_profiles"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    dataset_version_id = Column(
        String,
        ForeignKey(DatabaseTableRefs.DATASET_VERSIONS_ID, ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    profile_summary = Column(Text)  # JSON with overall dataset statistics
    column_profiles = Column(Text)  # JSON with detailed column statistics
    data_quality_score = Column(Integer)  # 0-100 overall quality score
    recommendations = Column(Text)  # JSON with rule suggestions
    profiling_version = Column(String, default="1.0")
    computed_at = Column(TIMESTAMP(timezone=True), server_default=func.now())

    # Relationships
    dataset_version = relationship("DatasetVersion")


class DebugSession(Base):
    __tablename__ = "debug_sessions"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    execution_id = Column(
        String, ForeignKey(DatabaseTableRefs.EXECUTIONS_ID), nullable=False
    )
    session_name = Column(String, nullable=False)
    debug_data = Column(Text)  # JSON with execution traces, performance data
    breakpoints = Column(Text)  # JSON with debug breakpoints
    # JSON with variable states at different points
    variable_snapshots = Column(Text)
    created_by = Column(String, ForeignKey(DatabaseTableRefs.USERS_ID), nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    is_active = Column(Boolean, default=True)

    # Relationships
    execution = relationship("Execution")
    creator = relationship("User")


class AccessRequest(Base):
    __tablename__ = "access_requests"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    organization_id = Column(String, ForeignKey(DatabaseTableRefs.ORGANIZATIONS_ID, ondelete="CASCADE"), nullable=False, index=True)
    request_type = Column(String, nullable=False)  # password_change | role_change | compartment_access | data_access
    status = Column(String, nullable=False, default="pending")  # pending | approved | rejected | cancelled
    requester_id = Column(String, ForeignKey(DatabaseTableRefs.USERS_ID, ondelete="CASCADE"), nullable=False, index=True)
    required_approver_role = Column(String, nullable=False, default="admin")
    approver_id = Column(String, ForeignKey(DatabaseTableRefs.USERS_ID, ondelete="SET NULL"), nullable=True)
    request_data = Column(Text, nullable=True)  # JSON
    reason = Column(Text, nullable=True)
    admin_notes = Column(Text, nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now())
    expires_at = Column(TIMESTAMP(timezone=True), nullable=True)
    approved_at = Column(TIMESTAMP(timezone=True), nullable=True)
    rejected_at = Column(TIMESTAMP(timezone=True), nullable=True)

    # Relationships
    organization = relationship("Organization")
    requester = relationship("User", foreign_keys=[requester_id])
    approver = relationship("User", foreign_keys=[approver_id])


class Compartment(Base):
    __tablename__ = "compartments"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    organization_id = Column(String, ForeignKey(DatabaseTableRefs.ORGANIZATIONS_ID, ondelete="CASCADE"), nullable=False, index=True)
    parent_compartment_id = Column(String, ForeignKey("compartments.id", ondelete="CASCADE"), nullable=True, index=True)
    path = Column(String, nullable=False, index=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now())
    created_by = Column(String, ForeignKey(DatabaseTableRefs.USERS_ID), nullable=False)
    is_active = Column(Boolean, default=True)

    # Relationships
    organization = relationship("Organization")
    parent = relationship("Compartment", remote_side="Compartment.id", foreign_keys=[parent_compartment_id])
    children = relationship("Compartment", foreign_keys=[parent_compartment_id], back_populates="parent")
    members = relationship("CompartmentMember", back_populates="compartment", cascade="all, delete-orphan")


class CompartmentMember(Base):
    __tablename__ = "compartment_members"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    compartment_id = Column(String, ForeignKey("compartments.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String, ForeignKey(DatabaseTableRefs.USERS_ID, ondelete="CASCADE"), nullable=False, index=True)
    role = Column(SAEnum(UserRole, name="userrole", create_type=False), nullable=False)
    inherit_from_parent = Column(Boolean, default=True)
    added_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    added_by = Column(String, ForeignKey(DatabaseTableRefs.USERS_ID), nullable=False)
    is_active = Column(Boolean, default=True)

    # Relationships
    compartment = relationship("Compartment", back_populates="members")
    user = relationship("User", foreign_keys=[user_id])
    adder = relationship("User", foreign_keys=[added_by])


class DataSource(Base):
    __tablename__ = "data_sources"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    organization_id = Column(
        String,
        ForeignKey(DatabaseTableRefs.ORGANIZATIONS_ID, ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name = Column(String, nullable=False)
    source_type = Column(
        SAEnum(DataSourceType, name="datasourcetype", values_callable=lambda o: [e.value for e in o]),
        nullable=False,
    )
    status = Column(
        SAEnum(DataSourceStatus, name="datasourcestatus", values_callable=lambda o: [e.value for e in o]),
        nullable=False,
        default=DataSourceStatus.active,
    )
    connection_params = Column(Text, nullable=False)  # JSON, credentials excluded from responses
    last_synced_at = Column(TIMESTAMP(timezone=True), nullable=True)
    last_error = Column(Text, nullable=True)
    created_by = Column(String, ForeignKey(DatabaseTableRefs.USERS_ID), nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    organization = relationship("Organization")
    creator = relationship("User", foreign_keys=[created_by])
    catalog_entries = relationship("DataCatalogEntry", back_populates="data_source", cascade="all, delete-orphan")


class DataCatalogEntry(Base):
    __tablename__ = "data_catalog_entries"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    organization_id = Column(
        String,
        ForeignKey(DatabaseTableRefs.ORGANIZATIONS_ID, ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    data_source_id = Column(
        String,
        ForeignKey("data_sources.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    schema_name = Column(String, nullable=True)
    table_name = Column(String, nullable=False)
    column_count = Column(Integer, nullable=True)
    row_estimate = Column(BigInteger, nullable=True)
    column_metadata = Column(Text, nullable=True)  # JSON array of {name, type, nullable}
    tags = Column(Text, nullable=True)  # JSON array of tag strings
    description = Column(Text, nullable=True)
    discovered_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    data_source = relationship("DataSource", back_populates="catalog_entries")
    organization = relationship("Organization")
