'use client';

import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion';
import { useI18n } from '@/lib/i18n';

// 6 FAQ pairs keyed by index — translations are in src/lib/i18n/translations.ts
// under faq.q1 ... faq.q6 + faq.a1 ... faq.a6.
const FAQ_KEYS = [
  { q: 'faq.q1', a: 'faq.a1' },
  { q: 'faq.q2', a: 'faq.a2' },
  { q: 'faq.q3', a: 'faq.a3' },
  { q: 'faq.q4', a: 'faq.a4' },
  { q: 'faq.q5', a: 'faq.a5' },
  { q: 'faq.q6', a: 'faq.a6' },
];

export function FaqSection() {
  const { t } = useI18n();
  return (
    <section className="py-24 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl 2xl:max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground">
            {t('faq.title')}
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            {t('faq.subtitle')}
          </p>
        </div>

        <Accordion type="single" collapsible className="w-full">
          {FAQ_KEYS.map((faq, i) => (
            <AccordionItem
              key={i}
              value={`faq-${i}`}
              className="border-border"
            >
              <AccordionTrigger className="text-base font-medium text-foreground">
                {t(faq.q)}
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                {t(faq.a)}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
