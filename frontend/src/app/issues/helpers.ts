import type { Issue, IssuesSummary } from "@/types/issue";
import { isValidDate } from "@/lib/utils/date";

// ── Constants ──────────────────────────────────────────────────────────

export const ITEMS_PER_PAGE = 8;

export const SEVERITY_ORDER: Record<string, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

// ── Types ──────────────────────────────────────────────────────────────

export interface SummaryData {
  total: number;
  resolved: number;
  unresolved: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  resolutionRate: number;
  recentIssues: number;
}

// ── Pure selector / helper functions ───────────────────────────────────

export function getSeverityColor(severity: string) {
  switch (severity?.toLowerCase()) {
    case "critical":
      return "destructive" as const;
    case "high":
      return "default" as const;
    case "medium":
      return "secondary" as const;
    case "low":
      return "outline" as const;
    default:
      return "outline" as const;
  }
}

export function computeSummaryData(
  issuesSummary: IssuesSummary | undefined,
  issues: Issue[] | undefined,
): SummaryData {
  return {
    total: issuesSummary?.summary?.total_issues || issues?.length || 0,
    resolved:
      issuesSummary?.summary?.resolved_issues ||
      issues?.filter((i) => i.resolved).length ||
      0,
    unresolved:
      issuesSummary?.summary?.unresolved_issues ||
      issues?.filter((i) => !i.resolved).length ||
      0,
    critical:
      issuesSummary?.severity_distribution?.critical ||
      issues?.filter((i) => i.severity === "critical").length ||
      0,
    high:
      issuesSummary?.severity_distribution?.high ||
      issues?.filter((i) => i.severity === "high").length ||
      0,
    medium:
      issuesSummary?.severity_distribution?.medium ||
      issues?.filter((i) => i.severity === "medium").length ||
      0,
    low:
      issuesSummary?.severity_distribution?.low ||
      issues?.filter((i) => i.severity === "low").length ||
      0,
    resolutionRate: issuesSummary?.summary?.resolution_rate || 0,
    recentIssues: issuesSummary?.summary?.recent_issues || 0,
  };
}

export function extractAvailableColumns(issues: Issue[] | undefined): string[] {
  if (!issues || !Array.isArray(issues)) return [];
  const colSet = new Set<string>();
  issues.forEach((issue) => {
    if (issue.column_name) colSet.add(issue.column_name);
  });
  return Array.from(colSet).sort((a, b) => a.localeCompare(b));
}

export function filterBySearch(issues: Issue[], searchTerm: string): Issue[] {
  if (!searchTerm) return issues;
  const term = searchTerm.toLowerCase();
  return issues.filter(
    (issue) =>
      issue.rule_name?.toLowerCase().includes(term) ||
      issue.dataset_name?.toLowerCase().includes(term) ||
      issue.message?.toLowerCase().includes(term) ||
      issue.column_name?.toLowerCase().includes(term) ||
      issue.current_value?.toLowerCase().includes(term),
  );
}

export function filterByColumn(issues: Issue[], columnFilter: string): Issue[] {
  if (columnFilter === "all") return issues;
  return issues.filter((issue) => issue.column_name === columnFilter);
}

export function getDateRangeCutoff(dateRangeFilter: string): Date | null {
  if (dateRangeFilter === "all") return null;
  const now = new Date();
  switch (dateRangeFilter) {
    case "today":
      return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    case "7days":
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case "30days":
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    case "90days":
      return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    default:
      return new Date(0);
  }
}

export function filterByDateRange(
  issues: Issue[],
  dateRangeFilter: string,
): Issue[] {
  const cutoff = getDateRangeCutoff(dateRangeFilter);
  if (!cutoff) return issues;
  return issues.filter((issue) => {
    if (!isValidDate(issue.created_at)) return false;
    return new Date(issue.created_at) >= cutoff;
  });
}

