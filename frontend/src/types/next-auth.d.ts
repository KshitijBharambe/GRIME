import { DefaultSession, DefaultUser } from "next-auth";
import { AccountType, UserRole } from "./api";

declare module "next-auth" {
  interface Session {
    accessToken?: string;
    guestExpiresAt?: string;
    user: {
      role: UserRole;
      organizationId?: string;
      organizationName?: string;
      accountType?: AccountType;
    } & DefaultSession["user"];
  }

  interface User extends DefaultUser {
    role: UserRole;
    accessToken?: string;
    guestExpiresAt?: string;
    organizationId?: string;
    organizationName?: string;
    accountType?: AccountType;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string;
    guestExpiresAt?: string;
    role?: UserRole;
    organizationId?: string;
    organizationName?: string;
    accountType?: AccountType;
  }
}
