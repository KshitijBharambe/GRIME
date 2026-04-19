// User types
export type UserRole = "owner" | "admin" | "analyst" | "viewer";

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

export interface UserCreate {
  name: string;
  email: string;
  role: UserRole;
  password: string;
}

export interface UserLogin {
  email: string;
  password: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: User;
  organization?: Organization;
  role?: UserRole;
  available_organizations?: Organization[];
}

// Organization types
export interface Organization {
  id: string;
  name: string;
  slug: string;
  contact_email: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface OrganizationCreate {
  name: string;
  slug: string;
  contact_email: string;
  admin_name: string;
  admin_email: string;
  admin_password: string;
}

export interface OrganizationMember {
  id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  role: UserRole;
  joined_at: string;
}

export interface OrganizationInvite {
  id: string;
  email: string;
  role: UserRole;
  status: "pending" | "accepted" | "expired" | "revoked";
  created_at: string;
  expires_at: string;
}

export interface OrganizationUpdateData {
  name?: string;
  contact_email?: string;
}

export interface SwitchOrganizationResponse {
  access_token: string;
  organization_id: string;
  organization_name: string;
  role: UserRole;
}

// Dataset types
export type SourceType = "csv" | "excel" | "sap" | "ms_dynamics" | "other";
export type DatasetStatus =
  | "uploaded"
  | "profiled"
  | "validated"
  | "cleaned"
  | "exported";

export interface Dataset {
  id: string;
  name: string;
  source_type: SourceType;
  original_filename?: string;
  checksum?: string;
  uploaded_by: string;
  uploaded_at: string;
  status: DatasetStatus;
  row_count?: number;
  column_count?: number;
  notes?: string;
}

export interface DatasetCreate {
  name: string;
  source_type: SourceType;
  original_filename?: string;
  notes?: string;
}

export interface DatasetVersion {
  id: string;
  dataset_id: string;
  version_no: number;
  created_by: string;
  created_at: string;
  rows?: number;
  columns?: number;
  change_note?: string;
  parent_version_id?: string;
  source?: string;
  file_path?: string;
}

export interface DatasetColumn {
  id: string;
  dataset_id: string;
  name: string;
  ordinal_position: number;
  inferred_type?: string;
  is_nullable: boolean;
}

// Rule types
export type RuleKind =
  | "missing_data"
  | "standardization"
  | "value_list"
  | "length_range"
  | "cross_field"
  | "char_restriction"
  | "regex"
  | "custom";
export type Criticality = "low" | "medium" | "high" | "critical";

export interface Rule {
  id: string;
  name: string;
  description?: string;
  kind: RuleKind;
  criticality: Criticality;
  is_active: boolean;
  target_table?: string;
  target_columns?: string;
  params?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  version?: number;
  parent_rule_id?: string;
  rule_family_id?: string;
  is_latest?: boolean;
  change_log?: string | null;
}

export interface RuleCreate {
  name: string;
  description?: string;
  kind: RuleKind;
  criticality: Criticality;
  target_columns: string[];
  params?: Record<string, unknown>;
}

export interface RuleUpdate {
  name?: string;
  description?: string;
  kind?: RuleKind;
  criticality?: Criticality;
  is_active?: boolean;
  target_table?: string;
  target_columns?: string[];
  params?: Record<string, unknown> | null;
}

// Execution types
export type ExecutionStatus =
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "partially_succeeded";

export interface Execution {
  id: string;
  dataset_version_id: string;
  started_by: string;
  started_at: string;
  finished_at?: string;
  status: ExecutionStatus;
  total_rows?: number;
  total_rules?: number;
  rows_affected?: number;
  columns_affected?: number;
  total_issues?: number;
  summary?: string;
}

export interface ExecutionCreate {
  dataset_version_id: string;
  rule_ids: string[];
}

// Issue types — canonical definitions live in @/types/issue.
// Re-exported here so existing imports of `@/types/api` continue to work.
export type {
  Issue,
  IssueCreate,
  DetailedIssue,
  IssuesSummary,
  UnappliedFix,
} from "./issue";

export interface ApplyFixesResponse {
  new_version: DatasetVersion;
  fixes_applied: number;
  message: string;
}

// Fix types
export interface Fix {
  id: string;
  issue_id: string;
  fixed_by: string;
  fixed_at: string;
  new_value?: string;
  comment?: string;
}

export interface FixCreate {
  issue_id: string;
  new_value?: string;
  comment?: string;
}

// Export types
export type ExportFormat = "csv" | "excel" | "json" | "api" | "datalake";

export interface Export {
  id: string;
  dataset_version_id: string;
  execution_id?: string;
  format: ExportFormat;
  location?: string;
  created_by: string;
  created_at: string;
}

export interface ExportCreate {
  dataset_version_id: string;
  execution_id?: string;
  format: ExportFormat;
  location?: string;
}

// File upload types
export interface FileUploadResponse {
  message: string;
  filename: string;
  size: number;
  dataset_id: string;
}

export interface DataProfileResponse {
  total_rows: number;
  total_columns: number;
  columns: DatasetColumn[];
  data_types_summary: Record<string, unknown>;
  missing_values_summary: Record<string, unknown>;
}

// Report types
export interface DataQualitySummary {
  total_issues: number;
  critical_issues: number;
  high_issues: number;
  medium_issues: number;
  low_issues: number;
  resolved_issues: number;
  categories_breakdown: Record<string, number>;
}

export interface ExecutionSummary {
  execution_id: string;
  status: string;
  total_rules: number;
  total_rows: number;
  rows_affected: number;
  columns_affected: number;
  total_issues: number;
  issues_by_severity: Record<string, number>;
  issues_by_category: Record<string, number>;
  issues_by_rule: Record<string, number>;
  rule_performance: Array<{
    rule_id: string;
    error_count: number;
    rows_flagged: number;
    cols_flagged: number;
    note?: string;
  }>;
  started_at: string;
  finished_at?: string;
  duration_seconds?: number;
}

// Rule testing types
export interface RuleTestRequest {
  sample_data: Record<string, unknown>[];
}

// API response wrapper
export interface ApiResponse<T> {
  data?: T;
  message?: string;
  error?: string;
}

// Pagination
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

// Dashboard types
export interface DashboardOverview {
  overview: {
    total_datasets: number;
    total_executions: number;
    total_issues: number;
    total_fixes: number;
    avg_dqi: number;
    avg_clean_rows_pct: number;
    avg_hybrid: number;
    issues_fixed_rate: number;
  };
  recent_activity: {
    recent_datasets: Array<{
      id: string;
      name: string;
      status: DatasetStatus;
      uploaded_at: string;
    }>;
    recent_executions: Array<{
      id: string;
      dataset_version_id: string;
      status: ExecutionStatus;
      issues_found: number;
      created_at: string;
    }>;
  };
  statistics: {
    dataset_status_distribution: Record<string, number>;
    quality_score_distribution: {
      excellent: number;
      good: number;
      fair: number;
      poor: number;
    };
  };
}

// Quality Metrics types
export type QualityMetricsStatus = "ok" | "not_available";

export interface QualityMetrics {
  execution_id: string;
  dataset_version_id: string;
  dqi: number;
  clean_rows_pct: number;
  hybrid: number;
  status: QualityMetricsStatus;
  message: string | null;
  computed_at: string;
}

// Compartment types (IAM)
export interface Compartment {
  id: string;
  name: string;
  description?: string;
  organization_id: string;
  parent_compartment_id?: string;
  path: string;
  created_at: string;
  updated_at: string;
  created_by: string;
  is_active: boolean;
  children?: Compartment[];
}

export interface CompartmentCreate {
  name: string;
  description?: string;
  parent_compartment_id?: string;
}

export interface CompartmentUpdate {
  name?: string;
  description?: string;
  parent_compartment_id?: string;
}

export interface CompartmentMember {
  id: string;
  compartment_id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  role: UserRole;
  inherit_from_parent: boolean;
  added_at: string;
  added_by: string;
  is_active: boolean;
}

export interface CompartmentMemberCreate {
  user_email: string;
  user_id?: string;
  role: UserRole;
  inherit_from_parent?: boolean;
}

// Access Request types
export type RequestType =
  | "password_change"
  | "role_change"
  | "compartment_access"
  | "data_access";
export type RequestStatus = "pending" | "approved" | "rejected" | "cancelled";

export interface AccessRequest {
  id: string;
  organization_id: string;
  request_type: RequestType;
  status: RequestStatus;
  requester_id: string;
  requester_name?: string;
  requester_email?: string;
  required_approver_role: UserRole;
  approver_id?: string;
  approver_name?: string;
  approved_at?: string;
  rejected_at?: string;
  request_data?: string; // JSON string
  reason?: string;
  admin_notes?: string;
  created_at: string;
  updated_at: string;
  expires_at?: string;
}

export interface PasswordChangeRequest {
  reason?: string;
  new_password: string;
}

export interface AccessRequestApproval {
  admin_notes?: string;
}

export interface AccessRequestCreate {
  request_type: RequestType;
  reason?: string;
  request_data?: Record<string, unknown>;
}

// Account types for multi-auth support
export type AccountType = "personal" | "organization" | "guest";

export interface GuestLoginResponse {
  user_id: string;
  email: string;
  organization_id: string;
  access_token: string;
  token_type: string;
  expires_at: string;
}

export interface PersonalRegisterRequest {
  email: string;
  password: string;
  full_name: string;
}

export interface PersonalRegisterResponse {
  user_id: string;
  email: string;
  organization_id: string;
  access_token: string;
  token_type: string;
}

// Data Source types

export type DataSourceType = "postgresql" | "mysql" | "snowflake" | "s3_csv" | "local_simulator";
export type DataSourceStatus = "active" | "inactive" | "error";

export interface DataSource {
  id: string;
  organization_id: string;
  name: string;
  source_type: DataSourceType;
  status: DataSourceStatus;
  last_synced_at?: string;
  last_error?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface DataSourceCreate {
  name: string;
  source_type: DataSourceType;
  connection_params: Record<string, unknown>;
}

export interface DataSourceUpdate {
  name?: string;
  connection_params?: Record<string, unknown>;
}

export interface DataSourceTestResult {
  success: boolean;
  message: string;
  latency_ms?: number;
}

export interface CatalogColumnMeta {
  name: string;
  type: string;
  nullable: boolean;
}

export interface DataCatalogEntry {
  id: string;
  organization_id: string;
  data_source_id: string;
  schema_name?: string;
  table_name: string;
  column_count?: number;
  row_estimate?: number;
  column_metadata?: CatalogColumnMeta[];
  tags?: string[];
  description?: string;
  discovered_at: string;
  updated_at: string;
}

export interface CatalogImportRequest {
  catalog_entry_id: string;
  dataset_name?: string;
  row_limit?: number;
}

export interface CatalogImportResult {
  dataset_id: string;
  dataset_version_id: string;
  dataset_name: string;
  rows: number;
  columns: number;
}
