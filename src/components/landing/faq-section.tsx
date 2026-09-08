'use client';

import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion';

const faqs = [
  {
    q: 'How accurate is the AI extraction?',
    a: 'Our vision-language model typically achieves 95-99% accuracy on standard invoices. Accuracy depends on document quality — clear PDFs and photos work best. Every field includes a confidence score so you know exactly what to verify.',
  },
  {
    q: 'What file formats are supported?',
    a: 'PDF invoices, receipts, and document photos in JPEG, PNG, and WebP format. Maximum file size is 10MB per document.',
  },
  {
    q: 'Is my data secure?',
    a: 'Yes. Documents are processed per-request and are not used to train AI models. Built with GDPR, EU AI Act & PIPEDA principles — including data export, account deletion, and audit logging. You can delete your data at any time.',
  },
  {
    q: 'Can I export the extracted data?',
    a: 'Free plans support CSV export. Pro and above add JSON and Excel (.xlsx) export with styled columns. Plus and higher plans include custom export templates to match your accounting system\'s format.',
  },
  {
    q: 'What happens if the AI makes a mistake?',
    a: 'Every extracted field has a confidence score. Low-confidence fields are flagged automatically. Pro plan and above let you manually edit extracted data and re-validate. The validation engine runs 8+ built-in rules to catch common errors.',
  },
  {
    q: 'Do you offer a free plan?',
    a: 'Yes — the Free plan includes 15 invoices per month with AI extraction, confidence scores, tampering detection, and CSV export. No credit card required.',
  },
];

export function FaqSection() {
  return (
    <section className="py-24 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground">
            Frequently Asked Questions
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Everything you need to know about OmniParse.
          </p>
        </div>

        <Accordion type="single" collapsible className="w-full">
          {faqs.map((faq, i) => (
            <AccordionItem
              key={i}
              value={`faq-${i}`}
              className="border-border"
            >
              <AccordionTrigger className="text-base font-medium text-foreground">
                {faq.q}
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                {faq.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
