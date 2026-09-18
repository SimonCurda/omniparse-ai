'use client';

import Link from 'next/link';

export function Footer() {
  return (
    <footer className="border-t border-border py-12 px-4 sm:px-6 lg:px-8 bg-background">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center">
                <span className="text-white font-bold text-sm">OP</span>
              </div>
              <span className="font-semibold text-lg">OmniParse</span>
            </div>
            <p className="text-sm text-muted-foreground max-w-sm leading-relaxed">
              AI-powered invoice parsing and analysis. Upload documents, extract structured data, and chat with AI about your invoices.
            </p>
          </div>
          <div>
            <h4 className="font-semibold text-sm mb-4">Product</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href="#features" className="hover:text-foreground transition-colors">Features</a></li>
              <li><a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a></li>
              <li><a href="#comparison" className="hover:text-foreground transition-colors">Compare</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-sm mb-4">Legal</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="/privacy-policy" className="hover:text-foreground transition-colors">Privacy Policy</Link></li>
              <li><Link href="/terms-of-service" className="hover:text-foreground transition-colors">Terms of Service</Link></li>
              <li><Link href="/cookie-policy" className="hover:text-foreground transition-colors">Cookie Policy</Link></li>
              <li><Link href="/ai-act-notice" className="hover:text-foreground transition-colors">AI Act Notice</Link></li>
              <li>
                <a
                  href="/OmniParse-Legal-Documents.pdf"
                  target="_blank"
                  rel="noopener"
                  className="hover:text-foreground transition-colors inline-flex items-center gap-1"
                >
                  Legal Documents PDF
                  <svg className="h-3 w-3 opacity-60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                </a>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => {
                    // Clear the consent record so the banner re-appears on next page load
                    try { localStorage.removeItem('omniparse_cookie_consent'); } catch {}
                    // Reload to re-trigger the banner
                    window.location.reload();
                  }}
                  className="hover:text-foreground transition-colors text-left"
                >
                  Cookie Settings
                </button>
              </li>
            </ul>
          </div>
        </div>
        <div className="mt-8 pt-8 border-t border-border text-center text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} OmniParse. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
