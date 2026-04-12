/**
 * Issue adapter — translates raw backend API shapes into the canonical
 * frontend Issue / DetailedIssue types defined in @/types/issue.
 *
 * Why this layer exists
 * ─────────────────────
 * The backend IssueResponse schema uses `message` as the field name for the
 * human-readable issue description.  In some historical serialiser versions (and
 * in other route handlers) this field was emitted as `description` instead.
 * Rather than scattering `issue.message ?? issue.description` guards across
 * every consumer, this adapter normalises the raw response **once**, so the
 * rest of the frontend always works with the canonical `message` field.
 *
 * Usage
 * ─────
 *   import { adaptIssue, adaptIssues, adaptDetailedIssue } from "@/lib/adapters/issueAdapter";
 *
 *   // In a query function:
 *   const raw = await apiClient.get<RawIssue[]>("/issues/");
 *   return adaptIssues(raw.data ?? []);
 */

import type { Issue, DetailedIssue, IssueSeverity } from "@/types/issue";

// ── Raw backend shapes ─────────────────────────────────────────────────
//
// These mirror what the backend actually sends over the wire.  They are
// intentionally permissive (index signature) so the adapter can handle both
// the current `message` field and the legacy `description` alias without
// TypeScript errors.

export interface RawIssue {
  id: string;
  execution_id: string;
  rule_id: string;
  rule_snapshot?: string;
  rule_name?: string;
  row_index: number;
  column_name: string;
  current_value?: string;
  suggested_value?: string;
  /** Primary field name used by current backend IssueResponse. */
  message?: string;
  /**
   * Legacy alias emitted by some older route handlers.
   * The adapter prefers `message` and falls back to `description`.
   */
  description?: string;
  category?: string;
  severity: string;
  created_at: string;
  resolved: boolean;
  fix_count?: number;
  dataset_name?: string;
  [key: string]: unknown;
}

export interface RawDetailedIssue {
  id: string;
  execution_id: string;
  rule?: {
    id: string;
    name: string;
    description?: string;
    kind: string;
    criticality: string;
    [key: string]: unknown;
  };
  dataset?: {
    id: string;
    name: string;
    [key: string]: unknown;
  };
  row_index: number;
  column_name: string;
  current_value?: string;
  suggested_value?: string;
  /** Primary field used by current backend. */
  message?: string;
  /** Legacy alias. */
  description?: string;
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
      [key: string]: unknown;
    };
    [key: string]: unknown;
  }>;
  [key: string]: unknown;
}

// ── Adapter functions ──────────────────────────────────────────────────

/**
 * Adapt a single raw backend issue to the canonical frontend Issue type.
 *
 * Field-name normalisation performed:
 *  - `message` — preferred; falls back to `description` if absent.
 *  - `fix_count` — defaults to 0 if the backend omits the field.
 *  - `severity` — cast to the Criticality union (values are validated
 *    at runtime by Pydantic on the backend so the cast is safe).
 */
export function adaptIssue(raw: RawIssue): Issue {
  return {
    id: raw.id,
    execution_id: raw.execution_id,
    rule_id: raw.rule_id,
    rule_snapshot: raw.rule_snapshot,
    rule_name: raw.rule_name,
    row_index: raw.row_index,
    column_name: raw.column_name,
    current_value: raw.current_value,
    suggested_value: raw.suggested_value,
    // Normalise: prefer `message`, fall back to legacy `description`
    message: raw.message ?? raw.description,
    category: raw.category,
    severity: raw.severity as IssueSeverity,
    created_at: raw.created_at,
    resolved: raw.resolved,
    fix_count: raw.fix_count ?? 0,
    dataset_name: raw.dataset_name,
  };
}

/**
 * Adapt an array of raw backend issues to canonical Issue types.
 * Filters out any nullish entries defensively.
 */
export function adaptIssues(raw: RawIssue[]): Issue[] {
  return (raw ?? []).filter(Boolean).map(adaptIssue);
}

/**
 * Adapt a single raw detailed-issue response to the canonical
 * frontend DetailedIssue type.
 *
 * Field-name normalisation performed:
 *  - `message` — preferred; falls back to `description` if absent.
 *  - Nested `rule.description` is preserved as-is (it is the rule's own
 *    description text, not the issue message).
 */
export function adaptDetailedIssue(raw: RawDetailedIssue): DetailedIssue {
  return {
    id: raw.id,
    execution_id: raw.execution_id,
    rule: raw.rule
      ? {
          id: raw.rule.id,
          name: raw.rule.name,
          description: raw.rule.description ?? "",
          kind: raw.rule.kind,
          criticality: raw.rule.criticality,
        }
      : undefined,
    dataset: raw.dataset
      ? {
          id: raw.dataset.id,
          name: raw.dataset.name,
        }
      : undefined,
    row_index: raw.row_index,
    column_name: raw.column_name,
    current_value: raw.current_value,
    suggested_value: raw.suggested_value,
    // Normalise: prefer `message`, fall back to legacy `description`
    message: raw.message ?? raw.description,
    category: raw.category,
    severity: raw.severity,
    created_at: raw.created_at,
    resolved: raw.resolved,
    fixes: raw.fixes?.map((fix) => ({
      id: fix.id,
      new_value: fix.new_value,
      comment: fix.comment,
      fixed_at: fix.fixed_at,
      fixer: fix.fixer
        ? {
            id: fix.fixer.id,
            name: fix.fixer.name,
            email: fix.fixer.email,
          }
        : undefined,
    })),
  };
}
