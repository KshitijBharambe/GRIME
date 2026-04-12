import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "@/lib/api";
import { useAuthenticatedApi } from "./useAuthenticatedApi";
import { QUERY_KEYS } from "@/lib/constants/queryKeys";
import {
  REALTIME_REFETCH_INTERVAL,
  REALTIME_STALE_TIME,
  MAX_QUERY_RETRIES,
  DEFAULT_ISSUES_LIMIT,
} from "@/lib/constants";
import type { Issue, DetailedIssue, IssuesSummary, UnappliedFix } from "@/types/issue";
import type { ApplyFixesResponse } from "@/types/api";
import {
  adaptIssues,
  adaptDetailedIssue,
  type RawIssue,
  type RawDetailedIssue,
} from "@/lib/adapters/issueAdapter";

// Re-export canonical types for backward compatibility — consumers that
// previously imported from this hook can continue to do so.
export type {
  Issue,
  DetailedIssue,
  IssuesSummary,
  UnappliedFix,
} from "@/types/issue";
export type { DatasetVersion, ApplyFixesResponse } from "@/types/api";

export function useIssues(filters?: {
  severity?: string;
  resolved?: boolean;
  rule_id?: string;
  dataset_id?: string;
  execution_id?: string;
  limit?: number;
  offset?: number;
}) {
  const { isAuthenticated, hasToken } = useAuthenticatedApi();

  return useQuery<Issue[]>({
    queryKey: QUERY_KEYS.issues(filters),
    queryFn: async () => {
      try {
        // Use direct API call to /issues endpoint with proper parameters
        const params: Record<string, unknown> = {};

        if (filters?.severity) params.severity = filters.severity;
        if (filters?.resolved !== undefined) params.resolved = filters.resolved;
        if (filters?.rule_id) params.rule_id = filters.rule_id;
        if (filters?.dataset_id) params.dataset_id = filters.dataset_id;
        if (filters?.execution_id) params.execution_id = filters.execution_id;
        params.limit = filters?.limit || DEFAULT_ISSUES_LIMIT;
        params.offset = filters?.offset || 0;

        const response = await apiClient.get<RawIssue[]>("/issues/", { params });
        // Run raw backend response through adapter to normalise field names
        // (e.g. `message` vs legacy `description`).
        return adaptIssues(response.data ?? []);
      } catch {
        throw new Error("Failed to fetch issues");
      }
    },
    enabled: isAuthenticated && hasToken,
    refetchInterval: REALTIME_REFETCH_INTERVAL,
    staleTime: REALTIME_STALE_TIME,
    retry: (failureCount) => failureCount < MAX_QUERY_RETRIES,
  });
}

export function useIssuesSummary(days: number = 30) {
  const { isAuthenticated, hasToken } = useAuthenticatedApi();

  return useQuery<IssuesSummary>({
    queryKey: QUERY_KEYS.issuesSummary(days),
    queryFn: async () => {
      try {
        const response = await apiClient.get<IssuesSummary>(
          `/issues/statistics/summary?days=${days}`,
        );
        return response.data;
      } catch {
        throw new Error("Failed to fetch issues summary");
      }
    },
    enabled: isAuthenticated && hasToken,
    refetchInterval: REALTIME_REFETCH_INTERVAL,
    staleTime: REALTIME_STALE_TIME,
    retry: (failureCount) => failureCount < MAX_QUERY_RETRIES,
  });
}

export function useIssue(issueId: string) {
  const { isAuthenticated, hasToken } = useAuthenticatedApi();

  return useQuery<DetailedIssue>({
    queryKey: QUERY_KEYS.issue(issueId),
    queryFn: async () => {
      try {
        const response = await apiClient.get<RawDetailedIssue>(
          `/issues/${issueId}/`,
        );
        // Run raw backend response through adapter to normalise field names
        // (e.g. `message` vs legacy `description`).
        return adaptDetailedIssue(response.data);
      } catch {
        throw new Error("Failed to fetch issue details");
      }
    },
    enabled: isAuthenticated && hasToken && !!issueId,
    staleTime: REALTIME_STALE_TIME,
    retry: (failureCount) => failureCount < MAX_QUERY_RETRIES,
  });
}

export async function createFix(
  issueId: string,
  fixData: {
    new_value?: string;
    comment?: string;
  },
) {
  const response = await apiClient.post(`/issues/${issueId}/fix`, fixData);
  return response.data;
}

export async function resolveIssue(issueId: string) {
  const response = await apiClient.patch(`/issues/${issueId}/resolve`);
  return response.data;
}

export async function unresolveIssue(issueId: string) {
  const response = await apiClient.patch(`/issues/${issueId}/unresolve`);
  return response.data;
}

// Mutation hooks for better state management
export function useCreateFixMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      issueId,
      fixData,
    }: {
      issueId: string;
      fixData: { new_value?: string; comment?: string };
    }) => createFix(issueId, fixData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["issues"] });
      queryClient.invalidateQueries({ queryKey: ["issues-summary"] });
      queryClient.invalidateQueries({ queryKey: ["issue"] });
    },
  });
}

export function useResolveIssueMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (issueId: string) => resolveIssue(issueId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["issues"] });
      queryClient.invalidateQueries({ queryKey: ["issues-summary"] });
      queryClient.invalidateQueries({ queryKey: ["issue"] });
    },
  });
}

export function useUnresolveIssueMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (issueId: string) => unresolveIssue(issueId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["issues"] });
      queryClient.invalidateQueries({ queryKey: ["issues-summary"] });
      queryClient.invalidateQueries({ queryKey: ["issue"] });
    },
  });
}

// Fetch unapplied fixes for a dataset version
export function useUnappliedFixes(versionId: string) {
  const { isAuthenticated, hasToken } = useAuthenticatedApi();

  return useQuery<UnappliedFix[]>({
    queryKey: QUERY_KEYS.unappliedFixes(versionId),
    queryFn: async () => {
      try {
        const response = await apiClient.get<UnappliedFix[]>(
          `/processing/datasets/versions/${versionId}/unapplied-fixes`,
        );
        return response.data || [];
      } catch {
        throw new Error("Failed to fetch unapplied fixes");
      }
    },
    enabled: isAuthenticated && hasToken && !!versionId,
    staleTime: REALTIME_STALE_TIME,
  });
}

// Apply fixes to create a new dataset version
export async function applyFixesToDataset(
  datasetId: string,
  requestData: {
    source_version_id: string;
    fix_ids: string[];
    version_notes?: string;
    re_run_rules?: boolean;
  },
) {
  const response = await apiClient.post<ApplyFixesResponse>(
    `/processing/datasets/${datasetId}/versions/apply-fixes`,
    requestData,
  );
  return response.data;
}

// Mutation hook for applying fixes
export function useApplyFixesMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      datasetId,
      requestData,
    }: {
      datasetId: string;
      requestData: {
        source_version_id: string;
        fix_ids: string[];
        version_notes?: string;
        re_run_rules?: boolean;
      };
    }) => applyFixesToDataset(datasetId, requestData),
    onSuccess: () => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ["issues"] });
      queryClient.invalidateQueries({ queryKey: ["issues-summary"] });
      queryClient.invalidateQueries({ queryKey: ["datasets"] });
      queryClient.invalidateQueries({ queryKey: ["unapplied-fixes"] });
    },
  });
}
