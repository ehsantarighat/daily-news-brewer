import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['web-push'],
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: false },
};

export default nextConfig;
