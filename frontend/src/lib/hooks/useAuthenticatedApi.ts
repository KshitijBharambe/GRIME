"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import apiClient from "@/lib/api";

const FORCE_SIGNOUT_EVENT = "app:force-signout";

/**
 * Hook to ensure API client is authenticated with current session token
 */
export function useAuthenticatedApi() {
  const { data: session, status } = useSession();
  const [tokenSynced, setTokenSynced] = useState(false);

  useEffect(() => {
    if (status === "authenticated" && session?.accessToken) {
      // Set token in API client whenever session updates
      apiClient.setToken(session.accessToken as string);
      setTokenSynced(true);
    } else if (status === "authenticated" && !session?.accessToken) {
      // Strict mode: authenticated UI state without token should not access protected APIs
      apiClient.clearToken();
      setTokenSynced(false);
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent(FORCE_SIGNOUT_EVENT, {
            detail: { reason: "missing-token", source: "useAuthenticatedApi" },
          }),
        );
      }
    } else if (status === "unauthenticated") {
      // Clear token if user is not authenticated
      apiClient.clearToken();
      setTokenSynced(false);
    } else {
      // Status is 'loading'
      setTokenSynced(false);
    }
  }, [session?.accessToken, status]);

  return {
    isAuthenticated: status === "authenticated",
    isLoading: status === "loading",
    hasToken: !!session?.accessToken && tokenSynced,
  };
}
