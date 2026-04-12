/**
 * Centralized API configuration
 * Update this URL when the API endpoint changes
 */

export function getApiUrl(): string {
  const publicApiUrl = process.env.NEXT_PUBLIC_API_URL;

  // Server-side (Next.js API routes/server components)
  if (typeof window === "undefined") {
    if (process.env.INTERNAL_API_URL) {
      return process.env.INTERNAL_API_URL;
    }

    if (publicApiUrl) {
      return publicApiUrl;
    }

    if (process.env.NODE_ENV === "development" && !process.env.VERCEL) {
      return "http://localhost:8000";
    }

    throw new Error(
      "API URL is not configured. Set INTERNAL_API_URL or NEXT_PUBLIC_API_URL.",
    );
  }

  if (publicApiUrl) {
    return publicApiUrl;
  }

  // Development fallback only.
  if (
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1"
  ) {
    return "http://localhost:8000";
  }

  throw new Error("API URL is not configured. Set NEXT_PUBLIC_API_URL.");
}
