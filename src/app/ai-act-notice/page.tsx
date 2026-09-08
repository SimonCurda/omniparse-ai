import LegalLayout from '@/app/legal-layout';

export const dynamic = 'force-static';

export default function AIActNoticePage() {
  return (
    <LegalLayout title="AI Transparency Notice" lastUpdated="August 5, 2026">
      <section>
        <h2>EU AI Act Compliance (Regulation EU 2024/1689)</h2>
        <p>
          Per Article 52 of the EU AI Act, deployers of AI systems must inform natural persons
          that they are interacting with an artificial intelligence system. This notice fulfills that obligation.
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
          You are interacting with AI-generated output throughout the Service. All parsing results, chat responses,
          and generated artifacts are produced by AI models and should be treated accordingly.
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
          This assessment may change if the Service is used in high-risk contexts. We will update this notice accordingly
          and implement the required obligations under Articles 9-15 if reclassification occurs.
        </p>
      </section>

      <section>
        <h2>3. Technology Details</h2>
        <ul>
          <li><strong>Type:</strong> Document understanding and natural language processing</li>
          <li><strong>Components:</strong> Vision-language model (VLM) for document parsing, Language model (LLM) for chat</li>
          <li><strong>Purpose:</strong> Extract structured data from business documents and provide conversational analysis</li>
          <li><strong>AI provider:</strong> Google Gemini (Google DeepMind)</li>
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
        </ul>
        <p>
          <strong>Always verify AI-generated data against your original documents before using it for any purpose
          where accuracy matters (financial reporting, tax filing, legal proceedings).</strong>
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
          <li><strong>Per-request processing:</strong> Documents are processed in memory and not stored permanently on our servers.</li>
          <li><strong>No training on your data:</strong> Your documents and chat messages are not used to train or fine-tune AI models.</li>
          <li><strong>No logging of content:</strong> We do not log the content of your documents or chat conversations.</li>
          <li><strong>AI provider obligations:</strong> Our AI providers are bound by data processing agreements that prohibit using your data for training.</li>
        </ul>
      </section>

      <section>
        <h2>7. Your Rights as an AI System User</h2>
        <ul>
          <li>Review original documents alongside extracted data</li>
          <li>Manually correct any AI-extracted fields</li>
          <li>Delete and re-upload documents to get new extractions</li>
          <li>Request explanation of how a specific extraction was made (contact support)</li>
          <li>Lodge a complaint about AI output quality (ai-ethics@omniparse.ai)</li>
          <li>Opt out of AI processing entirely (use the export feature and process documents manually)</li>
        </ul>
      </section>

      <section>
        <h2>8. Canadian AIDA</h2>
        <p>
          For Canadian users, the Artificial Intelligence and Data Act (AIDA), part of Bill C-27, imposes
          transparency and accountability requirements on AI systems. OmniParse is designed to comply with
          AIDA&apos;s requirements for:
        </p>
        <ul>
          <li><strong>Transparency:</strong> This notice and in-app disclosures inform users about AI use.</li>
          <li><strong>Monitoring:</strong> Users can monitor AI output quality through confidence scores and review capabilities.</li>
          <li><strong>Human oversight:</strong> No autonomous AI decisions; all outputs require human review.</li>
        </ul>
      </section>

      <section>
        <h2>9. Czech Republic</h2>
        <p>
          Under Czech Act No. 250/2021 Sb. on cybersecurity and related AI governance,
          and in accordance with the Czech National AI Strategy, OmniParse provides the
          transparency and oversight measures described in this notice.
        </p>
      </section>

      <section>
        <h2>10. Contact</h2>
        <ul>
          <li><strong>AI ethics concerns:</strong> ai-ethics@omniparse.ai</li>
          <li><strong>Data protection:</strong> dpo@omniparse.ai</li>
          <li><strong>Legal:</strong> legal@omniparse.ai</li>
        </ul>
      </section>

      <p className="text-xs mt-8">
        Complies with EU AI Act Regulation 2024/1689 (Art. 52), Czech Act No. 250/2021 Sb.,
        and Canadian AIDA (Bill C-27).
      </p>
    </LegalLayout>
  );
}
