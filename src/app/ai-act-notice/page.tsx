import LegalLayout from '@/app/legal-layout';

export const dynamic = 'force-static';

export default function AIActNoticePage() {
  return (
    <LegalLayout title="AI Transparency Notice" lastUpdated="September 19, 2026">
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
          Based on the current intended purpose and functionality of the Service, OmniParse does not
          currently identify a use case that falls within the high-risk categories listed in Annex III
          of the EU AI Act.
        </p>
        <p>
          The current Service is intended for invoice extraction, document analysis and conversational
          assistance. It is not intended to perform biometric identification, employment or education
          decisions, eligibility decisions for essential public or private services, law-enforcement
          assessments, migration or border-control decisions, or decisions in the administration of
          justice or democratic processes.
        </p>
        <p>
          The classification of any future feature depends on its specific intended purpose,
          functionality and manner of deployment and will be assessed separately where required.
        </p>
        <p>
          The Service is subject to applicable transparency requirements under Article 50 of the EU
          AI Act, in particular Article 50(1) (AI systems that interact with natural persons). The
          Service may also generate or manipulate content using AI. Where applicable, we will
          implement the transparency measures required by Article 50 for AI-generated or manipulated
          content (Article 50(4)). We do not assert that every output of the Service automatically
          falls within all Article 50(4) sub-categories; the applicability of specific transparency
          obligations is assessed based on the nature of the output and the context of its use.
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
          etc.) and may qualify as GPAI models under Art. 3(63). OmniParse&apos;s AI Act role depends on
          the specific component and context: OmniParse may act as a <strong>deployer</strong> of these
          models (within the meaning of Art. 3(4)) when it uses them under its own name for the
          invoice-extraction and chat-assistant purposes. For some components — particularly where
          OmniParse integrates the model into a broader service offered under its own brand and
          substantially shapes the system&apos;s intended purpose — OmniParse&apos;s role may also be that
          of a <strong>downstream provider</strong> of an AI system within the meaning of Art. 25.
          The exact classification of each component is fact-specific and should be confirmed by
          legal counsel. Transparency obligations applicable to GPAI providers under Art. 53 rest
          with the upstream model providers (Google, Mistral, Meta, etc.). OmniParse relies on the
          technical documentation and information provided by those upstream providers.
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
          <li><strong>No autonomous high-impact decisions:</strong> In the current production configuration, AI features do not independently approve payments, execute payments, or make decisions about individuals with legal or similarly significant effects. AI extraction, classification and chat outputs are presented as assistive results for user review. Users remain responsible for reviewing and approving material business actions.</li>
          <li><strong>Future functionality:</strong> If OmniParse introduces features that independently make or materially influence decisions with legal or similarly significant effects concerning individuals, those features will be separately assessed under applicable GDPR and EU AI Act requirements before deployment.</li>
          <li><strong>Feedback loop:</strong> Users can re-upload documents, correct results, and delete inaccurate data.</li>
          <li><strong>Audit trail:</strong> All user actions (edits, approvals, deletions) are logged in the user&apos;s account audit log for traceability.</li>
        </ul>
      </section>

      <section>
        <h2>7. Data Handling and AI Training</h2>
        <ul>
          <li><strong>Processing by AI providers:</strong> Documents and chat messages are sent to AI providers for inference. Data may be temporarily processed, cached, or retained by AI providers for security, abuse prevention, monitoring, billing, debugging, or other purposes specified in their applicable terms and data-processing agreements. Retention periods and processing locations vary by provider and service configuration.</li>
          <li><strong>Stored on our side:</strong> We retain uploaded documents for up to 30 days in the active application environment. Backup copies, security logs and data processed by third-party providers may be retained for different periods where necessary for security, legal or operational purposes, as described in our Privacy Policy.</li>
          <li><strong>Model training — production configuration:</strong> OmniParse does not intentionally route customer content through AI API configurations that are documented by the provider as permitting provider training on customer content when the default production configuration is in effect. Specifically: (a) OmniParse sends <code>usage_options=&#123;&quot;enable_training&quot;: false&#125;</code> on every Mistral API call when <code>MISTRAL_DISABLE_TRAINING=true</code> (the default). This setting is effective on the applicable paid Mistral tier; on a free tier, Mistral may ignore or reject the parameter, and the parameter itself is not represented as an independent guarantee of provider-level data handling; (b) OpenRouter is disabled by default and is not used for customer content unless the operator explicitly enables it after completing the applicable contractual, data-protection and transfer review; (c) Groq processing is governed by the applicable Groq contractual and data-protection terms; and (d) Google Gemini through the Google AI Studio free-tier endpoint is disabled by default and is not used unless the operator explicitly enables it after reviewing the applicable Google AI Studio terms. Operators who change the default provider configuration are responsible for verifying the applicable provider terms, transfer mechanism, retention and training settings and, where necessary, updating the Privacy Policy and this AI Transparency Notice before processing customer content through the changed configuration.</li>
          <li><strong>Important note on free-tier AI APIs:</strong> Some AI providers may have different data handling terms for free/unpaid API tiers compared to paid tiers. We recommend reviewing the applicable provider terms for details. For production use involving personal data, paid API tiers may provide stronger data protection guarantees.</li>
          <li><strong>Metadata logging:</strong> We log API request metadata (timestamps, success/failure, provider used) for operational purposes. We do not log the content of your documents to server logs.</li>
        </ul>
      </section>

      <section>
        <h2>8. Model and Provider Changes</h2>
        <p>
          AI models, providers and processing methods may be changed, updated, replaced or discontinued.
          Material changes to AI providers (e.g., switching the primary vision-extraction provider)
          will be announced in the Service or by email at least 7 days in advance, except where the
          change is urgently required for security or availability reasons. Changes in models may
          affect extraction results, classifications, calculations and chat responses. The same input
          document may produce different results when processed by different models or at different
          times.
        </p>
        <p>
          The Service is provided on an &quot;as is&quot; and &quot;as available&quot; basis. We do not
          guarantee uninterrupted, error-free or continuously available operation of the Service or any
          AI provider. AI models and third-party providers may change, become unavailable, impose rate
          limits, discontinue models or modify their capabilities. Material changes will be notified
          per the above; immaterial changes (e.g., model version bumps within the same family) may
          happen without separate notice but will be reflected in the &quot;Last updated&quot; date of
          this Notice.
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
          AI processing in the default production configuration is performed by Mistral AI (EU-based,
          Paris, France) and Groq Inc. (US-based).
        </p>
        <p>
          OpenRouter and Google Gemini through Google AI Studio are disabled by default and are not
          used unless the operator explicitly enables them after completing the applicable contractual,
          data-protection and transfer review.
        </p>
        <p>
          Where personal data is transferred to a third country, OmniParse relies on an applicable
          lawful transfer mechanism under GDPR Chapter V, such as an adequacy decision, Standard
          Contractual Clauses (SCCs), or another lawful mechanism where applicable.
        </p>
        <p>
          For US recipients, the EU-US Data Privacy Framework (DPF) may provide an applicable transfer
          mechanism where the recipient is covered by the relevant DPF certification. Where an adequacy
          mechanism does not apply, OmniParse relies on an appropriate GDPR Chapter V safeguard, such
          as SCCs, together with supplementary measures or a Transfer Impact Assessment where
          appropriate.
        </p>
        <p>
          Google AI Studio free-tier processing is subject to Google&apos;s applicable AI Studio terms.
          The Google Cloud Data Processing Addendum applies to the applicable Google Cloud / Vertex AI
          services and should not be interpreted as automatically applying to Google AI Studio
          free-tier processing. This is one reason Google Gemini is disabled by default in the
          production configuration.
        </p>
        <p>
          The primary database is hosted by Supabase in Ireland (EU). The applicable processing
          locations and transfer safeguards are described in the Privacy Policy.
        </p>
      </section>

      <section>
        <h2>11a. AI Literacy (AI Act Art. 4)</h2>
        <p>
          Pursuant to Article 4 of the EU AI Act (applicable since 2 February 2025), providers and
          deployers of AI systems shall take measures to ensure, to their best extent, a sufficient
          level of AI literacy in their staff and persons dealing with the operation and use of AI
          systems on their behalf. This Notice forms part of OmniParse&apos;s measures supporting AI
          literacy among persons involved in the operation and use of the Service. It is not, by
          itself, a complete fulfillment of the Article 4 obligation — that obligation also
          encompasses internal staff training, operational documentation, and ongoing assessment of
          AI literacy needs. Internal staff training on AI capabilities, limitations, and risks is
          documented in our internal records and updated at least annually, or when significant
          changes to AI features occur.
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
