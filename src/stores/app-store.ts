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
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  plan: string;
  createdAt: string;
  stripeCurrentPeriodEnd?: string | null;
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
