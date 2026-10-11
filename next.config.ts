import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  cacheComponents: true,
  serverExternalPackages: ["@cursor/sdk"],
};

export default nextConfig;
