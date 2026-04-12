import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

const GUEST_RESTRICTED_PATTERNS = [
  "/settings",
  "/admin",
  "/organization/settings",
  "/invite",
  "/members",
];

export default withAuth(
  function proxy(req) {
    const token = req.nextauth.token;
    if (token?.accountType === "guest") {
      const pathname = req.nextUrl.pathname;
      const isRestricted = GUEST_RESTRICTED_PATTERNS.some(
        (pattern) => pathname === pattern || pathname.startsWith(pattern + "/"),
      );
      if (isRestricted) {
        const url = req.nextUrl.clone();
        url.pathname = "/dashboard";
        url.searchParams.set("restricted", "guest");
        return NextResponse.redirect(url);
      }
    }
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
    pages: {
      signIn: "/auth/login",
      signOut: "/auth/signout",
      error: "/auth/error",
    },
  },
);

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/data/:path*",
    "/rules/:path*",
    "/executions/:path*",
    "/issues/:path*",
    "/reports/:path*",
    "/admin/:path*",
    "/search/:path*",
    "/settings/:path*",
    "/organization/:path*",
  ],
};
