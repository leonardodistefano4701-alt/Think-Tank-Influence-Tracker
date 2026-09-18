import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The Dockerfile runs the standalone server (`node server.js`) on Railway.
  output: "standalone",

  // better-sqlite3 is a native addon: it must not be bundled.
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
