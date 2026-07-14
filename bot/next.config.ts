import type { NextConfig } from "next";

// Static export for GitHub Pages at https://<user>.github.io/vain-trading/
const nextConfig: NextConfig = {
  output: "export",
  basePath: "/Vain",
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
