import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import type { JWT } from "next-auth/jwt";
import type { Session, User } from "next-auth";
import { UserLogin, UserRole } from "@/types/api";
import { getApiUrl } from "@/lib/config";

if (process.env.NODE_ENV === "production" && !process.env.NEXTAUTH_SECRET) {
  throw new Error("NEXTAUTH_SECRET must be set in production");
}

// Import API client dynamically to avoid SSR issues
const getApiClient = async () => {
  const { default: apiClient } = await import("@/lib/api");
  return apiClient;
};

export default NextAuth({
  secret: process.env.NEXTAUTH_SECRET,
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
        organizationId: {
          label: "Organization ID",
          type: "text",
          optional: true,
        },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const accountType = credentials.organizationId
          ? "organization"
          : "personal";

        try {
          const apiClient = await getApiClient();

          // If organizationId is provided, use it for login
          if (credentials.organizationId) {
            const loginData = {
              email: credentials.email as string,
              password: credentials.password as string,
              organization_id: credentials.organizationId as string,
            };

            const response = await apiClient.loginWithOrg(loginData);

            if (response.access_token) {
              apiClient.setToken(response.access_token);

              return {
                id: response.user?.id || "",
                email: credentials.email as string,
                name: response.user?.name || "",
                role: (response.role || "viewer") as UserRole,
                organizationId: response.organization?.id,
                organizationName: response.organization?.name,
                accessToken: response.access_token,
                accountType,
              };
            }
          } else {
            // Initial login without org - just verify credentials
            const loginData: UserLogin = {
              email: credentials.email as string,
              password: credentials.password as string,
            };

            const response = await apiClient.login(loginData);

            if (response.access_token && response.user) {
              apiClient.setToken(response.access_token);

              return {
                id: response.user.id,
                email: response.user.email,
                name: response.user.name,
                role: (response.user.role ||
                  response.role ||
                  "viewer") as UserRole,
                accessToken: response.access_token,
                accountType,
              };
            }
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
      credentials: {},
      async authorize() {
        try {
          const res = await fetch(`${getApiUrl()}/auth/guest-login`, {
            method: "POST",
          });
          if (!res.ok) return null;
          const data = await res.json();
          return {
            id: data.user_id,
            email: data.email,
            name: "Guest",
            accessToken: data.access_token,
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
        role?: string;
        organizationId?: string;
        organizationName?: string;
        accountType?: string;
      };
    }) {
      if (user) {
        token.accessToken = user.accessToken;
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
        if (typeof window !== "undefined") {
          try {
            const apiClient = await getApiClient();
            apiClient.setToken(token.accessToken as string);
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
    maxAge: 8 * 60 * 60, // 8 hours
  },
});
