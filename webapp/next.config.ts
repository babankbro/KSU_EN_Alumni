import type { NextConfig } from "next";

// NFR-SEC-02 (OWASP A05) — browser-side hardening for every response.
// Scripts and styles keep 'unsafe-inline' because Next.js inlines its
// bootstrap; everything is still limited to this origin, and the page can
// never be framed. HSTS belongs on the HTTPS reverse proxy (docs/INSTALL.md).
const SECURITY_HEADERS = [
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self'",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "form-action 'self'",
      "base-uri 'self'",
      "object-src 'none'",
    ].join("; "),
  },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
];

const nextConfig: NextConfig = {
  // NFR-MNT: ship a self-contained server bundle so the Docker image stays small
  // and the university IT team can run it with plain `node server.js`.
  output: "standalone",
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
  experimental: {
    // Admin image uploads go through server actions; the default 1 MB cap
    // would reject ordinary photos. Per-purpose limits (≤ 8 MB) are enforced
    // again in src/lib/server/files.ts.
    serverActions: { bodySizeLimit: "10mb" },
  },
};

export default nextConfig;
