/**
 * Canonical Issue types for the frontend.
 *
 * All issue-related types are defined here as the single source of truth.
 * Other files (types/api.ts, hooks/useIssues.ts, etc.) re-export from here
 * rather than defining their own versions.
 *
 * Backend field name → frontend field name mapping is handled by the adapter
 * at frontend/src/lib/adapters/issueAdapter.ts.
 *
 * Note: `Criticality` is intentionally redefined here (not imported from
 * types/api.ts) to avoid a circular dependency — types/api.ts re-exports
 * from this file.  Both definitions must remain in sync.
 */

/**
 * Severity / criticality levels used for issues, rules, and related entities.
 * Keep in sync with the `Criticality` export in types/api.ts.
 */
export type IssueSeverity = "low" | "medium" | "high" | "critical";

// ── Core Issue type ────────────────────────────────────────────────────

/**
 * Represents a single data-quality issue returned by the /issues/ list endpoint.
 *
 * Frontend canonical field: `message`
 * Backend field (IssueBase / IssueResponse): `message`
 *
 * The adapter (issueAdapter.ts) normalises both `message` and the legacy
 * `description` alias that some backend serialisers emit, so consumers of
 * this type never need to handle the raw backend shape.
 */
export interface Issue {
  id: string;
  execution_id: string;
  rule_id: string;
  rule_snapshot?: string;
  rule_name?: string;
  row_index: number;
  column_name: string;
  current_value?: string;
  suggested_value?: string;
  /** Normalised from backend `message` (or legacy `description`) field. */
  message?: string;
  category?: string;
  severity: IssueSeverity;
  created_at: string;
  resolved: boolean;
  fix_count: number;
  dataset_name?: string;
}

// ── IssueCreate ────────────────────────────────────────────────────────

export interface IssueCreate {
  execution_id: string;
  rule_id: string;
  row_index: number;
  column_name: string;
  current_value?: string;
  suggested_value?: string;
  message?: string;
  category?: string;
  severity: IssueSeverity;
}

// ── DetailedIssue ──────────────────────────────────────────────────────

/**
 * Detailed issue shape returned by the /issues/{id} endpoint.
 * Includes nested rule and dataset objects as well as the fixes list.
 */
export interface DetailedIssue {
  id: string;
  execution_id: string;
  rule?: {
    id: string;
    name: string;
    description: string;
    kind: string;
    criticality: string;
  };
  dataset?: {
    id: string;
    name: string;
  };
  row_index: number;
  column_name: string;
  current_value?: string;
  suggested_value?: string;
  /** Normalised from backend `message` (or legacy `description`) field. */
  message?: string;
  category?: string;
  severity: string;
  created_at: string;
  resolved: boolean;
  fixes?: Array<{
    id: string;
    new_value?: string;
    comment?: string;
    fixed_at: string;
    fixer?: {
      id: string;
      name: string;
      email: string;
    };
  }>;
}

// ── IssuesSummary ──────────────────────────────────────────────────────

export interface IssuesSummary {
  summary: {
    total_issues: number;
    recent_issues: number;
    resolved_issues: number;
    unresolved_issues: number;
    resolution_rate: number;
  };
  severity_distribution: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  trends: {
    analysis_period_days: number;
    issues_by_day: Record<string, number>;
  };
  top_problematic_rules: Array<{
    rule_name: string;
    rule_kind: string;
    issue_count: number;
  }>;
}

// ── UnappliedFix ───────────────────────────────────────────────────────

export interface UnappliedFix {
  fix_id: string;
  issue_id: string;
  row_index: number;
  column_name: string;
  current_value?: string;
  new_value?: string;
  comment?: string;
  severity: string;
  fixed_by?: string;
  fixed_at?: string;
}
