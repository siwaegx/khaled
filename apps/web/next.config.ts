import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@business360/shared"],
  allowedDevOrigins: ["trance-carpet-circus-mill.trycloudflare.com"],
};

export default nextConfig;
