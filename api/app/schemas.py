from pydantic import BaseModel, EmailStr, ConfigDict, Field
from typing import Optional, List
from datetime import datetime
from app.core.config import (
    GUEST_UPLOAD_LIMIT,
    GUEST_EXECUTION_LIMIT,
    GUEST_MAX_FILE_SIZE_BYTES,
)
from app.models import (
    UserRole,
    SourceType,
    DatasetStatus,
    Criticality,
    RuleKind,
    ExecutionStatus,
    ExportFormat,
    SharePermission,
    InviteStatus,
    AccountType,
)

# Base schemas


class BaseSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# User schemas


class UserBase(BaseModel):
    name: str
    email: EmailStr


class UserCreate(UserBase):
    password: str


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserResponse(UserBase):
    id: str
    is_active: bool
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse


class UserRoleUpdate(BaseModel):
    role: UserRole


# Organization schemas


class OrganizationBase(BaseModel):
    name: str
    contact_email: EmailStr


class OrganizationCreate(OrganizationBase):
    slug: str
    admin_name: str
    admin_email: EmailStr
    admin_password: str


class OrganizationResponse(OrganizationBase):
    id: str
    slug: str
    is_active: bool
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class OrganizationUpdate(BaseModel):
    name: Optional[str] = None
    contact_email: Optional[EmailStr] = None


# Organization Member schemas


class OrganizationMemberResponse(BaseModel):
    id: str
    organization_id: str
    user_id: str
    role: UserRole
    user_name: str
    user_email: EmailStr
    joined_at: datetime
    model_config = ConfigDict(from_attributes=True)


class MemberRoleUpdate(BaseModel):
    role: UserRole


# Organization Invite schemas


class InviteCreate(BaseModel):
    email: EmailStr
    role: UserRole


class InviteResponse(BaseModel):
    id: str
    organization_id: str
    email: EmailStr
    role: UserRole
    status: InviteStatus
    invite_token: str
    expires_at: datetime
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class AcceptInvite(BaseModel):
    invite_token: str
    name: str
    password: str


# Login & Registration schemas (organization-aware)


class OrganizationLoginRequest(BaseModel):
    email: EmailStr
    password: str
    organization_id: Optional[str] = None  # If user is in multiple orgs


class OrganizationTokenResponse(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse
    organization: OrganizationResponse
    role: UserRole
    available_organizations: List[OrganizationResponse] = Field(default_factory=list)


class SwitchOrganizationRequest(BaseModel):
    organization_id: str


# Personal & Guest auth schemas


class PersonalRegisterRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: str


class PersonalRegisterResponse(BaseModel):
    user_id: str
    email: str
    organization_id: str
    access_token: str
    token_type: str = "bearer"


class GuestLoginResponse(BaseModel):
    user_id: str
    email: str
    organization_id: str
    access_token: str
    token_type: str = "bearer"
    expires_at: str  # ISO datetime when guest session expires


class GuestUsageResponse(BaseModel):
    uploads_count: int = 0
    uploads_limit: int = GUEST_UPLOAD_LIMIT
    executions_count: int = 0
    executions_limit: int = GUEST_EXECUTION_LIMIT
    max_file_size_bytes: int = GUEST_MAX_FILE_SIZE_BYTES


# Resource Sharing schemas


class ResourceShareCreate(BaseModel):
    resource_type: str  # 'rule', 'template', etc.
    resource_id: str
    shared_with_org_id: str
    permission: SharePermission
    expires_at: Optional[datetime] = None


class ResourceShareResponse(BaseModel):
    id: str
    resource_type: str
    resource_id: str
    owner_org_id: str
    owner_org_name: str
    shared_with_org_id: str
    shared_with_org_name: str
    permission: SharePermission
    expires_at: Optional[datetime]
    created_at: datetime
    revoked_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)


# Dataset schemas


class DatasetBase(BaseModel):
    name: str
    source_type: SourceType
    notes: Optional[str] = None


class DatasetCreate(DatasetBase):
    original_filename: Optional[str] = None


class DatasetResponse(DatasetBase):
    id: str
    original_filename: Optional[str]
    checksum: Optional[str]
    uploaded_by: str
    uploaded_at: datetime
    status: DatasetStatus
    row_count: Optional[int]
    column_count: Optional[int]
    model_config = ConfigDict(from_attributes=True)


class DatasetVersionBase(BaseModel):
    version_no: int
    change_note: Optional[str] = None


class DatasetVersionCreate(DatasetVersionBase):
    pass


class DatasetVersionResponse(DatasetVersionBase):
    id: str
    dataset_id: str
    created_by: str
    created_at: datetime
    rows: Optional[int]
    columns: Optional[int]
    model_config = ConfigDict(from_attributes=True)


# Dataset Column schemas


class DatasetColumnBase(BaseModel):
    name: str
    ordinal_position: int
    inferred_type: Optional[str] = None
    is_nullable: bool = True


class DatasetColumnCreate(DatasetColumnBase):
    pass


class DatasetColumnResponse(DatasetColumnBase):
    id: str
    dataset_id: str
    model_config = ConfigDict(from_attributes=True)


# Rule schemas


class RuleBase(BaseModel):
    name: str
    description: Optional[str] = None
    kind: RuleKind
    criticality: Criticality
    is_active: bool = True
    target_table: Optional[str] = None
    target_columns: Optional[str] = None
    params: Optional[str] = None  # JSON string


class RuleCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=256)
    description: Optional[str] = Field(None, max_length=5000)
    kind: RuleKind
    criticality: Criticality
    target_columns: List[str] = Field(..., max_length=100)
    params: dict = Field(default_factory=dict)


class RuleUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=256)
    description: Optional[str] = Field(None, max_length=5000)
    kind: Optional[RuleKind] = None
    criticality: Optional[Criticality] = None
    is_active: Optional[bool] = None
    target_table: Optional[str] = Field(None, max_length=256)
    target_columns: Optional[List[str]] = Field(None, max_length=100)
    params: Optional[dict] = None


class RuleResponse(RuleBase):
    id: str
    created_by: str
    created_at: datetime
    updated_at: datetime
    version: int
    parent_rule_id: Optional[str] = None
    rule_family_id: Optional[str] = None
    is_latest: bool
    change_log: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)


# Execution schemas


class ExecutionBase(BaseModel):
    dataset_version_id: str


class ExecutionCreate(ExecutionBase):
    rule_ids: List[str]


class ExecutionResponse(ExecutionBase):
    id: str
    started_by: str
    started_at: datetime
    finished_at: Optional[datetime]
    status: ExecutionStatus
    total_rows: Optional[int]
    total_rules: Optional[int]
    rows_affected: Optional[int]
    columns_affected: Optional[int]
    total_issues: Optional[int] = None
    summary: Optional[str]  # JSON string
    model_config = ConfigDict(from_attributes=True)


# Issue schemas


class IssueBase(BaseModel):
    row_index: int
    column_name: str
    current_value: Optional[str] = None
    suggested_value: Optional[str] = None
    message: Optional[str] = None
    category: Optional[str] = None
    severity: Criticality


class IssueCreate(IssueBase):
    execution_id: str
    rule_id: str


class IssueResponse(IssueBase):
    id: str
    execution_id: str
    rule_id: str
    rule_name: Optional[str] = None
    rule_snapshot: Optional[str] = None
    created_at: datetime
    resolved: bool
    fix_count: int = 0
    dataset_name: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)


# Fix schemas


class FixBase(BaseModel):
    new_value: Optional[str] = None
    comment: Optional[str] = None


class FixCreate(FixBase):
    issue_id: str


class FixResponse(FixBase):
    id: str
    issue_id: str
    fixed_by: str
    fixed_at: datetime
    model_config = ConfigDict(from_attributes=True)


# Export schemas


class ExportBase(BaseModel):
    dataset_version_id: str
    execution_id: Optional[str] = None
    format: ExportFormat
    location: Optional[str] = None


class ExportCreate(ExportBase):
    pass


class ExportResponse(ExportBase):
    id: str
    created_by: str
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


# File upload schemas


class FileUploadResponse(BaseModel):
    message: str
    filename: str
    size: int
    dataset_id: str


class DataProfileResponse(BaseModel):
    total_rows: int
    total_columns: int
    columns: List[DatasetColumnResponse]
    data_types_summary: dict
    missing_values_summary: dict


# Report schemas


class DataQualitySummary(BaseModel):
    total_issues: int
    critical_issues: int
    high_issues: int
    medium_issues: int
    low_issues: int
    resolved_issues: int
    categories_breakdown: dict


class ExecutionSummary(BaseModel):
    execution_id: str
    dataset_name: str
    started_at: datetime
    finished_at: Optional[datetime]
    status: ExecutionStatus
    total_rules_executed: int
    issues_found: int
    data_quality_summary: DataQualitySummary


# Rule testing schemas


class RuleTestRequest(BaseModel):
    sample_data: List[dict] = Field(..., max_length=10000)


# Dataset Fixes schemas


class ApplyFixesRequest(BaseModel):
    source_version_id: str = Field(..., max_length=255)
    fix_ids: List[str]
    version_notes: Optional[str] = Field(None, max_length=2000)
    re_run_rules: bool = False


class ApplyFixesResponse(BaseModel):
    new_version: DatasetVersionResponse
    fixes_applied: int
    message: str
    model_config = ConfigDict(from_attributes=True)


class UnappliedFixResponse(BaseModel):
    fix_id: str
    issue_id: str
    row_index: int
    column_name: str
    current_value: Optional[str]
    new_value: Optional[str]
    comment: Optional[str]
    severity: str
    fixed_by: Optional[str]
    fixed_at: Optional[str]


class VersionLineageResponse(BaseModel):
    version_id: str
    version_no: int
    source: str
    created_at: Optional[str]
    created_by: Optional[str]
    change_note: Optional[str]
    rows: Optional[int]
    columns: Optional[int]


class AppliedFixResponse(BaseModel):
    fix_id: str
    issue_id: str
    row_index: int
    column_name: str
    old_value: Optional[str]
    new_value: Optional[str]
    comment: Optional[str]
    severity: str
    fixed_by: Optional[str]
    applied_at: Optional[str]


# Data Quality Metrics schemas


class QualityMetricsResponse(BaseModel):
    execution_id: str
    dataset_version_id: str
    dqi: float
    clean_rows_pct: float
    hybrid: float
    status: str  # "ok" or "not_available"
    message: Optional[str] = None
    computed_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)
