"use client";

import { useQuery } from "@tanstack/react-query";
import apiClient from "@/lib/api";
import { useAuthenticatedApi } from "./useAuthenticatedApi";
import { QUERY_KEYS } from "@/lib/constants/queryKeys";
import {
  REALTIME_REFETCH_INTERVAL,
  REALTIME_STALE_TIME,
  MAX_QUERY_RETRIES,
} from "@/lib/constants";
import { useSession } from "next-auth/react";

export function usePendingRequestsCount() {
  const { isAuthenticated, hasToken } = useAuthenticatedApi();
  const { data: session } = useSession();
  const role = session?.user?.role;
  const isAdminOrOwner = role === "admin" || role === "owner";

  const { data: count = 0 } = useQuery<number>({
    queryKey: QUERY_KEYS.pendingApprovals,
    queryFn: async () => {
      const requests = await apiClient.getPendingApprovals();
      return requests.length;
    },
    enabled: isAuthenticated && hasToken && isAdminOrOwner,
    refetchInterval: REALTIME_REFETCH_INTERVAL,
    staleTime: REALTIME_STALE_TIME,
    retry: (failureCount) => failureCount < MAX_QUERY_RETRIES,
  });

  return count;
}
