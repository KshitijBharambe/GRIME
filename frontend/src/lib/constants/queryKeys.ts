/**
 * Centralized React Query key factory.
 * All hooks should import from here to ensure cache invalidations are consistent.
 */
export const QUERY_KEYS = {
  // Datasets
  datasets: ["datasets"] as const,
  dataset: (id: string) => ["dataset", id] as const,
  datasetColumns: (id: string) => ["dataset", id, "columns"] as const,
  datasetVersions: (id: string) => ["dataset", id, "versions"] as const,
  datasetProfile: (id: string) => ["dataset", id, "profile"] as const,

  // Executions
  executions: ["executions"] as const,
  execution: (id: string) => ["execution", id] as const,
  executionSummary: (id: string) => ["execution", id, "summary"] as const,
  executionIssues: (id: string) => ["execution", id, "issues"] as const,
  executionQualityMetrics: (id: string) =>
    ["execution", id, "quality-metrics"] as const,

  // Issues
  issues: (filters?: unknown) => ["issues", filters] as const,
  issuesSummary: (days: number) => ["issues-summary", days] as const,
  issue: (id: string) => ["issue", id] as const,
  unappliedFixes: (versionId: string) =>
    ["unapplied-fixes", versionId] as const,

  // Rules
  rules: (page?: number, size?: number) => ["rules", page, size] as const,
  rule: (id: string) => ["rule", id] as const,
  ruleKinds: ["rule-kinds"] as const,
  ruleVersions: (ruleId: string) => ["rule-versions", ruleId] as const,

  // Reports / Quality
  qualitySummary: (datasetId: string) =>
    ["quality-summary", datasetId] as const,
  qualityTrends: (days: number) => ["quality-trends", days] as const,
  issuePatterns: ["issue-patterns"] as const,
  exportHistory: (datasetId: string) => ["export-history", datasetId] as const,

  // Users
  users: ["users"] as const,
  user: (id: string) => ["user", id] as const,

  // Dashboard
  dashboardOverview: ["dashboard-overview"] as const,

  // Search
  search: (query: string) => ["search", query] as const,

  // All-datasets quality (reports)
  allDatasetsQualityScores: ["all-datasets-quality-scores"] as const,

  // Exports (non-dataset-specific)
  exports: ["exports"] as const,

  // Access Requests
  pendingApprovals: ["pending-approvals"] as const,

  // Current user
  currentUser: ["currentUser"] as const,
} as const;
