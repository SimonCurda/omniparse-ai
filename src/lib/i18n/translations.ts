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

export type Language = 'en' | 'cz' | 'sk' | 'de';

export const LANGUAGES: { code: Language; label: string; flag: string }[] = [
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'cz', label: 'Čeština', flag: '🇨🇿' },
  { code: 'sk', label: 'Slovenčina', flag: '🇸🇰' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
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

  sk: {
    // ─── Navbar ─────────────────────────────────────────────────────────
    'navbar.features': 'Funkcie',
    'navbar.pricing': 'Cenník',
    'navbar.compare': 'Porovnanie',
    'navbar.login': 'Prihlásiť sa',
    'navbar.signup': 'Vyskúšať zdarma',
    'navbar.language': 'Jazyk',

    // ─── Hero ───────────────────────────────────────────────────────────
    'hero.badge': 'GDPR · AI Act EU · v súlade s českým právom',
    'hero.title.line1': 'AI spracovanie faktúr',
    'hero.title.line2': 'pre EU a celý svet',
    'hero.subtitle': 'Nahrajte faktúry v akomkoľvek jazyku EU. AI extrahuje dodávateľa, dátumy, čiastky a položky ako štruktúrované JSON. Opýtajte sa AI na svoje dáta. Detekujte falšovanie. Zostaňte na free tieri čo najdlhšie.',
    'hero.cta.signup': 'Začať zdarma — 15 faktúr / mesiac',
    'hero.cta.demo': 'Pozrieť sa ako to funguje',

    // ─── Features section ───────────────────────────────────────────────
    'features.title': 'Všetko, čo potrebujete na spracovanie faktúr',
    'features.subtitle': 'Postavené od základov pre EU SMB. Free tier, európska rezidencia dát, viac mien, IMAP auto-import.',

    // ─── Pricing section ────────────────────────────────────────────────
    'pricing.title': 'Vyberte si plán',
    'pricing.subtitle': 'Začnite zdarma. Prejdite na vyšší plán, až budete potrebovať viac objemu, úpravy alebo funkcie pre tímy.',
    'pricing.monthly': 'Mesačne',
    'pricing.annual': 'Ročne',
    'pricing.save': 'Ušetríte 20 %',
    'pricing.note': 'Všetky plány zahŕňajú export dát, zmazanie účtu a audit log. V súlade s GDPR, EU AI Act a PIPEDA. Pre Free plán nie je potrebná platobná karta.',

    // ─── Dashboard nav (sidebar tabs) ──────────────────────────────────
    'dashboard.tab.upload': 'Nahrať',
    'dashboard.tab.invoices': 'Faktúry',
    'dashboard.tab.pending': 'Na schválenie',
    'dashboard.tab.validation': 'Validácia',
    'dashboard.tab.approvals': 'Schvaľovanie',
    'dashboard.tab.analytics': 'Analytika',
    'dashboard.tab.chat': 'AI Chat',
    'dashboard.tab.settings': 'Nastavenia',

    // ─── Settings — Billing card ───────────────────────────────────────
    'settings.billing.title': 'Predplatné',
    'settings.billing.description': 'Spravujte svoje predplatné, plán a využitie',
    'settings.billing.currentPlan': 'Aktuálny plán',
    'settings.billing.invoicesThisPeriod': 'Faktúry v tomto období',
    'settings.billing.manageBilling': 'Spravovať predplatné',
    'settings.billing.openingPortal': 'Otváram portál...',
    'settings.billing.upgradePlan': 'Prejsť na vyšší plán',
    'settings.billing.redirecting': 'Presmerovávam...',
    'settings.billing.upgradeTo': 'Prejsť na',
    'settings.billing.euVatNote': 'EÚ DPH je vypočítaná a vybraná pri platbe cez Stripe Tax. Zrušiť môžete kedykoľvek zo zákazníckeho portálu — spotrebitelia v EÚ si zachovávajú právo na odstúpenie do 14 dní.',
    'settings.billing.nextRenewal': 'Ďalšia obnova',
    'settings.billing.monthlyBilling': 'mesačné fakturovanie',
    'settings.billing.annualBilling': 'ročné fakturovanie',

    // ─── Footer ─────────────────────────────────────────────────────────
    'footer.product': 'Produkt',
    'footer.legal': 'Právne',
    'footer.resources': 'Zdroje',
    'footer.rights': 'Všetky práva vyhradené.',

    // ─── Cookie banner ─────────────────────────────────────────────────
    'cookie.text': 'Používame cookies pre základné funkcie, analytiku a marketing (s vaším súhlasom). Podrobnosti viz Zásady cookies.',
    'cookie.accept': 'Prijať všetko',
    'cookie.reject': 'Odmietnuť nepodstatné',
    'cookie.manage': 'Spravovať preferencie',

    // ─── Common / generic ──────────────────────────────────────────────
    'common.loading': 'Načítavam...',
    'common.cancel': 'Zrušiť',
    'common.save': 'Uložiť',
    'common.delete': 'Zmazať',
    'common.confirm': 'Potvrdiť',
    'common.back': 'Späť',
  },

  de: {
    // ─── Navbar ─────────────────────────────────────────────────────────
    'navbar.features': 'Funktionen',
    'navbar.pricing': 'Preise',
    'navbar.compare': 'Vergleich',
    'navbar.login': 'Anmelden',
    'navbar.signup': 'Loslegen',
    'navbar.language': 'Sprache',

    // ─── Hero ───────────────────────────────────────────────────────────
    'hero.badge': 'GDPR · EU AI Act · tschechisch-rechtlich konform',
    'hero.title.line1': 'KI-Rechnungsverarbeitung',
    'hero.title.line2': 'für die EU und darüber hinaus',
    'hero.subtitle': 'Laden Sie Rechnungen in jeder EU-Sprache hoch. Die KI extrahiert Lieferant, Daten, Beträge und Positionen als strukturiertes JSON. Fragen Sie die KI zu Ihren Daten. Fälschungserkennung. Bleiben Sie so lange wie möglich auf kostenlosen Tarifen.',
    'hero.cta.signup': 'Kostenlos starten — 15 Rechnungen/Monat',
    'hero.cta.demo': 'So funktioniert es',

    // ─── Features section ───────────────────────────────────────────────
    'features.title': 'Alles, was Sie zur Rechnungsverarbeitung brauchen',
    'features.subtitle': 'Von Grund auf für EU-KMU entwickelt. Kostenlose Stufe, EU-Datenresidenz, Mehrwährung, IMAP-Auto-Import.',

    // ─── Pricing section ────────────────────────────────────────────────
    'pricing.title': 'Wählen Sie Ihren Plan',
    'pricing.subtitle': 'Kostenlos starten. Upgraden, wenn Sie mehr Volumen, Bearbeitung oder Teamfunktionen brauchen.',
    'pricing.monthly': 'Monatlich',
    'pricing.annual': 'Jährlich',
    'pricing.save': '20 % sparen',
    'pricing.note': 'Alle Pläne umfassen Datenexport, Kontolöschung und Audit-Protokollierung. Konform mit GDPR, EU AI Act und PIPEDA. Für den Free-Plan ist keine Kreditkarte erforderlich.',

    // ─── Dashboard nav (sidebar tabs) ──────────────────────────────────
    'dashboard.tab.upload': 'Hochladen',
    'dashboard.tab.invoices': 'Rechnungen',
    'dashboard.tab.pending': 'Ausstehend',
    'dashboard.tab.validation': 'Validierung',
    'dashboard.tab.approvals': 'Freigaben',
    'dashboard.tab.analytics': 'Analytik',
    'dashboard.tab.chat': 'KI-Chat',
    'dashboard.tab.settings': 'Einstellungen',

    // ─── Settings — Billing card ───────────────────────────────────────
    'settings.billing.title': 'Abrechnung',
    'settings.billing.description': 'Verwalten Sie Ihr Abonnement, Plan und Nutzung',
    'settings.billing.currentPlan': 'Aktueller Plan',
    'settings.billing.invoicesThisPeriod': 'Rechnungen in diesem Zeitraum',
    'settings.billing.manageBilling': 'Abrechnung verwalten',
    'settings.billing.openingPortal': 'Portal wird geöffnet...',
    'settings.billing.upgradePlan': 'Plan upgraden',
    'settings.billing.redirecting': 'Weiterleitung...',
    'settings.billing.upgradeTo': 'Upgrade auf',
    'settings.billing.euVatNote': 'EU-MwSt wird beim Checkout über Stripe Tax berechnet und eingezogen. Jederzeit aus dem Kundenportal kündbar — EU-Verbraucher behalten ihr 14-tägiges Widerrufsrecht.',
    'settings.billing.nextRenewal': 'Nächste Verlängerung',
    'settings.billing.monthlyBilling': 'monatliche Abrechnung',
    'settings.billing.annualBilling': 'jährliche Abrechnung',

    // ─── Footer ─────────────────────────────────────────────────────────
    'footer.product': 'Produkt',
    'footer.legal': 'Rechtliches',
    'footer.resources': 'Ressourcen',
    'footer.rights': 'Alle Rechte vorbehalten.',

    // ─── Cookie banner ─────────────────────────────────────────────────
    'cookie.text': 'Wir verwenden Cookies für Grundfunktionen, Analyse und Marketing (mit Ihrer Zustimmung). Siehe unsere Cookie-Richtlinie für Details.',
    'cookie.accept': 'Alle akzeptieren',
    'cookie.reject': 'Nicht-notwendige ablehnen',
    'cookie.manage': 'Einstellungen verwalten',

    // ─── Common / generic ──────────────────────────────────────────────
    'common.loading': 'Laden...',
    'common.cancel': 'Abbrechen',
    'common.save': 'Speichern',
    'common.delete': 'Löschen',
    'common.confirm': 'Bestätigen',
    'common.back': 'Zurück',
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
 * Falls back to 'en' for any unsupported locale.
 */
export function detectBrowserLanguage(): Language {
  if (typeof navigator === 'undefined') return DEFAULT_LANGUAGE;
  const langs = navigator.languages ?? [navigator.language];
  for (const l of langs) {
    const lower = l.toLowerCase();
    if (lower.startsWith('cs') || lower.startsWith('cz')) return 'cz';
    if (lower.startsWith('sk')) return 'sk';
    if (lower.startsWith('de')) return 'de';
  }
  return DEFAULT_LANGUAGE;
}
