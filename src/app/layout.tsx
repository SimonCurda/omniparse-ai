import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from 'sonner';
import { ThemeProvider } from 'next-themes';
import { ErrorBoundary } from '@/components/error-boundary';
import { CrashLoggerInit } from '@/components/crash-logger-init';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "OmniParse — AI Invoice Parsing",
  description:
    "Upload invoices and receipts. AI extracts vendor, dates, amounts, and line items as structured JSON. Chat about your data, generate interactive tables and charts.",
  keywords: [
    "invoice processing",
    "AI extraction",
    "document parsing",
    "vision language model",
    "automated accounting",
  ],
  authors: [{ name: "OmniParse AI" }],
  creator: "OmniParse AI",
  publisher: "OmniParse AI",
  robots: { index: true, follow: true },
  // Canonical URL — required for entity resolution and SEO. Prevents
  // duplicate-content issues if the site is accessed via alternate URLs.
  alternates: {
    canonical: "https://omniparse-ai.vercel.app/",
  },
  icons: {
    // Matches the navbar logo: amber rounded square with "OP" in black bold
    // (black has better contrast against amber/yellow than white)
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='7' fill='%23F59E0B'/><text x='16' y='23' font-family='system-ui,sans-serif' font-size='17' font-weight='bold' fill='%2309090B' text-anchor='middle'>OP</text></svg>",
    apple: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='7' fill='%23F59E0B'/><text x='16' y='23' font-family='system-ui,sans-serif' font-size='17' font-weight='bold' fill='%2309090B' text-anchor='middle'>OP</text></svg>",
  },
  openGraph: {
    title: "OmniParse — AI Invoice Parsing",
    description:
      "AI-powered invoice parsing. Upload documents and extract structured data in seconds.",
    type: "website",
    siteName: "OmniParse",
    url: "https://omniparse-ai.vercel.app/",
    images: [
      {
        url: "/omniparse-logo-with-text.png",
        width: 1200,
        height: 630,
        alt: "OmniParse AI — AI Invoice Parsing",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "OmniParse — AI Invoice Parsing",
    description: "AI-powered invoice parsing. Upload any invoice and extract structured data.",
    images: ["/omniparse-logo-with-text.png"],
  },
};

export const viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafafa" },
    { media: "(prefers-color-scheme: dark)", color: "#09090b" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // JSON-LD structured data for AI agents. Combines SoftwareApplication
  // (product identity) and Organization (business identity with contactPoint
  // and address) so agents can parse who we are and what we do.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'SoftwareApplication',
        name: 'OmniParse AI',
        description: 'AI-powered invoice and receipt parsing service. Upload documents and extract structured data as JSON with confidence scores, tampering detection, and validation rules.',
        url: 'https://omniparse-ai.vercel.app',
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Web',
        offers: [
          { '@type': 'Offer', name: 'Free', price: '0', priceCurrency: 'USD', description: '15 invoices/month, REST API access' },
          { '@type': 'Offer', name: 'Pro', price: '49', priceCurrency: 'USD', description: '500 invoices/month, editing, JSON/Excel export' },
          { '@type': 'Offer', name: 'Plus', price: '99', priceCurrency: 'USD', description: '2,000 invoices/month, approval workflows' },
          { '@type': 'Offer', name: 'Business', price: '199', priceCurrency: 'USD', description: '10,000 invoices/month, multi-entity' },
          { '@type': 'Offer', name: 'Enterprise', price: '499', priceCurrency: 'USD', description: 'Unlimited everything' },
        ],
        featureList: [
          'AI extraction of vendor, dates, amounts, line items',
          'Confidence scores on every field',
          '3-layer tampering detection',
          'Validation rules (built-in + custom)',
          'CSV, JSON, Excel, PDF export',
          'REST API with X-API-Key authentication',
          'Email import via IMAP',
          'Approval workflows',
          'Chat assistant for invoice data',
        ],
        publisher: { '@type': 'Organization', name: 'OmniParse AI' },
      },
      {
        '@type': 'Organization',
        name: 'OmniParse AI',
        url: 'https://omniparse-ai.vercel.app',
        logo: 'https://omniparse-ai.vercel.app/omniparse-logo-with-text.png',
        description: 'AI-powered invoice and receipt parsing service based in the Czech Republic.',
        founder: { '@type': 'Person', name: 'Simon Curda' },
        contactPoint: {
          '@type': 'ContactPoint',
          contactType: 'customer support',
          email: 'support@omniparse-ai.com',
          url: 'https://omniparse-ai.vercel.app/contact',
          availableLanguage: ['English'],
        },
        address: {
          '@type': 'PostalAddress',
          addressCountry: 'CZ',
          addressRegion: 'Prague',
        },
        sameAs: [
          'https://github.com/SimonCurda/omniparse-ai',
        ],
      },
    ],
  };

  return (
    <html lang="en" suppressHydrationWarning className="dark">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:p-4 focus:bg-background focus:border focus:rounded">Skip to main content</a>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <CrashLoggerInit />
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
        </ThemeProvider>
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: "var(--card)",
              border: "1px solid var(--border)",
              color: "var(--card-foreground)",
            },
          }}
        />
      </body>
    </html>
  );
}
