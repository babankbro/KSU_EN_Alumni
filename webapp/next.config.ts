import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // NFR-MNT: ship a self-contained server bundle so the Docker image stays small
  // and the university IT team can run it with plain `node server.js`.
  output: "standalone",
  reactStrictMode: true,
  poweredByHeader: false,
};

export default nextConfig;
