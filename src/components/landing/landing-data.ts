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
  featureKey?: string;        // Translation key — when set, UI calls t(key) and falls back to `feature`
  tooltip?: string;
  tooltipKey?: string;        // Translation key for the tooltip — falls back to `tooltip`
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
    featureKey: 'comparison.row.aiExtraction.feature',
    tooltip: 'Vision-Language Model: an AI that reads documents like a human, understanding layout, handwriting, and context.',
    tooltipKey: 'comparison.row.aiExtraction.tooltip',
    omniparse: true,
    competitor1: true,
    competitor2: true,
    competitor3: true,
  },
  {
    feature: 'IMAP email auto-import',
    featureKey: 'comparison.row.imap.feature',
    tooltip: 'Connect your Gmail, Outlook, or Yahoo inbox once. Every invoice that arrives via email is automatically captured, classified, and queued for your approval — no manual upload needed.',
    tooltipKey: 'comparison.row.imap.tooltip',
    omniparse: true,
    competitor1: false,
    competitor2: false,
    competitor3: false,
  },
  {
    feature: 'Tampering detection',
    featureKey: 'comparison.row.tampering.feature',
    tooltip: 'Three-layer analysis (metadata, heuristics, VLM) that flags potentially altered or fraudulent invoices.',
    tooltipKey: 'comparison.row.tampering.tooltip',
    omniparse: true,
    competitor1: false,
    competitor2: false,
    competitor3: false,
  },
  {
    feature: 'Per-field confidence',
    featureKey: 'comparison.row.perFieldConfidence.feature',
    tooltip: 'Each extracted field (vendor, amount, date) gets its own confidence score so you know exactly what to review.',
    tooltipKey: 'comparison.row.perFieldConfidence.tooltip',
    omniparse: true,
    competitor1: true,
    competitor2: 'Partial',
    competitor3: true,
  },
  {
    feature: 'Line-item extraction',
    featureKey: 'comparison.row.lineItems.feature',
    tooltip: 'Extracts individual line items from invoices — descriptions, quantities, unit prices, and totals.',
    tooltipKey: 'comparison.row.lineItems.tooltip',
    omniparse: true,
    competitor1: true,
    competitor2: true,
    competitor3: true,
  },
  {
    feature: 'Multi-currency native (CZK, EUR, USD, GBP + more)',
    featureKey: 'comparison.row.multiCurrency.feature',
    tooltip: 'OmniParse is built multi-currency from the ground up. Track invoices in CZK, EUR, USD, GBP and any other ISO currency. Analytics group by currency, monthly charts show one series per currency, the AI chat is currency-aware, and exports preserve currency codes. Competitors are primarily USD-focused with limited multi-currency support.',
    tooltipKey: 'comparison.row.multiCurrency.tooltip',
    omniparse: true,
    competitor1: 'Limited',
    competitor2: 'Limited',
    competitor3: 'Limited',
  },
  {
    feature: 'AI chat with context',
    featureKey: 'comparison.row.aiChat.feature',
    tooltip: 'Ask natural-language questions about your invoices. The AI has full access to your parsed data.',
    tooltipKey: 'comparison.row.aiChat.tooltip',
    omniparse: true,
    competitor1: false,
    competitor2: false,
    competitor3: false,
  },
  {
    feature: 'Interactive artifacts',
    featureKey: 'comparison.row.artifacts.feature',
    tooltip: 'AI generates live tables, bar charts, and pie charts inside the chat — not just text responses.',
    tooltipKey: 'comparison.row.artifacts.tooltip',
    omniparse: true,
    competitor1: false,
    competitor2: false,
    competitor3: false,
  },
  {
    feature: 'Approval workflows',
    featureKey: 'comparison.row.approvals.feature',
    tooltip: 'Automatically route invoices for review or approval based on configurable rules (e.g., amount thresholds).',
    tooltipKey: 'comparison.row.approvals.tooltip',
    omniparse: true,
    competitor1: true,
    competitor2: 'Limited',
    competitor3: 'Limited',
  },
  {
    feature: 'Custom validation rules',
    featureKey: 'comparison.row.customRules.feature',
    tooltip: 'Define your own rules (e.g., "if vendor is X and total > $5000, flag as warning") to catch issues automatically.',
    tooltipKey: 'comparison.row.customRules.tooltip',
    omniparse: true,
    competitor1: false,
    competitor2: 'Limited',
    competitor3: false,
  },
  {
    feature: 'Vendor risk scoring',
    featureKey: 'comparison.row.vendorRisk.feature',
    tooltip: 'Automated 0-100 risk score per vendor based on invoice patterns, anomalies, and historical behavior.',
    tooltipKey: 'comparison.row.vendorRisk.tooltip',
    omniparse: true,
    competitor1: false,
    competitor2: false,
    competitor3: false,
  },
  {
    feature: 'Vendor scorecards',
    featureKey: 'comparison.row.scorecard.feature',
    tooltip: 'Per-vendor dashboard: total spend, invoice count, average value, anomaly history, and trend charts — all in one view.',
    tooltipKey: 'comparison.row.scorecard.tooltip',
    omniparse: true,
    competitor1: 'Limited',
    competitor2: false,
    competitor3: false,
  },
  {
    feature: 'Price change alerts',
    featureKey: 'comparison.row.priceAlerts.feature',
    tooltip: 'Automatically detects when a vendor increases prices between invoices and alerts you.',
    tooltipKey: 'comparison.row.priceAlerts.tooltip',
    omniparse: true,
    competitor1: false,
    competitor2: false,
    competitor3: false,
  },
  {
    feature: 'Data retention control',
    featureKey: 'comparison.row.retention.feature',
    tooltip: 'Set your own retention window for stored invoice files (default 30 days). Extracted data is kept forever; raw file binaries are auto-purged to respect privacy.',
    tooltipKey: 'comparison.row.retention.tooltip',
    omniparse: true,
    competitor1: false,
    competitor2: 'Limited',
    competitor3: false,
  },
  {
    feature: 'Free tier available',
    featureKey: 'comparison.row.freeTier.feature',
    tooltip: 'A usable free plan so you can try the product before committing.',
    tooltipKey: 'comparison.row.freeTier.tooltip',
    omniparse: true,
    competitor1: false,
    competitor2: true,
    competitor3: true,
  },
  {
    feature: 'Transparent pricing',
    featureKey: 'comparison.row.transparentPricing.feature',
    tooltip: 'Public pricing page with clear per-feature breakdown — no "contact sales" walls.',
    tooltipKey: 'comparison.row.transparentPricing.tooltip',
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
