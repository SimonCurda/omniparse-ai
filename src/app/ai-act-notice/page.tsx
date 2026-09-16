import LegalLayout from '@/app/legal-layout';

export const dynamic = 'force-static';

export default function AIActNoticePage() {
  return (
    <LegalLayout title="AI Transparency Notice" lastUpdated="September 9, 2026">
      <section>
        <h2>EU AI Act Compliance (Regulation EU 2024/1689)</h2>
        <p>
          Per Article 52 of the EU AI Act, deployers of AI systems must inform natural persons
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
          Under the EU AI Act risk classification (Annex III), OmniParse is currently assessed as a
          <strong> minimal-risk AI system</strong> for the following reasons:
        </p>
        <ul>
          <li>It does not make autonomous decisions about individuals.</li>
          <li>It does not evaluate creditworthiness, eligibility for public assistance, or employment.</li>
          <li>It does not perform biometric identification or emotion recognition.</li>
          <li>It processes business documents (invoices), not personal data at scale.</li>
        </ul>
        <p>
          This assessment may change if the Service is used in high-risk contexts. We will update this
          notice accordingly and implement the required obligations under Articles 9-15 if
          reclassification occurs.
        </p>
      </section>

      <section>
        <h2>3. Technology Details</h2>
        <ul>
          <li><strong>Type:</strong> Document understanding and natural language processing</li>
          <li><strong>Components:</strong> Vision-language model (VLM) for document parsing, Language model (LLM) for chat</li>
          <li><strong>Purpose:</strong> Extract structured data from business documents and provide conversational analysis</li>
          <li><strong>AI providers:</strong>
            <ul>
              <li><strong>Mistral AI</strong> (Paris, France — EU) — primary provider. EU-based — transfers stay within EU, no SCC required. Models used: Pixtral Large (124B vision), Pixtral 12B (vision).</li>
              <li><strong>OpenRouter</strong> (United States) — secondary provider. Used when Mistral is unavailable. Models used: Ling 3.0 Flash VL, Google Gemma 4 (31B/26B), NVIDIA Nemotron, and others as availability changes.</li>
              <li><strong>Groq Inc.</strong> (United States) — tertiary provider. Models used: Llama 3.1 8B Instant, Llama 4 Scout 17B, Qwen 3.6 27B.</li>
              <li><strong>Google Gemini</strong> (United States) — final fallback provider. Models used: Gemini 2.0 Flash, Gemini 2.5 Flash, Gemini 1.5 Flash.</li>
            </ul>
          </li>
          <li><strong>Model selection policy:</strong> We use a 4-tier cascade approach — Mistral (EU, primary) is tried first, with automatic fallback to OpenRouter (8 models with 5-key rotation), then Groq (3 models), then Google Gemini (3 models with 3-key rotation) on rate-limit or unavailability. For EU users concerned about US transfers, configuring MISTRAL_API_KEY keeps vision extraction within the EU when Mistral is available.</li>
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
          <li><strong>Per-request processing:</strong> Documents and chat messages are sent to the AI provider only for the duration of the inference request. They are not permanently stored by OpenRouter, Groq, or Google.</li>
          <li><strong>Stored on our side:</strong> The uploaded document file is stored in your account database for 30 days (for preview), then automatically purged. Chat messages are stored in your account until you delete them.</li>
          <li><strong>No training on your data:</strong> Your documents and chat messages are not used to train or fine-tune AI models. OpenRouter, Groq, and Google all have policies prohibiting the use of customer API inputs for model training.</li>
          <li><strong>No content logging by us:</strong> We do not log the content of your documents or chat conversations to server logs. We do log API request metadata (timestamps, success/failure, model used) for operational purposes.</li>
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
          AI processing is performed by OpenRouter, Groq Inc., and Google LLC, all based in the United States. Under
          GDPR Chapter V, transfers to the US require appropriate safeguards. We rely on Standard
          Contractual Clauses (SCCs) consistent with the Schrems II ruling.
        </p>
        <div className="border-l-4 border-amber-500 bg-amber-500/5 p-3 my-3 rounded-r">
          <p className="text-sm">
            <strong className="text-amber-700 dark:text-amber-500">SCC Status by provider:</strong>
          </p>
          <ul className="list-disc pl-5 mt-2 text-sm space-y-1">
            <li><strong>Groq Inc.</strong> — SCCs in effect (October 15, 2025). DPA with EU SCC Module 2 is self-executing upon acceptance of Groq Services Agreement. Governing law: Ireland. Competent authority: Irish DPC.</li>
            <li><strong>Mistral AI</strong> — No SCC needed (EU-based, Paris, France). Transfers stay within the EU.</li>
            <li><strong>OpenRouter</strong> — SCC status: pending verification.</li>
            <li><strong>Google LLC (Gemini)</strong> — SCC status: pending verification. Google Cloud DPA available at cloud.google.com/terms/data-processing-addendum.</li>
          </ul>
          <p className="text-sm mt-2">
            With Groq SCCs in effect and Mistral being EU-based, OmniParse has two GDPR-compliant AI
            providers (Mistral for EU-only processing, Groq for US processing with SCCs). OpenRouter
            and Google remain as fallbacks pending SCC verification.
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
        Complies with EU AI Act Regulation 2024/1689 (Art. 52), Czech Act No. 110/2019 Coll.,
        Czech Act No. 181/2014 Sb., and Canadian AIDA (Bill C-27).
      </p>
    </LegalLayout>
  );
}
