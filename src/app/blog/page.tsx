import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, FileText } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Blog — OmniParse AI | Invoice Parsing Guides & Tutorials',
  description: 'Guides and tutorials on AI invoice parsing, OCR APIs, extracting data from PDFs, and automating accounts payable workflows.',
  keywords: [
    'AI invoice parsing',
    'invoice OCR API',
    'extract data from PDF invoices',
    'automate invoice processing',
    'accounts payable automation',
  ],
  alternates: {
    canonical: 'https://omniparse-ai.vercel.app/blog',
  },
  openGraph: {
    title: 'OmniParse AI Blog — Invoice Parsing Guides & Tutorials',
    description: 'Learn how to use AI to parse invoices, extract data from PDFs, and automate your AP workflow.',
    type: 'website',
    url: 'https://omniparse-ai.vercel.app/blog',
  },
};

const POSTS = [
  {
    slug: 'ai-invoice-parsing',
    title: 'AI Invoice Parsing: How Vision Language Models Extract Data from Invoices',
    description: 'A deep dive into how AI vision-language models (VLMs) read invoices like a human — extracting vendor, dates, amounts, and line items without templates. Learn how confidence scores and tampering detection work.',
    date: '2026-10-08',
    readTime: '8 min read',
    keywords: ['AI invoice parsing', 'VLM invoice extraction', 'vision language model OCR'],
  },
  {
    slug: 'free-invoice-ocr-api',
    title: 'Free Invoice OCR API: How to Extract Invoice Data Programmatically for Free',
    description: 'Complete guide to using a free invoice OCR API. Compare free tiers from OmniParse, Parseur, Nanonets, and Docparser. Includes code examples for extracting vendor, amounts, and line items via REST API.',
    date: '2026-10-08',
    readTime: '6 min read',
    keywords: ['free invoice OCR API', 'invoice parsing API', 'extract invoice data API'],
  },
  {
    slug: 'extract-line-items-from-pdf',
    title: 'How to Extract Line Items from PDF Invoices Using AI',
    description: 'Step-by-step guide to extracting individual line items (descriptions, quantities, unit prices, totals) from PDF invoices using AI. Includes code examples, accuracy tips, and how to handle multi-page tables.',
    date: '2026-10-08',
    readTime: '7 min read',
    keywords: ['extract line items from PDF', 'invoice line item extraction', 'parse invoice table AI'],
  },
];

export default function BlogIndex() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to home
        </Link>

        <h1 className="text-3xl font-bold mb-3">OmniParse AI Blog</h1>
        <p className="text-muted-foreground mb-8">
          Guides and tutorials on AI invoice parsing, OCR APIs, and automating accounts payable.
        </p>

        <div className="space-y-6">
          {POSTS.map((post) => (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              className="block rounded-xl border border-border bg-card p-6 hover:border-amber-500/40 hover:bg-amber-500/5 transition-colors"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                  <FileText className="h-5 w-5 text-amber-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="font-semibold text-lg mb-1 group-hover:text-amber-500">{post.title}</h2>
                  <p className="text-sm text-muted-foreground leading-relaxed mb-2">{post.description}</p>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{new Date(post.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                    <span>·</span>
                    <span>{post.readTime}</span>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
