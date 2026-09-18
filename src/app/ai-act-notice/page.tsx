import LegalLayout from '@/app/legal-layout';

export const dynamic = 'force-static';

export default function AIActNoticePage() {
  return (
    <LegalLayout title="AI Transparency Notice" lastUpdated="September 18, 2026">
      <section>
        <h2>EU AI Act Compliance (Regulation EU 2024/1689)</h2>
        <p>
          Per Article 50 of the EU AI Act (applicable since <strong>2 August 2026</strong>), deployers of
          AI systems must inform natural persons that they are interacting with an artificial intelligence
          system. This notice fulfills that obligation. Article 5 prohibitions on certain AI practices
          have been applicable since <strong>2 February 2025</strong>; OmniParse confirms that none of
          its processing falls within any Article 5 prohibited category (social scoring, manipulative AI,
          untargeted facial scraping, emotion recognition in workplaces/schools, etc.).
        </p>
      </section>

      <section>
        <h2>1. AI Disclosure</h2>
        <p>
          <strong>OmniParse uses artificial intelligence.</strong> Specifically:
        </p>
        <ul>
          <li><strong>Document parsing:</strong> A vision-language model (VLM) analyzes uploaded documents (PDFs, images) to extract structured invoice data.</li>
          <li><strong>Chat assistant:</strong> A large language model (LLM) generates responses to your questions about your invoice data.</li>
          <li><strong>Artifact generation:</strong> The chat AI may generate structured data (tables, charts, summaries) based on your requests.</li>
        </ul>
        <p>
          You are interacting with AI-generated output throughout the Service. All parsing results, chat
          responses, and generated artifacts are produced by AI models and should be treated accordingly.
        </p>
      </section>

      <section>
        <h2>2. System Classification</h2>
        <p>
          Based on the intended purposes and functionality of the Service, we have assessed OmniParse
          against the high-risk use cases listed in Annex III of the EU AI Act. <strong>OmniParse is not
          a high-risk AI system</strong> under Annex III, because invoice OCR/extraction and
          conversational analytics do not fall within any of the high-risk categories listed (which
          include biometric identification, critical infrastructure management, education/employment
          decisions, essential private/public services, law enforcement, migration/border control, and
          justice/democratic processes).
        </p>
        <p>
          The Service is nevertheless subject to applicable transparency requirements under Article 50,
          including those applicable to AI systems that directly interact with users (Art. 50(1)) and to
          AI-generated or manipulated content (Art. 50(4)).
        </p>
        <p>
          As the provider of the Service under our own name and brand, we acknowledge our
          responsibilities under the EU AI Act. This assessment may change if the Service is used in
          high-risk contexts. We will update this notice accordingly and implement the required
          obligations if reclassification occurs.
        </p>
        <p>
          <strong>General-Purpose AI (GPAI) classification:</strong> The AI models used by OmniParse
          (e.g., Gemini, Pixtral, Llama) are developed by upstream providers (Google, Mistral, Meta,
          etc.) and may qualify as GPAI models under Art. 3(63). OmniParse is a <strong>deployer</strong>
          of these models, not a GPAI provider. Transparency obligations applicable to GPAI providers
          under Art. 53 rest with the upstream model providers. OmniParse relies on the technical
          documentation and information provided by those upstream providers.
        </p>
      </section>

      <section>
        <h2>3. Technology Details</h2>
        <ul>
          <li><strong>Type:</strong> Document understanding and natural language processing</li>
          <li><strong>Components:</strong> Vision-language model (VLM) for document parsing, Language model (LLM) for chat</li>
          <li><strong>Purpose:</strong> Extract structured data from documents and provide conversational analysis</li>
          <li><strong>Data processed:</strong> Invoices and related documents may contain personal data (e.g. names, email addresses, phone numbers, bank account details, signatures). Depending on how the Service is used, we may process personal data on behalf of users or their organizations.</li>
          <li><strong>AI providers:</strong> We may use multiple third-party AI providers to process uploaded content. The provider used for a particular request may depend on availability, capacity, configuration, and other operational factors. A current list of subprocessors and applicable processing locations is available in our Privacy Policy.</li>
        </ul>
      </section>

      <section>
        <h2>4. Known Limitations</h2>
        <p><strong>The AI may make mistakes. Specific risk areas include:</strong></p>
        <ul>
          <li><strong>Inaccurate extraction:</strong> Low-quality scans, unusual layouts, handwritten text, or non-English documents may produce errors.</li>
          <li><strong>Hallucinations in chat:</strong> The AI may generate plausible but factually incorrect information about your data.</li>
          <li><strong>Artifact errors:</strong> Generated tables, charts, and summaries inherit any extraction or reasoning errors.</li>
          <li><strong>Currency and formatting:</strong> May misinterpret currency symbols, date formats, or number formatting across regions.</li>
          <li><strong>Calculation errors:</strong> Calculations and statistics generated by the Service may contain errors, including errors caused by incorrect extraction, interpretation, aggregation, rounding, currency conversion or other processing. You are responsible for independently verifying results before relying on them.</li>
          <li><strong>Confidence indicators:</strong> AI-generated confidence indicators are heuristic signals intended to help prioritize manual review. They are not statistical probabilities and do not constitute a guarantee of accuracy.</li>
          <li><strong>Provider availability:</strong> AI providers may impose rate limits, discontinue models, or become unavailable. During periods of high demand, the Service may return &quot;temporarily busy&quot; messages.</li>
        </ul>
        <p>
          <strong>Always verify AI-generated data against your original documents before using it for any
          purpose where accuracy matters (financial reporting, tax filing, legal proceedings).</strong>
        </p>
      </section>

      <section>
        <h2>5. No Professional Advice</h2>
        <p>
          The Service is provided for informational and administrative purposes only and does not
          constitute accounting, tax, legal, financial or other professional advice.
        </p>
        <p>
          AI-generated calculations, classifications, summaries, recommendations and chat responses
          must not be relied upon as the sole basis for financial, accounting, tax, legal or business
          decisions. Always consult a qualified professional for advice specific to your situation.
        </p>
        <p>
          Currency conversions, exchange rates, tax calculations and financial aggregations may be
          inaccurate or based on incomplete or outdated information.
        </p>
      </section>

      <section>
        <h2>6. Human Oversight</h2>
        <p>OmniParse provides the following human oversight mechanisms (consistent with AI Act Art. 14 best practices, even though the Service is not high-risk):</p>
        <ul>
          <li><strong>Confidence indicators:</strong> Extractions include heuristic confidence indicators to help prioritize manual review. These are not statistical probabilities.</li>
          <li><strong>Manual review:</strong> Users can review, edit, or delete any extracted data at any time.</li>
          <li><strong>No autonomous decisions:</strong> The AI does not make decisions, categorize individuals, or take actions on its own. It only extracts and presents data for human review. Invoice approvals, payment authorizations, and vendor categorizations require explicit user action.</li>
          <li><strong>Feedback loop:</strong> Users can re-upload documents, correct results, and delete inaccurate data.</li>
          <li><strong>Audit trail:</strong> All user actions (edits, approvals, deletions) are logged in the user&apos;s account audit log for traceability.</li>
        </ul>
      </section>

      <section>
        <h2>7. Data Handling and AI Training</h2>
        <ul>
          <li><strong>Processing by AI providers:</strong> Documents and chat messages are sent to AI providers for inference. Data may be temporarily processed, cached, or retained by AI providers for security, abuse prevention, monitoring, billing, debugging, or other purposes specified in their applicable terms and data-processing agreements. Retention periods and processing locations vary by provider and service configuration.</li>
          <li><strong>Stored on our side:</strong> We retain uploaded documents for up to 30 days in the active application environment. Backup copies, security logs and data processed by third-party providers may be retained for different periods where necessary for security, legal or operational purposes, as described in our Privacy Policy.</li>
          <li><strong>Model training:</strong> We do not intentionally use customer documents or conversations to train or fine-tune AI models. Processing by third-party AI providers is governed by the applicable provider terms and data-processing agreements. The specific terms vary by provider, service tier (paid vs. unpaid), and product configuration.</li>
          <li><strong>Important note on free-tier AI APIs:</strong> Some AI providers may have different data handling terms for free/unpaid API tiers compared to paid tiers. We recommend reviewing the applicable provider terms for details. For production use involving personal data, paid API tiers may provide stronger data protection guarantees.</li>
          <li><strong>Metadata logging:</strong> We log API request metadata (timestamps, success/failure, provider used) for operational purposes. We do not log the content of your documents to server logs.</li>
        </ul>
      </section>

      <section>
        <h2>8. Model and Provider Changes</h2>
        <p>
          AI models, providers and processing methods may be changed, updated, replaced or discontinued
          at any time without notice. Changes in models may affect extraction results, classifications,
          calculations and chat responses. The same input document may produce different results when
          processed by different models or at different times.
        </p>
        <p>
          The Service is provided on an &quot;as is&quot; and &quot;as available&quot; basis. We do not
          guarantee uninterrupted, error-free or continuously available operation of the Service or any
          AI provider. AI models and third-party providers may change, become unavailable, impose rate
          limits, discontinue models or modify their capabilities without notice.
        </p>
      </section>

      <section>
        <h2>9. Your Rights as an AI System User</h2>
        <ul>
          <li>Review original documents alongside extracted data</li>
          <li>Manually correct any AI-extracted fields</li>
          <li>Delete and re-upload documents to get new extractions</li>
          <li>Request information about the processing and factors relevant to an AI-generated result, where technically and legally available (contact us)</li>
          <li>Lodge a complaint about AI output quality (damr58h@gmail.com)</li>
          <li>You may stop using AI-powered processing and delete your data. Where supported, you may export your data for processing outside the Service.</li>
        </ul>
      </section>

      <section>
        <h2>10. International Transfers</h2>
        <p>
          AI processing is performed by Mistral AI (EU-based, Paris, France), Groq Inc. (US — SCCs confirmed),
          OpenRouter (US — pending), and Google LLC (US — DPF-certified). Under GDPR Chapter V, transfers
          to the US require appropriate safeguards. We rely on the EU-US Data Privacy Framework (DPF)
          adequacy decision (10 July 2023, currently subject to CJEU appeal in &quot;Schrems III&quot;) for
          DPF-certified recipients, and on Standard Contractual Clauses (SCCs) consistent with the
          Schrems II ruling for non-DPF-certified recipients, together with Transfer Impact
          Assessments (TIAs) where required.
        </p>
        <div className="border-l-4 border-emerald-500 bg-emerald-500/5 p-3 my-3 rounded-r">
          <p className="text-sm">
            <strong className="text-emerald-700 dark:text-emerald-500">SCC Status by provider (as of September 18, 2026):</strong>
          </p>
          <ul className="list-disc pl-5 mt-2 text-sm space-y-1">
            <li><strong>Groq Inc.</strong> — SCCs confirmed in effect (DPA dated October 15, 2025; EU SCC Module 2 is self-executing upon acceptance of Groq Services Agreement). DPA accessible at <a href="https://console.groq.com" target="_blank" rel="noopener">console.groq.com</a>. Governing law: Ireland. Competent authority: Irish DPC. 72-hour breach notification. DPF certification status pending verification.</li>
            <li><strong>Mistral AI</strong> — EU-based (Paris, France). As an EU-established provider, transfers are expected to remain within the EEA, subject to Mistral&apos;s applicable terms and data-processing agreements.</li>
            <li><strong>OpenRouter</strong> — SCC status: pending verification. DPA request sent August 2026.</li>
            <li><strong>Google LLC (Gemini)</strong> — Google Cloud DPA self-executing upon acceptance of Google Cloud Terms; available at <a href="https://cloud.google.com/terms/data-processing-addendum" target="_blank" rel="noopener">cloud.google.com/terms/data-processing-addendum</a>. Google LLC is DPF-certified.</li>
            <li><strong>Vercel Inc.</strong> — DPF-certified. DPA available at <a href="https://vercel.com/legal/dpa" target="_blank" rel="noopener">vercel.com/legal/dpa</a>.</li>
            <li><strong>Stripe Inc.</strong> — DPF-certified. DPA available at <a href="https://stripe.com/legal/dpa" target="_blank" rel="noopener">stripe.com/legal/dpa</a>.</li>
          </ul>
          <p className="text-sm mt-2">
            <strong className="text-emerald-700 dark:text-emerald-500">Summary:</strong> AI processing via Mistral (EU) and Groq (US, SCCs confirmed) has appropriate safeguards in place. Google is DPF-certified. OpenRouter remains pending SCC verification. Users should note that documents may contain personal data of multiple data subjects — the user is responsible for ensuring a valid legal basis for processing and transferring such data.
          </p>
        </div>
        <p>
          Your primary database (Supabase) is hosted in Ireland (EU) — no transfer outside the EU for
          the primary data store.
        </p>
      </section>

      <section>
        <h2>11a. AI Literacy (AI Act Art. 4)</h2>
        <p>
          Pursuant to Article 4 of the EU AI Act (applicable since 2 February 2025), providers and
          deployers of AI systems shall take measures to ensure, to their best extent, a sufficient
          level of AI literacy in their staff and persons dealing with the operation and use of AI
          systems on their behalf. OmniParse acknowledges this obligation and provides this Notice
          (plus the in-Service AI disclaimers) as part of user-facing AI literacy. Internal staff
          training on AI capabilities, limitations, and risks is documented in our internal records
          and updated at least annually, or when significant changes to AI features occur.
        </p>
      </section>

      <section>
        <h2>11b. Logging and Monitoring</h2>
        <p>
          Although OmniParse is not classified as a high-risk AI system (and therefore Article 12
          logging requirements do not strictly apply), we maintain the following logging practices as
          best practice:
        </p>
        <ul>
          <li><strong>Application-level audit log:</strong> User actions (invoice create/edit/approve/delete, chat send) are logged in the user&apos;s account and retained for the lifetime of the account.</li>
          <li><strong>Server-side operational logs:</strong> Vercel function logs retained for 30 days for debugging and incident investigation.</li>
          <li><strong>AI request metadata:</strong> Timestamps, provider used, success/failure status, and request duration are logged for operational monitoring. The <strong>content</strong> of documents and chat messages is not logged to server logs.</li>
          <li><strong>Incident logs:</strong> Security incidents involving AI systems are documented and retained for at least 2 years for regulatory audit purposes.</li>
        </ul>
      </section>

      <section>
        <h2>12. Contact</h2>
        <ul>
          <li><strong>AI ethics concerns:</strong> damr58h@gmail.com (subject line &quot;AI Ethics&quot;)</li>
          <li><strong>Data protection / GDPR:</strong> damr58h@gmail.com (subject line &quot;DSR&quot; or &quot;DPA&quot;)</li>
          <li><strong>Legal:</strong> damr58h@gmail.com</li>
          <li><strong>Czech DPA (ÚOOÚ):</strong> <a href="https://www.uoou.cz" target="_blank" rel="noopener">uoou.cz</a></li>
        </ul>
      </section>

      <p className="text-xs mt-8">
        The Service is intended to comply with applicable laws in the jurisdictions in which it is offered.
        Users remain responsible for ensuring that their use of the Service complies with applicable local requirements.
      </p>
    </LegalLayout>
  );
}
