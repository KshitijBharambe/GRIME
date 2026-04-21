import NextAuth from "next-auth";
import type { NextRequest } from "next/server";
import { getAuthOptions } from "@/lib/auth";

type RouteHandlerContext = {
  params: Promise<{
    nextauth: string[];
  }>;
};

export function GET(request: NextRequest, context: RouteHandlerContext) {
  return NextAuth(request, context, getAuthOptions());
}

export function POST(request: NextRequest, context: RouteHandlerContext) {
  return NextAuth(request, context, getAuthOptions());
}
