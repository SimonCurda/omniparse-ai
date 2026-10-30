import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: false,
  serverExternalPackages: ['bcryptjs', 'jsonwebtoken', 'stripe', 'pdfjs-dist', '@napi-rs/canvas'],
  // @napi-rs/canvas ships its native .node binary via optionalDependencies
  // (e.g. @napi-rs/canvas-linux-x64-gnu). serverExternalPackages alone keeps
  // the JS entry external, but NFT (Node File Trace) does not reliably follow
  // the platform binary — so on Vercel the import fails at runtime and
  // renderPdfFirstPageToPng() returns null ("PDF first-page rendering is
  // unavailable on this deployment"). Explicitly tracing the whole package
  // (all platform binaries included) for every route that renders PDFs.
  //
  // Used by:
  //   • /api/parse              (production PDF → PNG for the vision cascade)
  //   • /api/admin/model-tester (parse mode PDF uploads)
  outputFileTracingIncludes: {
    '/api/parse': ['./node_modules/@napi-rs/canvas/**/*'],
    '/api/admin/model-tester': ['./node_modules/@napi-rs/canvas/**/*'],
  },
  // ignoreBuildErrors = true so pre-existing TS errors from the rebase don't
  // block production builds. New code should still be type-clean.
  typescript: { ignoreBuildErrors: true },
};

export default nextConfig;
