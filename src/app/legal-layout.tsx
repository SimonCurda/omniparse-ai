import Link from 'next/link';
import { ArrowLeft, FileText, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function LegalLayout({ title, lastUpdated, children }: { title: string; lastUpdated: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/50 bg-background/95 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/"><ArrowLeft className="h-4 w-4 mr-1" /> Back</Link>
          </Button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-amber-500 flex items-center justify-center">
              <span className="text-white font-bold text-xs">OP</span>
            </div>
            <span className="font-semibold text-sm">OmniParse</span>
          </div>
          <div className="ml-auto">
            <Button variant="outline" size="sm" asChild>
              <a
                href="/OmniParse-Legal-Documents.pdf"
                target="_blank"
                rel="noopener"
                title="Open the full Legal Documents PDF (all 4 documents, opens in a new tab — shareable URL)"
              >
                <FileText className="h-4 w-4 mr-1" />
                Full PDF
                <ExternalLink className="h-3 w-3 ml-1 opacity-60" />
              </a>
            </Button>
          </div>
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-3xl font-bold mb-2">{title}</h1>
        <p className="text-sm text-muted-foreground mb-8">Last updated: {lastUpdated}</p>
        <div className="prose prose-sm dark:prose-invert max-w-none space-y-6 text-muted-foreground leading-relaxed">
          {children}
        </div>
        <div className="mt-16 pt-8 border-t border-border/50 text-sm text-muted-foreground space-y-3">
          <p>
            <strong>Prefer the PDF?</strong> All four legal documents (AI Transparency Notice, Terms of
            Service, Privacy Policy including DPA, and Cookie Policy) are consolidated in a single
            print-ready PDF.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" size="sm" asChild>
              <a
                href="/OmniParse-Legal-Documents.pdf"
                target="_blank"
                rel="noopener"
              >
                <FileText className="h-4 w-4 mr-1" />
                Open Legal Documents PDF
                <ExternalLink className="h-3 w-3 ml-1 opacity-60" />
              </a>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <a
                href="/OmniParse-Legal-Documents.pdf"
                download="OmniParse-Legal-Documents.pdf"
              >
                <FileText className="h-4 w-4 mr-1" />
                Download PDF
              </a>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground/70">
            Direct shareable URL:{' '}
            <code className="px-1.5 py-0.5 rounded bg-muted text-foreground/80 text-[11px]">
              omniparse-ai.vercel.app/OmniParse-Legal-Documents.pdf
            </code>
          </p>
        </div>
      </main>
    </div>
  );
}