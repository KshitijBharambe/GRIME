import type { NextConfig } from "next";
import path from "node:path";

const isDev = process.env.NODE_ENV !== "production";

// Temporary-but-clean tunnel toggle for local development.
// Set DEV_TUNNEL_HOST (example: "grime.kshitij.space") when developing via Cloudflare Tunnel.
// Remove this block once tunnel access is no longer needed.
const devTunnelHost = process.env.DEV_TUNNEL_HOST?.trim() ?? "";
const devTunnelOrigin = devTunnelHost ? `https://${devTunnelHost}` : "";
const isTunnelDev = isDev && devTunnelOrigin.length > 0;

if (typeof process !== "undefined" && isDev) {
  console.log("🛠️ [TUNNEL-DEBUG] isTunnelDev:", isTunnelDev);
  console.log("🛠️ [TUNNEL-DEBUG] devTunnelHost:", devTunnelHost);
  console.log("🛠️ [TUNNEL-DEBUG] NODE_ENV:", process.env.NODE_ENV);
}

const devConnectSources = isDev
  ? [
      "http://localhost:8000",
      "http://127.0.0.1:8000",
      ...(isTunnelDev
        ? [
            devTunnelOrigin,
            `ws://${devTunnelHost}`,
            `wss://${devTunnelHost}`,
            "ws://localhost:3000",
            "wss://localhost:3000",
          ]
        : []),
    ].join(" ")
  : "";

const cspScriptSources = [
  "'self'",
  "'unsafe-inline'",
  "'unsafe-eval'",
  "https://static.cloudflareinsights.com", // [TUNNEL-FIX] Always allow for debugging
].join(" ");

const cspConnectSources = [
  "'self'",
  "https:",
  "ws:",
  "wss:",
  ...(devConnectSources ? [devConnectSources] : []),
  "https://cloudflareinsights.com",
].join(" ");

const nextConfig: NextConfig = {
  output: "standalone",
  // outputFileTracingRoot: path.join(__dirname, ".."),
  // Required for external dev origins (Cloudflare Tunnel) so HMR handshakes are accepted.
  // Remove when tunnel-based development is retired.
  ...(isTunnelDev
    ? {
        allowedDevOrigins: [
          devTunnelOrigin,
          "https://grime.kshitij.space",
          "grime.kshitij.space",
        ],
      }
    : {}),
  // [TUNNEL-FIX] Proxy API calls to the backend container to avoid CORS and multi-tunnel issues.
  // This can be removed later if you use separate subdomains for API and Frontend.
  async rewrites() {
    return [
      {
        source: "/api-proxy/:path*",
        destination: "http://backend:8000/:path*",
      },
    ];
  },
  // Bundle optimization
  experimental: {
    optimizePackageImports: [
      "recharts",
      "lucide-react",
      "@radix-ui/react-icons",
      "date-fns",
    ],
  },
  // Optimize hot reload for Docker
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.watchOptions = {
        poll: 1000, // Check for changes every second
        aggregateTimeout: 300, // Delay rebuild after first change
        ignored: ["**/node_modules", "**/.next"],
      };
    }
    return config;
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          // [TUNNEL-FIX] Temporarily relaxed CSP for debugging HMR/Tunnel issues.
          // Restore to stricter version from implementation_plan when fixed.
          {
            key: "Content-Security-Policy",
            value: `default-src 'self'; script-src ${cspScriptSources}; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src *; font-src 'self' data: https:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'`,
          },
        ],
      },
    ];
  },
};

export default nextConfig;
