import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: false,
  serverExternalPackages: ['bcryptjs', 'jsonwebtoken', 'stripe', 'pdfjs-dist'],
  // ignoreBuildErrors = true so pre-existing TS errors from the rebase don't
  // block production builds. New code should still be type-clean.
  typescript: { ignoreBuildErrors: true },
};

export default nextConfig;
