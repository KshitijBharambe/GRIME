import { NextRequest, NextResponse } from "next/server";

const API_URL =
  process.env.INTERNAL_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:8000";

export async function GET(request: NextRequest) {
  try {
    const authorization = request.headers.get("authorization");

    if (!authorization) {
      return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
    }

    const response = await fetch(`${API_URL}/auth/organizations`, {
      headers: {
        Authorization: authorization,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    const text = await response.text();

    if (!response.ok) {
      let errorDetail = "Failed to fetch organizations";
      try {
        const parsed = JSON.parse(text) as { detail?: string };
        if (parsed?.detail) {
          errorDetail = parsed.detail;
        }
      } catch {
        // Keep generic detail when backend payload is not JSON.
      }

      return NextResponse.json(
        { detail: errorDetail },
        { status: response.status },
      );
    }

    return new NextResponse(text, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch {
    return NextResponse.json({ detail: "Network error" }, { status: 502 });
  }
}
