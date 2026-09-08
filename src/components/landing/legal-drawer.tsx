'use client';

import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

const LEGAL_CONTENT: Record<string, { title: string; content: string }> = {
  terms: {
    title: 'Terms of Service',
    content: `**Last updated: August 2025**

---

## 1. Acceptance of Terms

By accessing or using OmniParse (\"the Service\"), you agree to be bound by these Terms of Service (\"Terms\"). If you do not agree, do not use the Service.

## 2. Description of Service

OmniParse is an AI-powered document parsing application that extracts structured data from invoices. The Service uses vision-language models to analyze uploaded documents and return extracted data in JSON format.

**Current capabilities:** Document upload (PDF, JPEG, PNG, WebP), AI-powered field extraction with per-field confidence scores, AI chat with interactive artifacts, data export (CSV, JSON), user authentication, and visual analytics.

## 3. User Responsibilities

- You are solely responsible for the documents you upload.
- You must have the right to process any documents you submit.
- You must not use the Service for any unlawful purpose.
- You must not attempt to reverse-engineer or disrupt the Service.

## 4. Intellectual Property

Content you upload remains your property. OmniParse does not claim ownership. The Service itself is the property of OmniParse AI.

## 5. Data Processing

Documents are processed per-request and extracted data is stored in your account database. You can delete your data at any time.

## 6. Disclaimer of Warranties

THE SERVICE IS PROVIDED \"AS IS.\" AI-extracted data may contain errors. Always verify before use in financial or legal contexts.

## 7. Limitation of Liability

To the maximum extent permitted by law, OmniParse AI shall not be liable for any indirect, incidental, or consequential damages.

## 8. Governing Law

These Terms are governed by Czech law, with EU consumer protection laws applying additionally for EU users.

## 9. Contact

For questions: legal@omniparse.ai

---

*Compliant with EU Directive 93/13/EEC and Czech Act No. 89/2012 Sb. (Civil Code).*`,
  },
  privacy: {
    title: 'Privacy Policy',
    content: `**Last updated: August 2025**

---

## 1. Data Controller

**OmniParse AI** | DPO: dpo@omniparse.ai

For GDPR purposes (EU Regulation 2016/679), OmniParse AI is the data controller.

## 2. Personal Data We Collect

- **Email, name, and password hash** — When you create an account.
- **Documents you upload** — Processed per-request, extracted data stored in your account.
- **Chat messages** — Stored in your account for conversation context.
- **Technical data** — Browser type, device type for security.

## 3. Legal Basis (GDPR Art. 6)

- Document parsing: Consent (Art. 6(1)(a))
- Usage analytics: Legitimate interest (Art. 6(1)(f))
- Security: Legitimate interest (Art. 6(1)(f))

## 4. Data Retention

- Uploaded documents: Processed per-request, extracted fields stored in database.
- Account data: Duration of account + 30 days after deletion request.
- Chat messages: Until you clear them or delete your account.
- Analytics: 12 months, then anonymized.

## 5. Your Rights (GDPR Art. 12-23)

- Right of access (Art. 15)
- Right to rectification (Art. 16)
- Right to erasure (Art. 17)
- Right to restriction (Art. 18)
- Right to data portability (Art. 20)
- Right to object (Art. 21)
- Right to withdraw consent (Art. 7(3))

Contact: dpo@omniparse.ai. Response within 30 days.

## 6. Data Transfers

AI processing may involve EU/EEA-based model providers bound by GDPR Art. 28 data processing agreements.

## 7. Security

Encryption in transit, access controls, secure development (GDPR Art. 32).

## 8. PIPEDA Compliance (Canada)

For Canadian users, OmniParse complies with PIPEDA:

- Accountability, Identifying Purposes, Consent, Limiting Collection, Limiting Use, Accuracy, Safeguards, Openness, Individual Access, Challenging Compliance

Complaints: Office of the Privacy Commissioner of Canada (priv.gc.ca)

## 9. Czech Republic

Per Czech Act No. 110/2019 Coll.: Supervisory authority is the **Urad pro ochranu osobnich udaju** (uoou.cz), Pplk. Sochora 27, 170 00 Praha 7.

## 10. Contact

- DPO: dpo@omniparse.ai
- Czech Authority: uoou.cz
- Canadian Commissioner: priv.gc.ca

---

*Complies with EU GDPR, Czech Act No. 110/2019 Coll., Canadian PIPEDA.*`,
  },
  cookies: {
    title: 'Cookie Policy',
    content: `**Last updated: August 2025**

---

## 1. What Are Cookies

Small text files stored on your device. We primarily use Local Storage.

## 2. What We Use

**Essential (always active):** Theme preference, cookie consent, authentication token.

**Analytics (with consent):** Anonymous usage statistics (when implemented).

## 3. Your Rights

Under EU ePrivacy Directive and GDPR:
- Explicit consent required for non-essential cookies
- Withdraw consent by clearing local storage
- Right to be informed about data collection

## 4. Managing

Clear via browser settings. Blocking may affect functionality.

## 5. Contact

privacy@omniparse.ai

---

*Complies with EU ePrivacy Directive 2002/58/EC and Czech Act No. 127/2005 Coll.*`,
  },
  'ai-act': {
    title: 'AI Transparency Notice',
    content: `**Last updated: August 2025**

---

## EU AI Act Compliance (Regulation 2024/1689)

Per Article 52, deployers must inform users they are interacting with an AI system.

## 1. AI Disclosure

OmniParse uses AI. A vision-language model analyzes your documents. A language model generates chat responses.

## 2. System Details

- Type: Document understanding (not high-risk under current assessment)
- Technology: Vision-language model (VLM) + Language model (LLM)
- Purpose: Extract structured data from business documents

## 3. Limitations

**The AI may make mistakes:**
- Extracted data may be inaccurate (low-quality scans, unusual layouts, handwritten text, non-English)
- Chat may generate plausible but incorrect information (hallucinations)
- Artifacts inherit any extraction errors

**Always verify AI data against original documents.**

## 4. Human Oversight

- Confidence scores on all extractions
- Low-confidence items flagged for review
- Users can edit, delete, or correct any data
- AI makes no autonomous decisions

## 5. Data Handling

- Per-request processing, extracted data stored in your account
- No training on your documents
- No logging beyond request-response

## 6. Your Rights

- Review original vs extracted side-by-side
- Manually correct any fields
- Delete and re-upload documents
- Contact support for disputed results

## 7. Contact

ai-ethics@omniparse.ai

---

*Complies with EU AI Act Art. 52, Czech Act No. 250/2021 Sb., and Canadian AIDA.*/`,
  },
};

