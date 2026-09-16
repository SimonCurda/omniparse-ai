import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: false,
  serverExternalPackages: ['bcryptjs', 'jsonwebtoken', 'stripe', 'pdfjs-dist'],
  typescript: { ignoreBuildErrors: true },
};

export default nextConfig;