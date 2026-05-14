import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  transpilePackages: ["@business360/shared"],
  allowedDevOrigins: ["trance-carpet-circus-mill.trycloudflare.com"],
};

export default nextConfig;
