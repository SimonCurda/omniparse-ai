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
  icons: {
    // Matches the navbar logo: amber rounded square with "OP" in black bold
    // (black has better contrast against amber/yellow than white)
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='8' fill='%23F59E0B'/><text x='16' y='22' font-family='system-ui,sans-serif' font-size='14' font-weight='bold' fill='%2309090B' text-anchor='middle'>OP</text></svg>",
    apple: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='8' fill='%23F59E0B'/><text x='16' y='22' font-family='system-ui,sans-serif' font-size='14' font-weight='bold' fill='%2309090B' text-anchor='middle'>OP</text></svg>",
  },
  openGraph: {
    title: "OmniParse — AI Invoice Parsing",
    description:
      "AI-powered invoice parsing. Upload documents and extract structured data in seconds.",
    type: "website",
    siteName: "OmniParse",
  },
  twitter: {
    card: "summary_large_image",
    title: "OmniParse — AI Invoice Parsing",
    description: "AI-powered invoice parsing. Upload any invoice and extract structured data.",
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
  return (
    <html lang="en" suppressHydrationWarning className="dark">
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
