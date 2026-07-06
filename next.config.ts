import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite ships wasm assets that must load from node_modules at runtime —
  // keep it out of the server bundle (used only for local dev without DATABASE_URL).
  serverExternalPackages: ["@electric-sql/pglite"],
};

export default nextConfig;
