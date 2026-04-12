"use client";

import { useQuery } from "@tanstack/react-query";
import apiClient from "@/lib/api";
import { DashboardOverview } from "@/types/api";
import { useAuthenticatedApi } from "./useAuthenticatedApi";
import { QUERY_KEYS } from "@/lib/constants/queryKeys";
import { REALTIME_REFETCH_INTERVAL, REALTIME_STALE_TIME, MAX_QUERY_RETRIES } from "@/lib/constants";

export function useDashboardOverview() {
  const { isAuthenticated, hasToken } = useAuthenticatedApi();

  return useQuery<DashboardOverview>({
    queryKey: QUERY_KEYS.dashboardOverview,
    queryFn: async () => {
      try {
        const result = await apiClient.getDashboardOverview();
        return result;
      } catch {
        throw new Error("Failed to fetch dashboard overview");
      }
    },
    enabled: isAuthenticated && hasToken,
    refetchInterval: REALTIME_REFETCH_INTERVAL,
    staleTime: REALTIME_STALE_TIME,
    retry: (failureCount) => failureCount < MAX_QUERY_RETRIES,
  });
}