export function LegalDrawer({ page, onClose }: { page: string; onClose: () => void }) {
  const content = LEGAL_CONTENT[page];
  if (!content) return null;

  return (
    <div className="fixed inset-0 z-[100] flex justify-end">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-background border-l border-border flex flex-col animate-in slide-in-from-right duration-200">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="font-semibold text-lg">{content.title}</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-6 prose prose-sm dark:prose-invert max-w-none">
            {content.content.split('\n').map((line, i) => {
              if (line.startsWith('## ')) return <h2 key={i} className="text-lg font-bold mt-8 mb-3 first:mt-0">{line.slice(3)}</h2>;
              if (line.startsWith('### ')) return <h3 key={i} className="text-base font-semibold mt-6 mb-2">{line.slice(4)}</h3>;
              if (line.startsWith('**') && line.endsWith('**')) return <p key={i} className="font-bold mt-4 mb-2">{line.slice(2, -2)}</p>;
              if (line.startsWith('---')) return <hr key={i} className="my-6 border-border" />;
              if (line.startsWith('- ')) return <li key={i} className="ml-4 text-sm text-muted-foreground mb-1">{line.slice(2).replace(/\*\*/g, '')}</li>;
              if (line.trim() === '') return <div key={i} className="h-2" />;
              return <p key={i} className="text-sm text-muted-foreground leading-relaxed mb-2">{line.replace(/\*\*/g, '')}</p>;
            })}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
