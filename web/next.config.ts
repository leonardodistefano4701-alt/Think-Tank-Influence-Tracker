import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // better-sqlite3 is a native addon: it must not be bundled.
  serverExternalPackages: ["better-sqlite3"],

  // The SQLite file is read at runtime through a computed path, so the tracer
  // cannot infer it. Without this it is absent from the serverless bundle and
  // every page fails to open the database.
  outputFileTracingIncludes: {
    "/**": ["./data/ttit.db"],
  },
};

export default nextConfig;
