import LegalLayout from '@/app/legal-layout';

export const dynamic = 'force-static';

export default function AIActNoticePage() {
  return (
    <LegalLayout title="AI Transparency Notice" lastUpdated="December 9, 2026">
      <section>
        <h2>EU AI Act Compliance (Regulation EU 2024/1689)</h2>
        <p>
          Per Article 50 of the EU AI Act (effective August 2, 2026), deployers of AI systems must inform natural persons
          that they are interacting with an artificial intelligence system. This notice fulfills that
          obligation.
        </p>
      </section>

      <section>
        <h2>1. AI Disclosure</h2>
        <p>
          <strong>OmniParse uses artificial intelligence.</strong> Specifically:
        </p>
        <ul>
          <li><strong>Document parsing:</strong> A vision-language model (VLM) analyzes uploaded documents (PDFs, images) to extract structured invoice data. This happens via the /api/parse endpoint.</li>
          <li><strong>Chat assistant:</strong> A large language model (LLM) generates responses to your questions about your invoice data. This happens via the /api/chat endpoint.</li>
          <li><strong>Artifact generation:</strong> The chat AI may generate structured data (tables, charts, summaries) based on your requests. These are rendered as interactive UI elements within the chat.</li>
        </ul>
        <p>
          You are interacting with AI-generated output throughout the Service. All parsing results, chat
          responses, and generated artifacts are produced by AI models and should be treated accordingly.
        </p>
      </section>

      <section>
        <h2>2. System Classification</h2>
        <p>
          Based on the intended purposes and functionality of the Service, we currently do not intend
          the Service to perform any of the high-risk functions listed in Annex III of the EU AI Act.
          The Service is nevertheless subject to applicable transparency requirements under Article 50,
          including those applicable to AI systems that directly interact with users.
        </p>
        <p>
          As the provider of the Service under our own name and brand, we acknowledge our
          responsibilities under the EU AI Act. This assessment may change if the Service is used in
          high-risk contexts. We will update this notice accordingly and implement the required
          obligations if reclassification occurs.
        </p>
      </section>

      <section>
        <h2>3. Technology Details</h2>
        <ul>
          <li><strong>Type:</strong> Document understanding and natural language processing</li>
          <li><strong>Components:</strong> Vision-language model (VLM) for document parsing, Language model (LLM) for chat</li>
          <li><strong>Purpose:</strong> Extract structured data from documents and provide conversational analysis</li>
          <li><strong>Data processed:</strong> Invoices and related documents may contain personal data (e.g. names, email addresses, phone numbers, bank account details, signatures). Depending on how the Service is used, we may process personal data on behalf of users or their organizations.</li>
          <li><strong>AI providers:</strong>
            <ul>
              <li><strong>Mistral AI</strong> (Paris, France — EU). As an EU-based provider, transfers to Mistral are expected to remain within the EEA, though this depends on Mistral&apos;s applicable terms and data-processing agreements.</li>
              <li><strong>OpenRouter</strong> (United States) — used when Mistral is unavailable.</li>
              <li><strong>Groq Inc.</strong> (United States) — SCCs confirmed in effect (see §8 below).</li>
              <li><strong>Google LLC</strong> (United States) — final fallback provider.</li>
            </ul>
          </li>
          <li><strong>Model selection policy:</strong> We may use multiple third-party AI providers to process uploaded content. The provider used for a particular request may depend on availability, capacity, configuration, and other operational factors. A current list of subprocessors and applicable processing locations is available in our Privacy Policy.</li>
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
          <li><strong>Confidence score reliability:</strong> Confidence scores are model-generated estimates, not verified accuracy measurements.</li>
          <li><strong>Provider availability:</strong> Free-tier AI providers (OpenRouter, Groq, Google Gemini) impose rate limits. During periods of high demand, the chat may return &quot;temporarily busy&quot; messages.</li>
        </ul>
        <p>
          <strong>Always verify AI-generated data against your original documents before using it for any
          purpose where accuracy matters (financial reporting, tax filing, legal proceedings).</strong>
        </p>
      </section>

      <section>
        <h2>5. Human Oversight</h2>
        <p>OmniParse provides the following human oversight mechanisms:</p>
        <ul>
          <li><strong>Confidence scores:</strong> Every extraction includes a confidence score. Low-confidence items are flagged for review.</li>
          <li><strong>Manual review:</strong> Users can review, edit, or delete any extracted data at any time.</li>
          <li><strong>No autonomous decisions:</strong> The AI does not make decisions, categorize individuals, or take actions on its own. It only extracts and presents data for human review.</li>
          <li><strong>Feedback loop:</strong> Users can re-upload documents, correct results, and delete inaccurate data.</li>
        </ul>
      </section>

      <section>
        <h2>6. Data Handling and AI Training</h2>
        <ul>
          <li><strong>Processing by AI providers:</strong> Documents and chat messages are sent to AI providers for inference. Data may be temporarily processed, cached, or retained by AI providers for security, abuse prevention, monitoring, billing, debugging, or other purposes specified in their applicable terms and data-processing agreements. Retention periods and processing locations vary by provider and service configuration.</li>
          <li><strong>Stored on our side:</strong> The uploaded document file is stored in your account database for 30 days (for preview), then automatically purged. Chat messages are stored in your account until you delete them.</li>
          <li><strong>Model training:</strong> We do not intentionally use customer documents or conversations to train or fine-tune AI models. Processing by third-party AI providers is governed by the applicable provider terms and data-processing agreements. The specific terms vary by provider, service tier (paid vs. unpaid), and product configuration.</li>
          <li><strong>Important note on free-tier AI APIs:</strong> Some AI providers may have different data handling terms for free/unpaid API tiers compared to paid tiers. We recommend reviewing the applicable provider terms for details. For production use involving personal data, paid API tiers may provide stronger data protection guarantees.</li>
          <li><strong>Metadata logging:</strong> We log API request metadata (timestamps, success/failure, provider used) for operational purposes. We do not log the content of your documents to server logs.</li>
        </ul>
      </section>

      <section>
        <h2>7. Your Rights as an AI System User</h2>
        <ul>
          <li>Review original documents alongside extracted data</li>
          <li>Manually correct any AI-extracted fields</li>
          <li>Delete and re-upload documents to get new extractions</li>
          <li>Request explanation of how a specific extraction was made (contact us)</li>
          <li>Lodge a complaint about AI output quality (damr58h@gmail.com)</li>
          <li>Opt out of AI processing entirely (use the export feature and process documents manually)</li>
        </ul>
      </section>

      <section>
        <h2>8. International Transfers</h2>
        <p>
          AI processing is performed by Mistral AI (EU-based, Paris, France — no SCC needed), Groq Inc. (US — SCCs confirmed),
          OpenRouter (US — pending), and Google LLC (US — pending). Under GDPR Chapter V, transfers to the US require
          appropriate safeguards. We rely on Standard Contractual Clauses (SCCs) consistent with the Schrems II ruling.
        </p>
        <div className="border-l-4 border-emerald-500 bg-emerald-500/5 p-3 my-3 rounded-r">
          <p className="text-sm">
            <strong className="text-emerald-700 dark:text-emerald-500">SCC Status by provider (as of December 9, 2026):</strong>
          </p>
          <ul className="list-disc pl-5 mt-2 text-sm space-y-1">
            <li><strong>Groq Inc.</strong> — ✅ SCCs confirmed in effect (December 9, 2026). DPA with EU SCC Module 2 is self-executing upon acceptance of Groq Services Agreement. Governing law: Ireland. Competent authority: Irish DPC. 72-hour breach notification.</li>
            <li><strong>Mistral AI</strong> — EU-based (Paris, France). As an EU-established provider, transfers are expected to remain within the EEA, subject to Mistral&apos;s applicable terms and data-processing agreements.</li>
            <li><strong>OpenRouter</strong> — ⏳ SCC status: pending verification. DPA request sent December 2026.</li>
            <li><strong>Google LLC (Gemini)</strong> — ⏳ SCC status: pending verification. Google Cloud DPA available at cloud.google.com/terms/data-processing-addendum (self-executing upon acceptance of Google Cloud Terms).</li>
          </ul>
          <p className="text-sm mt-2">
            <strong className="text-emerald-700 dark:text-emerald-500">SCCs confirmed with Groq; Mistral is EU-based.</strong>{' '}
            AI processing via Mistral (EU) and Groq (US, SCCs confirmed) has appropriate safeguards
            in place. However, users should note that documents may contain personal data of multiple
            data subjects — the user is responsible for ensuring a valid legal basis for processing
            and transferring such data. OpenRouter and Google remain as fallbacks pending SCC
            verification.
          </p>
        </div>
        <p>
          Your primary database (Supabase) is hosted in Ireland (EU) — no transfer outside the EU for
          the primary data store.
        </p>
      </section>

      <section>
        <h2>9. Canadian AIDA</h2>
        <p>
          For Canadian users, the Artificial Intelligence and Data Act (AIDA), part of Bill C-27,
          imposes transparency and accountability requirements on AI systems. OmniParse is designed to
          comply with AIDA&apos;s requirements for transparency (this notice), monitoring (confidence
          scores), and human oversight (no autonomous decisions).
        </p>
      </section>

      <section>
        <h2>10. Czech Republic</h2>
        <p>
          Under Czech law, the following applies in addition to the EU AI Act:
        </p>
        <ul>
          <li><strong>Act No. 110/2019 Coll.</strong> on the processing of personal data — Czech GDPR implementation.</li>
          <li><strong>Act No. 181/2014 Sb.</strong> on cybersecurity — sets baseline security requirements for information systems.</li>
          <li><strong>Supervisory authority:</strong> Úřad pro ochranu osobních údajů (Office for Personal Data Protection), <a href="https://www.uoou.cz" target="_blank" rel="noopener">uoou.cz</a>.</li>
        </ul>
      </section>

      <section>
        <h2>11. Contact</h2>
        <ul>
          <li><strong>AI ethics concerns:</strong> damr58h@gmail.com</li>
          <li><strong>Data protection / GDPR:</strong> damr58h@gmail.com</li>
          <li><strong>Legal:</strong> damr58h@gmail.com</li>
        </ul>
      </section>

      <p className="text-xs mt-8">
        Complies with EU AI Act Regulation 2024/1689 (Art. 50, effective August 2, 2026), Czech Act No. 110/2019 Coll.,
        Czech Act No. 181/2014 Sb., and Canadian AIDA (Bill C-27).
      </p>
    </LegalLayout>
  );
}
