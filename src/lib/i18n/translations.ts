// ─── Translation dictionary ─────────────────────────────────────────────────
//
// Light i18n for OmniParse. No heavy framework — just a flat dictionary
// keyed by language code, with a `t(key)` lookup that falls back to English
// when a key is missing for the active language.
//
// ADDING A NEW LANGUAGE
// =====================
// 1. Add the language code to `Language` below.
// 2. Add translations (only for the keys you need — missing keys fall back
//    to English automatically).
// 3. The language toggle button in the navbar will pick it up automatically.
//
// ADDING A NEW KEY
// =================
// 1. Add the English string to `translations.en`.
// 2. Optionally add the Czech equivalent to `translations.cz`.
// 3. Use it in the UI via `const { t } = useI18n(); ... t('navbar.features')`.
//
// This file is intentionally NOT split per-language. Splitting creates a
// maintenance chore (3 files to update for every key) and the dictionary
// is small enough that a single file is fine. Once the dictionary grows
// past ~500 keys, split into per-language files loaded on demand.

export type Language = 'en' | 'cz';

export const LANGUAGES: { code: Language; label: string; flag: string }[] = [
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'cz', label: 'Čeština', flag: '🇨🇿' },
];

export const DEFAULT_LANGUAGE: Language = 'en';

// Translation keys. Keep the naming scheme consistent:
//   <area>.<thing>            e.g. navbar.features
//   <area>.<action>           e.g. settings.upgrade
//   <area>.<state>            e.g. settings.processing
const translations: Record<Language, Record<string, string>> = {
  en: {
    // ─── Navbar ─────────────────────────────────────────────────────────
    'navbar.features': 'Features',
    'navbar.pricing': 'Pricing',
    'navbar.compare': 'Compare',
    'navbar.login': 'Log in',
    'navbar.signup': 'Get Started',
    'navbar.language': 'Language',

    // ─── Hero ───────────────────────────────────────────────────────────
    'hero.badge': 'GDPR · EU AI Act · Czech-law compliant',
    'hero.title.line1': 'AI invoice parsing',
    'hero.title.line2': 'for the EU and beyond',
    'hero.subtitle': 'Upload invoices in any EU language. AI extracts vendor, dates, amounts, and line items as structured JSON. Chat about your data. Detect tampering. Stay on free tiers as long as possible.',
    'hero.cta.signup': 'Start free — 15 invoices/mo',
    'hero.cta.demo': 'See how it works',

    // ─── Features section ───────────────────────────────────────────────
    'features.title': 'Everything you need to process invoices',
    'features.subtitle': 'Built from the ground up for EU SMEs. Free tier, EU data residency, multi-currency, IMAP auto-import.',

    // ─── Pricing section ────────────────────────────────────────────────
    'pricing.title': 'Choose Your Plan',
    'pricing.subtitle': 'Start free. Upgrade when you need more volume, editing, or team features.',
    'pricing.monthly': 'Monthly',
    'pricing.annual': 'Annual',
    'pricing.save': 'Save 20%',
    'pricing.note': 'All plans include data export, account deletion & audit logging. Built with GDPR, EU AI Act & PIPEDA principles. No credit card required for Free.',

    // ─── Dashboard nav (sidebar tabs) ──────────────────────────────────
    'dashboard.tab.upload': 'Upload',
    'dashboard.tab.invoices': 'Invoices',
    'dashboard.tab.pending': 'Pending',
    'dashboard.tab.validation': 'Validation',
    'dashboard.tab.approvals': 'Approvals',
    'dashboard.tab.analytics': 'Analytics',
    'dashboard.tab.chat': 'AI Chat',
    'dashboard.tab.settings': 'Settings',

    // ─── Settings — Billing card ───────────────────────────────────────
    'settings.billing.title': 'Billing',
    'settings.billing.description': 'Manage your subscription, plan and usage',
    'settings.billing.currentPlan': 'Current Plan',
    'settings.billing.invoicesThisPeriod': 'Invoices this period',
    'settings.billing.manageBilling': 'Manage billing',
    'settings.billing.openingPortal': 'Opening portal...',
    'settings.billing.upgradePlan': 'Upgrade plan',
    'settings.billing.redirecting': 'Redirecting...',
    'settings.billing.upgradeTo': 'Upgrade to',
    'settings.billing.euVatNote': 'EU VAT is calculated and collected at checkout via Stripe Tax. Cancel anytime from the customer portal — EU consumers retain their 14-day withdrawal right.',
    'settings.billing.nextRenewal': 'Next renewal',
    'settings.billing.monthlyBilling': 'monthly billing',
    'settings.billing.annualBilling': 'annual billing',

    // ─── Footer ─────────────────────────────────────────────────────────
    'footer.product': 'Product',
    'footer.legal': 'Legal',
    'footer.resources': 'Resources',
    'footer.rights': 'All rights reserved.',

    // ─── Cookie banner ─────────────────────────────────────────────────
    'cookie.text': 'We use cookies for essential functions, analytics, and marketing (with your consent). See our Cookie Policy for details.',
    'cookie.accept': 'Accept all',
    'cookie.reject': 'Reject non-essential',
    'cookie.manage': 'Manage preferences',

    // ─── Common / generic ──────────────────────────────────────────────
    'common.loading': 'Loading...',
    'common.cancel': 'Cancel',
    'common.save': 'Save',
    'common.delete': 'Delete',
    'common.confirm': 'Confirm',
    'common.back': 'Back',
  },

  cz: {
    // ─── Navbar ─────────────────────────────────────────────────────────
    'navbar.features': 'Funkce',
    'navbar.pricing': 'Ceník',
    'navbar.compare': 'Porovnání',
    'navbar.login': 'Přihlásit se',
    'navbar.signup': 'Vyzkoušet zdarma',
    'navbar.language': 'Jazyk',

    // ─── Hero ───────────────────────────────────────────────────────────
    'hero.badge': 'GDPR · AI Act EU · v souladu s českým právem',
    'hero.title.line1': 'AI zpracování faktur',
    'hero.title.line2': 'pro EU a celý svět',
    'hero.subtitle': 'Nahrajte faktury v jakémkoli jazyce EU. AI extrahuje dodavatele, data, částky a položky jako strukturované JSON. Zeptejte se AI na svá data. Detekujte podvržení. Zůstaňte na free tieru co nejdéle.',
    'hero.cta.signup': 'Začít zdarma — 15 faktur / měsíc',
    'hero.cta.demo': 'Podívat se jak to funguje',

    // ─── Features section ───────────────────────────────────────────────
    'features.title': 'Vše, co potřebujete pro zpracování faktur',
    'features.subtitle': 'Postavené od základů pro EU SMB. Free tier, evropská rezidence dat, více měn, IMAP auto-import.',

    // ─── Pricing section ────────────────────────────────────────────────
    'pricing.title': 'Vyberte si plán',
    'pricing.subtitle': 'Začněte zdarma. Přejděte na vyšší plán, až budete potřebovat více objemu, úpravy nebo funkce pro týmy.',
    'pricing.monthly': 'Měsíčně',
    'pricing.annual': 'Ročně',
    'pricing.save': 'Ušetříte 20 %',
    'pricing.note': 'Všechny plány zahrnují export dat, smazání účtu a audit log. V souladu s GDPR, EU AI Act a PIPEDA. Pro Free plán není potřeba platební karta.',

    // ─── Dashboard nav (sidebar tabs) ──────────────────────────────────
    'dashboard.tab.upload': 'Nahrát',
    'dashboard.tab.invoices': 'Faktury',
    'dashboard.tab.pending': 'K schválení',
    'dashboard.tab.validation': 'Validace',
    'dashboard.tab.approvals': 'Schvalování',
    'dashboard.tab.analytics': 'Analytika',
    'dashboard.tab.chat': 'AI Chat',
    'dashboard.tab.settings': 'Nastavení',

    // ─── Settings — Billing card ───────────────────────────────────────
    'settings.billing.title': 'Předplatné',
    'settings.billing.description': 'Spravujte své předplatné, plán a využití',
    'settings.billing.currentPlan': 'Aktuální plán',
    'settings.billing.invoicesThisPeriod': 'Faktury v tomto období',
    'settings.billing.manageBilling': 'Spravovat předplatné',
    'settings.billing.openingPortal': 'Otevírám portál...',
    'settings.billing.upgradePlan': 'Přejít na vyšší plán',
    'settings.billing.redirecting': 'Přesměrovávám...',
    'settings.billing.upgradeTo': 'Přejít na',
    'settings.billing.euVatNote': 'EU DPH je vypočítána a vybrána při platbě přes Stripe Tax. Zrušit můžete kdykoli z zákaznického portálu — spotřebitelé v EU si zachovávají právo na odstoupení do 14 dnů.',
    'settings.billing.nextRenewal': 'Příští obnova',
    'settings.billing.monthlyBilling': 'měsíční fakturace',
    'settings.billing.annualBilling': 'roční fakturace',

    // ─── Footer ─────────────────────────────────────────────────────────
    'footer.product': 'Produkt',
    'footer.legal': 'Právní',
    'footer.resources': 'Zdroje',
    'footer.rights': 'Všechna práva vyhrazena.',

    // ─── Cookie banner ─────────────────────────────────────────────────
    'cookie.text': 'Používáme cookies pro základní funkce, analytiku a marketing (s vaším souhlasem). Podrobnosti viz Zásady cookies.',
    'cookie.accept': 'Přijmout vše',
    'cookie.reject': 'Odmítnout nepodstatné',
    'cookie.manage': 'Spravovat preference',

    // ─── Common / generic ──────────────────────────────────────────────
    'common.loading': 'Načítám...',
    'common.cancel': 'Zrušit',
    'common.save': 'Uložit',
    'common.delete': 'Smazat',
    'common.confirm': 'Potvrdit',
    'common.back': 'Zpět',
  },
};

/**
 * Look up a translation key.
 *
 * Falls back to English if the key is missing in the requested language.
 * Falls back to the key itself if missing from both (so missing keys
 * are obvious in the UI).
 *
 * Optional `{ name: value }` params substitute `{name}` placeholders.
 */
export function translate(lang: Language, key: string, params?: Record<string, string | number>): string {
  let str = translations[lang]?.[key] ?? translations.en[key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    }
  }
  return str;
}

/**
 * Detect the user's preferred language from the browser.
 * Used on first load (before the user has toggled anything).
 * Falls back to 'en' for non-Czech locales.
 */
export function detectBrowserLanguage(): Language {
  if (typeof navigator === 'undefined') return DEFAULT_LANGUAGE;
  const langs = navigator.languages ?? [navigator.language];
  for (const l of langs) {
    if (l.toLowerCase().startsWith('cs') || l.toLowerCase().startsWith('cz')) return 'cz';
  }
  return DEFAULT_LANGUAGE;
}
