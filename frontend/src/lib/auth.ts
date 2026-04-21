import type { AuthOptions, Session, User } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import type { JWT } from "next-auth/jwt";
import { UserLogin, UserRole } from "@/types/api";
import { getApiUrl } from "@/lib/config";

// Import API client dynamically to avoid SSR issues
const getApiClient = async () => {
  const { default: apiClient } = await import("@/lib/api");
  return apiClient;
};

const getNextAuthSecret = () => {
  if (process.env.NODE_ENV === "production" && !process.env.NEXTAUTH_SECRET) {
    throw new Error("NEXTAUTH_SECRET must be set in production");
  }

  return process.env.NEXTAUTH_SECRET;
};

export const getAuthOptions = (): AuthOptions => ({
  secret: getNextAuthSecret(),
  debug: process.env.NODE_ENV === "development",
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: {
          label: "Email",
          type: "email",
          placeholder: "your@email.com",
        },
        password: {
          label: "Password",
          type: "password",
        },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const accountType = "personal";

        try {
          const apiClient = await getApiClient();

          const loginData: UserLogin = {
            email: credentials.email,
            password: credentials.password,
          };

          const response = await apiClient.login(loginData);

          if (response.access_token && response.user) {
            apiClient.setToken(response.access_token);

            return {
              id: response.user.id,
              email: response.user.email,
              name: response.user.name,
              role: response.user.role || response.role || "viewer",
              organizationId: response.organization?.id,
              organizationName: response.organization?.name,
              accessToken: response.access_token,
              accountType,
            };
          }

          return null;
        } catch {
          return null;
        }
      },
    }),
    CredentialsProvider({
      id: "guest",
      name: "Guest",
      credentials: {
        guest_browser_id: { type: "text" },
      },
      async authorize(credentials) {
        try {
          const body: Record<string, string> = {};
          if (credentials?.guest_browser_id) {
            body.guest_browser_id = credentials.guest_browser_id;
          }
          const res = await fetch(`${getApiUrl()}/auth/guest-login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
          if (!res.ok) return null;
          const data = await res.json();
          return {
            id: data.user_id,
            email: data.email,
            name: "Guest",
            accessToken: data.access_token,
            guestExpiresAt: data.expires_at,
            organizationId: data.organization_id,
            role: "viewer" as UserRole,
            accountType: "guest" as const,
          };
        } catch {
          return null;
        }
      },
    }),
  ],
  pages: {
    signIn: "/auth/login",
    signOut: "/auth/signout",
    error: "/auth/error",
  },
  callbacks: {
    async jwt({
      token,
      user,
    }: {
      token: JWT;
      user?: User & {
        accessToken?: string;
        guestExpiresAt?: string;
        role?: string;
        organizationId?: string;
        organizationName?: string;
        accountType?: string;
      };
    }) {
      if (user) {
        token.accessToken = user.accessToken;
        token.guestExpiresAt = user.guestExpiresAt;
        token.role = user.role;
        token.organizationId = user.organizationId;
        token.organizationName = user.organizationName;
        token.accountType = user.accountType;
      }
      return token;
    },
    async session({ session, token }: { session: Session; token: JWT }) {
      if (token.accessToken) {
        session.accessToken = token.accessToken;
        if (token.guestExpiresAt) {
          session.guestExpiresAt = token.guestExpiresAt;
        }
        if (token.role) {
          session.user.role = token.role;
        }
        if (token.organizationId) {
          session.user.organizationId = token.organizationId;
        }
        if (token.organizationName) {
          session.user.organizationName = token.organizationName;
        }
        if (token.accountType) {
          session.user.accountType = token.accountType;
        }

        // Set the token in API client on session creation (client-side only)
        if (globalThis.window !== undefined) {
          try {
            const apiClient = await getApiClient();
            apiClient.setToken(token.accessToken);
          } catch {
            // Silently fail - token will be set on next API call
          }
        }
      }
      return session;
    },
  },
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60, // 24 hours
  },
});
