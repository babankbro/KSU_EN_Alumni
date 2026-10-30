import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // NFR-MNT: ship a self-contained server bundle so the Docker image stays small
  // and the university IT team can run it with plain `node server.js`.
  output: "standalone",
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    // Admin image uploads go through server actions; the default 1 MB cap
    // would reject ordinary photos. Per-purpose limits (≤ 8 MB) are enforced
    // again in src/lib/server/files.ts.
    serverActions: { bodySizeLimit: "10mb" },
  },
};

export default nextConfig;
