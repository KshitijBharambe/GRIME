"use client";

import { SessionProvider, signOut, useSession } from "next-auth/react";
import { ReactNode, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import apiClient from "@/lib/api";

const FORCE_SIGNOUT_EVENT = "app:force-signout";

function isPublicPath(pathname: string) {
  return pathname === "/" || pathname.startsWith("/auth");
}

function AuthSessionGuard() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (status === "loading" || !pathname) {
      return;
    }

    if (status === "unauthenticated" && !isPublicPath(pathname)) {
      router.replace("/auth/login");
    }
  }, [pathname, router, status]);

  useEffect(() => {
    if (status !== "authenticated") {
      return;
    }

    const accountType = session?.user?.accountType;
    if (accountType !== "guest") {
      return;
    }

    const expiry = session?.guestExpiresAt;
    if (!expiry) {
      return;
    }

    const expiresAt = new Date(expiry).getTime();
    if (Number.isNaN(expiresAt)) {
      return;
    }

    const msUntilExpiry = expiresAt - Date.now();
    if (msUntilExpiry <= 0) {
      window.dispatchEvent(
        new CustomEvent(FORCE_SIGNOUT_EVENT, {
          detail: { reason: "guest-expired", source: "timer" },
        }),
      );
      return;
    }

    const timerId = window.setTimeout(() => {
      window.dispatchEvent(
        new CustomEvent(FORCE_SIGNOUT_EVENT, {
          detail: { reason: "guest-expired", source: "timer" },
        }),
      );
    }, msUntilExpiry);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [session?.guestExpiresAt, session?.user?.accountType, status]);

  useEffect(() => {
    const onForceSignout = async () => {
      apiClient.clearToken();

      try {
        await signOut({ redirect: false });
      } finally {
        router.replace("/auth/login");
      }
    };

    window.addEventListener(FORCE_SIGNOUT_EVENT, onForceSignout);
    return () => {
      window.removeEventListener(FORCE_SIGNOUT_EVENT, onForceSignout);
    };
  }, [router]);

  return null;
}

interface AuthProviderProps {
  readonly children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  return (
    <SessionProvider>
      <AuthSessionGuard />
      {children}
    </SessionProvider>
  );
}
