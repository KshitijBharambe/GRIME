import { DefaultSession, DefaultUser } from "next-auth";
import { AccountType, UserRole } from "./api";

declare module "next-auth" {
  interface Session {
    accessToken?: string;
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
    organizationId?: string;
    organizationName?: string;
    accountType?: AccountType;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string;
    role?: UserRole;
    organizationId?: string;
    organizationName?: string;
    accountType?: AccountType;
  }
}
