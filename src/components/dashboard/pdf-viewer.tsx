'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Loader2, Download, AlertCircle, ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react';
import { Button } from '@/components/ui/button';

// ─── PDF Viewer using pdf.js ────────────────────────────────────────────────
// Renders PDF content onto <canvas> elements using Mozilla's pdf.js library.
// This avoids the Content-Security-Policy issue with iframes — Vercel's CSP
// blocks blob: URLs in frame-src, but canvas rendering is pure JavaScript
// and isn't subject to frame-src restrictions.
//
// Props:
//   base64: base64-encoded PDF data
//   filename: for display + download link
//
// Features:
//   - Renders all pages stacked vertically (scrollable)
//   - Zoom in/out controls
//   - Page navigation
//   - Download fallback link
//   - Loading + error states

interface PdfViewerProps {
  base64: string;
  filename: string;
}

interface PageSize {
  width: number;
  height: number;
}

export function PdfViewer({ base64, filename }: PdfViewerProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [scale, setScale] = useState(1.2);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pdfDocRef = useRef<any>(null);
  const renderTaskRef = useRef<any>(null);
  const [currentPage, setCurrentPage] = useState(1);

  // Load the PDF document
  useEffect(() => {
    let cancelled = false;

    async function loadPdf() {
      setLoading(true);
      setError(null);
      try {
        // Dynamic import pdfjs-dist (client-side only)
        const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');

        // Configure the worker — required for pdf.js to function
        // We use the CDN URL to avoid bundler worker path issues
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@4.4.168/legacy/build/pdf.worker.min.mjs`;

        // Decode base64 → Uint8Array
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

        // Load the PDF document
        const loadingTask = pdfjsLib.getDocument({ data: bytes });
        const pdf = await loadingTask.promise;
        if (cancelled) return;

        pdfDocRef.current = pdf;
        setNumPages(pdf.numPages);
        setCurrentPage(1);
        setLoading(false);
      } catch (err) {
        console.error('Failed to load PDF:', err);
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load PDF');
          setLoading(false);
        }
      }
    }

    loadPdf();

    return () => {
      cancelled = true;
      // Cancel any in-progress render task
      if (renderTaskRef.current) {
        try { renderTaskRef.current.cancel(); } catch {}
      }
      // Clean up the PDF document
      if (pdfDocRef.current) {
        try { pdfDocRef.current.destroy(); } catch {}
        pdfDocRef.current = null;
      }
    };
  }, [base64]);

  // Render the current page
  const renderPage = useCallback(async (pageNum: number) => {
    if (!pdfDocRef.current || !canvasRef.current) return;

    // Cancel any previous render task
    if (renderTaskRef.current) {
      try { renderTaskRef.current.cancel(); } catch {}
    }

    try {
      const page = await pdfDocRef.current.getPage(pageNum);
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      if (!context) return;

      // Calculate viewport at the current scale
      const viewport = page.getViewport({ scale: scale * (window.devicePixelRatio || 1) });
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      canvas.style.width = `${viewport.width / (window.devicePixelRatio || 1)}px`;
      canvas.style.height = `${viewport.height / (window.devicePixelRatio || 1)}px`;

      // Render the page
      const renderTask = page.render({
        canvasContext: context,
        viewport,
      });
      renderTaskRef.current = renderTask;
      await renderTask.promise;
    } catch (err) {
      // Ignore cancellation errors
      const errName = (err as { name?: string })?.name;
      if (errName !== 'RenderingCancelledException') {
        console.error('Failed to render page:', err);
      }
    }
  }, [scale]);

  // Re-render when page or scale changes
  useEffect(() => {
    if (!loading && pdfDocRef.current) {
      renderPage(currentPage);
    }
  }, [currentPage, scale, loading, renderPage]);

  // Download the PDF as a file
  const handleDownload = () => {
    try {
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      // Revoke after a delay so the download has time to start
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      console.error('Download failed:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground ml-2">Loading PDF...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center space-y-3">
        <AlertCircle className="h-10 w-10 mx-auto text-red-500/50" />
        <p className="text-sm text-muted-foreground">Failed to render PDF: {error}</p>
        <Button onClick={handleDownload} size="sm" variant="outline">
          <Download className="h-4 w-4 mr-1" /> Download instead
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border bg-muted/30">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage <= 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-xs text-muted-foreground min-w-[60px] text-center">
            Page {currentPage} of {numPages}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setCurrentPage(Math.min(numPages, currentPage + 1))}
            disabled={currentPage >= numPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setScale((s) => Math.max(0.5, s - 0.2))}
            disabled={scale <= 0.5}
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-xs text-muted-foreground min-w-[40px] text-center">
            {Math.round(scale * 100)}%
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setScale((s) => Math.min(3, s + 0.2))}
            disabled={scale >= 3}
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>
        <Button onClick={handleDownload} size="sm" variant="outline" className="h-7">
          <Download className="h-3.5 w-3.5 mr-1" /> Download
        </Button>
      </div>

      {/* PDF canvas */}
      <div className="flex justify-center bg-muted/20 rounded-lg border p-4 max-h-[60vh] overflow-auto">
        <canvas
          ref={canvasRef}
          className="shadow-lg bg-white"
        />
      </div>
    </div>
  );
}
