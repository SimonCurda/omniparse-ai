import type { LucideIcon } from 'lucide-react';
import {
  Upload, FileText, BarChart3, MessageSquare, Download,
  Shield, Eye,
} from 'lucide-react';

export const ICONS = {
  Upload, FileText, BarChart3, MessageSquare, Download, Shield, Eye,
};

export interface Feature {
  icon: LucideIcon;
  title: string;
  description: string;
}

export const FEATURES: Feature[] = [
  {
    icon: Upload,
    title: 'Upload Documents',
    description: 'PDF invoices, receipts, or photos (PDF, JPEG, PNG, WebP up to 10MB). Processed by a vision-language model.',
  },
  {
    icon: Eye,
    title: 'AI-Powered Extraction',
    description: 'Extracts vendor, dates, line items, and amounts into structured JSON with confidence scores.',
  },
  {
    icon: Shield,
    title: 'Tampering Detection',
    description: 'Three-layer AI analysis: metadata checks, heuristic rules, and VLM inspection for fraud detection.',
  },
  {
    icon: MessageSquare,
    title: 'Chat About Your Data',
    description: 'Ask questions about your parsed invoices. AI provides analysis, comparisons, and insights.',
  },
  {
    icon: Download,
    title: 'Export Data',
    description: 'Download as CSV, JSON, or Excel (.xlsx) with properly styled columns for accounting tools.',
  },
  {
    icon: BarChart3,
    title: 'Visual Analytics',
    description: 'Dashboard with processing volume, spending amounts, vendor distribution, and confidence scores.',
  },
];

export interface CompetitorRow {
  feature: string;
  tooltip?: string;
  omniparse: string | boolean;
  competitor1: string | boolean;
  competitor2: string | boolean;
  competitor3: string | boolean;
}

export const COMPETITORS = {
  omniparse: 'OmniParse',
  competitor1: 'Rossum',
  competitor2: 'Docsumo',
  competitor3: 'Nanonets',
};

export const COMPARISON_DATA: CompetitorRow[] = [
  {
    feature: 'AI extraction (VLM)',
    tooltip: 'Vision-Language Model: an AI that reads documents like a human, understanding layout, handwriting, and context.',
    omniparse: true,
    competitor1: true,
    competitor2: true,
    competitor3: true,
  },
  {
    feature: 'Tampering detection',
    tooltip: 'Three-layer analysis (metadata, heuristics, VLM) that flags potentially altered or fraudulent invoices.',
    omniparse: true,
    competitor1: false,
    competitor2: false,
    competitor3: false,
  },
  {
    feature: 'Per-field confidence',
    tooltip: 'Each extracted field (vendor, amount, date) gets its own confidence score so you know exactly what to review.',
    omniparse: true,
    competitor1: true,
    competitor2: 'Partial',
    competitor3: true,
  },
  {
    feature: 'Line-item extraction',
    tooltip: 'Extracts individual line items from invoices — descriptions, quantities, unit prices, and totals.',
    omniparse: true,
    competitor1: true,
    competitor2: true,
    competitor3: true,
  },
  {
    feature: 'AI chat with context',
    tooltip: 'Ask natural-language questions about your invoices. The AI has full access to your parsed data.',
    omniparse: true,
    competitor1: false,
    competitor2: false,
    competitor3: false,
  },
  {
    feature: 'Interactive artifacts',
    tooltip: 'AI generates live tables, bar charts, and pie charts inside the chat — not just text responses.',
    omniparse: true,
    competitor1: false,
    competitor2: false,
    competitor3: false,
  },
  {
    feature: 'Approval workflows',
    tooltip: 'Automatically route invoices for review or approval based on configurable rules (e.g., amount thresholds).',
    omniparse: true,
    competitor1: true,
    competitor2: 'Limited',
    competitor3: 'Limited',
  },
  {
    feature: 'Custom validation rules',
    tooltip: 'Define your own rules (e.g., "if vendor is X and total > $5000, flag as warning") to catch issues automatically.',
    omniparse: true,
    competitor1: false,
    competitor2: 'Limited',
    competitor3: false,
  },
  {
    feature: 'Vendor risk scoring',
    tooltip: 'Automated 0-100 risk score per vendor based on invoice patterns, anomalies, and historical behavior.',
    omniparse: true,
    competitor1: false,
    competitor2: false,
    competitor3: false,
  },
  {
    feature: 'Price change alerts',
    tooltip: 'Automatically detects when a vendor increases prices between invoices and alerts you.',
    omniparse: true,
    competitor1: false,
    competitor2: false,
    competitor3: false,
  },
  {
    feature: 'Free tier available',
    tooltip: 'A usable free plan so you can try the product before committing.',
    omniparse: true,
    competitor1: false,
    competitor2: true,
    competitor3: true,
  },
  {
    feature: 'Transparent pricing',
    tooltip: 'Public pricing page with clear per-feature breakdown — no "contact sales" walls.',
    omniparse: true,
    competitor1: false,
    competitor2: true,
    competitor3: false,
  },
];

export const PLAN_LIMITS: Record<string, { invoices: number; chatMessages: number }> = {
  free: { invoices: 15, chatMessages: 10 },
  pro: { invoices: 500, chatMessages: Infinity },
  plus: { invoices: 2000, chatMessages: Infinity },
  business: { invoices: 10000, chatMessages: Infinity },
  enterprise: { invoices: Infinity, chatMessages: Infinity },
};

export const PLAN_LABELS: Record<string, string> = {
  free: 'Free',
  pro: 'Pro',
  plus: 'Plus',
  business: 'Business',
  enterprise: 'Enterprise',
};
