import { create } from "zustand";

export type View = "landing" | "auth" | "dashboard";

export interface InvoiceRow {
  id: string;
  filename: string | null;
  vendor: string | null;
  invNumber: string | null;
  invDate: string | null;
  dueDate: string | null;
  amount: number | null;
  vatAmount: number | null;
  total: number | null;
  currency: string;
  status: string;
  isDuplicate: boolean;
  confidence: number | null;
  fieldConfidence?: Record<string, number> | null;
  createdAt: string;
  // New fields from Quick Wins
  validationResults?: {
    status: string;
    rules: Array<{ rule: string; severity: string; message: string; field?: string }>;
    varianceChecks?: Array<{ field: string; actual: number; expected: number; variance: number; variancePercent: number; threshold: number; status: string }>;
    tamperingCheck?: { isSuspicious: boolean; checks: Array<{ check: string; status: string; detail: string; icon?: string }> };
  } | null;
  validationStatus?: string | null;
  normalizedVendor?: string | null;
  normalizedInvDate?: string | null;
  normalizedDueDate?: string | null;
  normalizedAmount?: number | null;
  normalizedTotal?: number | null;
  normalizedCurrency?: string | null;
  processingTime?: number | null;
  customFields?: Record<string, unknown> | null;
  approvalStatus?: string | null;
  lifecycleStatus?: string | null;
  entityId?: string | null;
  lineItems?: unknown[] | null;
  labels?: Array<{ label: { id: string; name: string; color: string } }>;
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  plan: string;
  createdAt: string;
  stripeCurrentPeriodEnd?: string | null;
  hasPassword?: boolean;
  googleId?: boolean;
  githubId?: boolean;
  emailVerified?: string | null;
  emailVerifiedRequired?: boolean;
  debugEnabled?: boolean;
}

export type ArtifactType = "table" | "chart-bar" | "chart-line" | "chart-pie" | "summary";

export interface Artifact {
  type: ArtifactType;
  title: string;
  data: Record<string, unknown>;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  artifact?: Artifact;
}

interface AppState {
  view: View;
  user: UserProfile | null;
  isLoading: boolean;
  invoices: InvoiceRow[];
  chatHistory: ChatMessage[];
  uploadResults: InvoiceRow[] | null;
  uploadLoading: boolean;
  chatLoading: boolean;
  activeDashTab: string;
  legalPage: string | null;

  setView: (view: View) => void;
  setUser: (user: UserProfile | null) => void;
  setLoading: (loading: boolean) => void;
  setInvoices: (invoices: InvoiceRow[]) => void;
  addChatMessage: (message: ChatMessage) => void;
  clearChat: () => void;
  setUploadResults: (results: InvoiceRow[] | null) => void;
  setUploadLoading: (loading: boolean) => void;
  setChatLoading: (loading: boolean) => void;
  setActiveDashTab: (tab: string) => void;
  setLegalPage: (page: string | null) => void;
  addInvoice: (invoice: InvoiceRow) => void;
  /** Re-fetch invoices from /api/invoices. Call after any action that creates
   *  an invoice outside the normal upload flow (e.g. approving a pending
   *  review item). Returns a promise so callers can await it. */
  refreshInvoices: () => Promise<void>;
  logout: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  view: "landing",
  user: null,
  isLoading: true,
  invoices: [],
  chatHistory: [],
  uploadResults: null,
  uploadLoading: false,
  chatLoading: false,
  activeDashTab: "upload",
  legalPage: null,

  setView: (view) => set({ view }),
  setUser: (user) => set({ user, isLoading: false }),
  setLoading: (isLoading) => set({ isLoading }),
  setInvoices: (invoices) => set({ invoices }),
  addChatMessage: (message) =>
    set((state) => ({ chatHistory: [...state.chatHistory, message] })),
  clearChat: () => set({ chatHistory: [] }),
  setUploadResults: (uploadResults) => set({ uploadResults }),
  setUploadLoading: (uploadLoading) => set({ uploadLoading }),
  setChatLoading: (chatLoading) => set({ chatLoading }),
  setActiveDashTab: (activeDashTab) => set({ activeDashTab }),
  setLegalPage: (legalPage) => set({ legalPage }),
  addInvoice: (invoice) => set((s) => ({ invoices: [invoice, ...s.invoices] })),
  refreshInvoices: async () => {
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('op_token') : null;
    if (!token) return;
    try {
      // `cache: 'no-store'` opts out of Next.js's fetch cache (which can
      // serve stale data in regular browser sessions). Combined with the
      // `Cache-Control: no-store` header the server sets on /api/invoices,
      // this guarantees the invoices tab always reflects the current DB
      // state. Without it, a normal browser profile can show a stale list
      // even after uploads/deletes — which is what produced the "invoices
      // tab is broken" symptom that worked in incognito but not normally.
      const res = await fetch('/api/invoices', {
        headers: { Authorization: 'Bearer ' + token },
        cache: 'no-store',
      });
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data)) {
        set({ invoices: data.map((inv: Record<string, unknown>) => ({
          id: inv.id, filename: inv.filename, vendor: inv.vendor,
          invNumber: inv.invNumber, invDate: inv.invDate, dueDate: inv.dueDate,
          amount: inv.amount, vatAmount: inv.vatAmount, total: inv.total,
          currency: inv.currency, status: inv.status, isDuplicate: Boolean(inv.isDuplicate),
          confidence: inv.confidence, fieldConfidence: inv.fieldConfidence,
          createdAt: inv.createdAt,
          validationResults: inv.validationResults,
          validationStatus: inv.validationStatus,
          normalizedVendor: inv.normalizedVendor,
          normalizedInvDate: inv.normalizedInvDate,
          normalizedDueDate: inv.normalizedDueDate,
          normalizedAmount: inv.normalizedAmount,
          normalizedTotal: inv.normalizedTotal,
          normalizedCurrency: inv.normalizedCurrency,
          processingTime: inv.processingTime,
          lineItems: inv.lineItems,
          rawExtraction: inv.rawExtraction,
          customFields: inv.customFields,
          approvalStatus: inv.approvalStatus,
          lifecycleStatus: inv.lifecycleStatus,
          entityId: inv.entityId,
          updatedAt: inv.updatedAt,
          labels: Array.isArray(inv.labels) ? (inv.labels as InvoiceRow['labels']) : undefined,
        })) });
      }
    } catch {
      // Silently fail — the user can manually refresh
    }
  },
  logout: () => {
    localStorage.removeItem('op_token');
    set({
      user: null,
      view: "landing",
      invoices: [],
      chatHistory: [],
      uploadResults: null,
      activeDashTab: "upload",
    });
  },
}));
