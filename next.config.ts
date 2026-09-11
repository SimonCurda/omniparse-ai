import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: false,
  serverExternalPackages: ['bcryptjs', 'jsonwebtoken', 'stripe', 'pdfjs-dist'],
  typescript: { ignoreBuildErrors: true },
  // Override Vercel's default CSP to allow blob: URLs in iframes.
  // This is needed for the Pending Review PDF preview — we convert base64
  // attachments to Blob URLs and embed them in <iframe> tags. Vercel's default
  // CSP blocks blob: in frame-src, which makes the PDF preview fail with
  // "This content is blocked".
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' https://api.groq.com https://openrouter.ai; object-src 'self' blob:; frame-src 'self' blob: data:; base-uri 'self'; form-action 'self'; frame-ancestors 'self'",
          },
        ],
      },
    ];
  },
};

export default nextConfig;