export function sortIssues(issues: Issue[], sortBy: string): Issue[] {
  return [...issues].sort((a, b) => {
    switch (sortBy) {
      case "severity_high_to_low":
        return (
          (SEVERITY_ORDER[b.severity] || 0) - (SEVERITY_ORDER[a.severity] || 0)
        );
      case "severity_low_to_high":
        return (
          (SEVERITY_ORDER[a.severity] || 0) - (SEVERITY_ORDER[b.severity] || 0)
        );
      case "dataset_a_to_z":
        return (a.dataset_name || "").localeCompare(b.dataset_name || "");
      case "dataset_z_to_a":
        return (b.dataset_name || "").localeCompare(a.dataset_name || "");
      case "rule_a_to_z":
        return (a.rule_name || "").localeCompare(b.rule_name || "");
      case "rule_z_to_a":
        return (b.rule_name || "").localeCompare(a.rule_name || "");
      case "created_at_oldest": {
        const aTime = isValidDate(a.created_at)
          ? new Date(a.created_at).getTime()
          : 0;
        const bTime = isValidDate(b.created_at)
          ? new Date(b.created_at).getTime()
          : 0;
        return aTime - bTime;
      }
      case "created_at_newest":
      default: {
        const aTime = isValidDate(a.created_at)
          ? new Date(a.created_at).getTime()
          : 0;
        const bTime = isValidDate(b.created_at)
          ? new Date(b.created_at).getTime()
          : 0;
        return bTime - aTime;
      }
    }
  });
}

/**
 * Apply all filters and sorting to get the final filtered+sorted issue list.
 */
export function getFilteredAndSortedIssues(
  issues: Issue[] | undefined,
  searchTerm: string,
  columnFilter: string,
  dateRangeFilter: string,
  sortBy: string,
): Issue[] {
  let result = issues || [];
  result = filterBySearch(result, searchTerm);
  result = filterByColumn(result, columnFilter);
  result = filterByDateRange(result, dateRangeFilter);
  result = sortIssues(result, sortBy);
  return result;
}

/**
 * Paginate a list of issues.
 */
export function paginateIssues(
  issues: Issue[],
  currentPage: number,
  itemsPerPage: number = ITEMS_PER_PAGE,
) {
  const totalIssues = issues.length;
  const totalPages = Math.ceil(totalIssues / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedIssues = issues.slice(startIndex, endIndex);
  return { totalIssues, totalPages, startIndex, endIndex, paginatedIssues };
}

/**
 * Compute per-dataset issue counts, sorted descending, capped at `limit`.
 */
export function getTopProblematicDatasets(
  issues: Issue[] | undefined,
  limit: number = 5,
): Array<[string, number]> {
  const datasetCounts = (issues || []).reduce(
    (acc, issue) => {
      const dataset = issue.dataset_name?.trim() ? issue.dataset_name : null;
      if (dataset) {
        acc[dataset] = (acc[dataset] || 0) + 1;
      }
      return acc;
    },
    {} as Record<string, number>,
  );

  return Object.entries(datasetCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, limit);
}

/**
 * Badge colour class for dataset issue counts.
 */
export function getDatasetBadgeClass(count: number): string {
  if (count > 5) return "bg-red-600";
  if (count > 2) return "bg-orange-500";
  return "";
}

/**
 * Compute page numbers for the pagination control (up to `maxButtons` buttons).
 */
export function getPageNumbers(
  currentPage: number,
  totalPages: number,
  maxButtons: number = 5,
): number[] {
  const count = Math.min(maxButtons, totalPages);
  return Array.from({ length: count }, (_, i) => {
    if (totalPages <= maxButtons) return i + 1;
    if (currentPage <= 3) return i + 1;
    if (currentPage >= totalPages - 2) return totalPages - (maxButtons - 1) + i;
    return currentPage - 2 + i;
  });
}

/**
 * Extract an error message from an unknown error object.
 */
export function extractErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === "object" && "response" in error) {
    const resp = (error as { response?: { data?: { message?: string } } })
      .response;
    if (resp?.data?.message) return resp.data.message;
  }
  if (error && typeof error === "object" && "message" in error) {
    const msg = (error as { message?: string }).message;
    if (msg) return msg;
  }
  return fallback;
}
