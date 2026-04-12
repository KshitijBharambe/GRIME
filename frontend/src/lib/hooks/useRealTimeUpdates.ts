"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

export function useRealTimeUpdates() {
  const queryClient = useQueryClient();

  const invalidateAllData = useCallback(async () => {
    // Invalidate all data-related queries for real-time updates
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["issues"] }),
      queryClient.invalidateQueries({ queryKey: ["issues-summary"] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard-overview"] }),
      queryClient.invalidateQueries({ queryKey: ["pending-approvals"] }),
    ]);
  }, [queryClient]);

  const invalidateIssuesData = useCallback(async () => {
    // Invalidate only issues-related queries
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["issues"] }),
      queryClient.invalidateQueries({ queryKey: ["issues-summary"] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard-overview"] }), // Dashboard shows issue counts
    ]);
  }, [queryClient]);

  const invalidateDashboardData = useCallback(async () => {
    // Invalidate dashboard-related queries
    await queryClient.invalidateQueries({ queryKey: ["dashboard-overview"] });
  }, [queryClient]);

  return {
    invalidateAllData,
    invalidateIssuesData,
    invalidateDashboardData,
    queryClient,
  };
}
