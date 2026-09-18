import LegalLayout from '@/app/legal-layout';

export const dynamic = 'force-static';

export default function TermsOfServicePage() {
  return (
    <LegalLayout title="Terms of Service" lastUpdated="September 18, 2026">
      <section>
        <h2>1. Acceptance of Terms</h2>
        <p>
          By accessing or using OmniParse (&quot;the Service&quot;), you agree to be bound by these Terms
          of Service (&quot;Terms&quot;). If you do not agree with any part of these Terms, you must not
          use the Service. These Terms apply to all users of the Service.
        </p>
        <p>
          When you register an account, you are required to explicitly accept these Terms by checking the
          &quot;I agree to the Terms of Service and Privacy Policy&quot; checkbox. The timestamp of your
          acceptance is recorded in your account record. Continued use of the Service after any changes
          to these Terms constitutes acceptance of the updated Terms.
        </p>
      </section>

      <section>
        <h2>2. Description of Service</h2>
        <p>
          OmniParse is an AI-powered document parsing application that extracts structured data from
          invoices and similar business documents. The Service uses vision-language models to analyze
          uploaded documents and return extracted data in JSON format.
        </p>
        <p><strong>Current capabilities:</strong></p>
        <ul>
          <li>Document upload (PDF, JPEG, PNG, WebP) up to 20MB per file</li>
          <li>AI-powered field extraction with per-field confidence scores</li>
          <li>AI chat assistant with interactive artifact generation (tables, charts, summaries)</li>
          <li>Data export (CSV and JSON) from the invoices table</li>
          <li>Visual analytics dashboard with charts</li>
          <li>User authentication with email, password, and JWT tokens</li>
          <li>GDPR-compliant data export and account deletion</li>
        </ul>
      </section>

      <section>
        <h2>3. Eligibility</h2>
        <p>
          You must be at least <strong>15 years old</strong> to use this Service. This age corresponds
          to the age of digital consent in the Czech Republic under GDPR Art. 8 (as implemented by
          Czech Act No. 110/2019 Coll.). In other EU/EEA Member States where the age of digital consent
          is higher (e.g., 16 in Germany), you must meet that higher age requirement. The Service is
          not directed to children, and we do not knowingly collect personal data from children below
          the applicable age of digital consent.
        </p>
        <p>
          If you are under 18 but above the applicable age of digital consent, you confirm that you
          have obtained parental or guardian consent to use this Service and to enter into these Terms.
        </p>
        <p>
          If you are registering on behalf of a business entity, you confirm that you have the authority
          to bind that entity to these Terms.
        </p>
      </section>

      <section>
        <h2>4. User Responsibilities and Warranties</h2>
        <p>
          You represent and warrant that you have all rights, permissions and lawful authority necessary
          to upload, process and transmit documents, emails and other content through the Service.
        </p>
        <ul>
          <li>You are solely responsible for the documents you upload to the Service.</li>
          <li>You must have the legal right to process any documents you submit (ownership, authorization, or legitimate interest).</li>
          <li>You must not upload documents containing personal data of EU data subjects unless you have a legal basis to do so under GDPR.</li>
          <li>Unless explicitly supported by the Service, users must not upload documents containing special categories of personal data (such as health information, biometric data, information revealing religious or political beliefs, or other highly sensitive information).</li>
          <li>When using email import, the Service may process email content, headers, attachments and other information necessary to identify and process invoices. Users should not forward emails containing information that they are not authorized to disclose to the Service.</li>
          <li>You must not use the Service for any unlawful purpose, including fraud, money laundering, or tax evasion.</li>
          <li>You must not attempt to reverse-engineer, decompile, or disrupt the Service.</li>
          <li>You must not use automated tools to overwhelm the Service (no scraping, no DDoS, no rate-limit evasion).</li>
          <li>You must not attempt to extract other users&apos; data through IDOR attacks or similar exploits.</li>
          <li>You acknowledge that AI-extracted data may contain errors and you are responsible for verifying results before use.</li>
          <li>You are responsible for keeping your account password confidential.</li>
          <li>You are responsible for maintaining appropriate backups of documents and data that are important to you. The Service should not be considered the sole repository or archival system for financial records.</li>
        </ul>
      </section>

      <section>
        <h2>5. Intellectual Property and License</h2>
        <p>
          <strong>Your content:</strong> Content you upload (documents, chat messages, extracted data)
          remains your property. OmniParse does not claim ownership of your documents or extracted data.
          By uploading content, you grant OmniParse a worldwide, non-exclusive, royalty-free, revocable
          license to process, transmit, store, and display your content solely for the purpose of
          operating and providing the Service to you, including the right to transmit content to
          third-party AI inference providers as described in the Privacy Policy. This license terminates
          automatically when your content is deleted from the Service or your account is terminated.
        </p>
        <p>
          <strong>Service IP:</strong> The Service itself, including its source code, design, UI,
          documentation, brand, and underlying infrastructure, is the property of Simon Curda. You may
          not copy, modify, distribute, or create derivative works from the Service itself without
          written permission. The names &quot;OmniParse&quot; and associated logos are trademarks of
          Simon Curda.
        </p>
        <p>
          <strong>Feedback:</strong> If you provide feedback, suggestions, or ideas about the Service,
          you grant OmniParse a perpetual, irrevocable, royalty-free license to use and incorporate
          that feedback into the Service without obligation or compensation to you.
        </p>
      </section>

      <section>
        <h2>6. Data Processing</h2>
        <p>
          Uploaded documents are stored for 30 days for preview purposes, then automatically deleted.
          Extracted data is stored in your account database and is accessible from your dashboard. You
          can delete your data at any time. See our <a href="/privacy-policy" className="underline">Privacy
          Policy</a> for full details on data handling.
        </p>
      </section>

      <section>
        <h2>7. AI Disclaimer</h2>
        <p>
          THE SERVICE USES ARTIFICIAL INTELLIGENCE FOR DOCUMENT ANALYSIS, DATA EXTRACTION, AND
          CONVERSATIONAL CHAT RESPONSES. AI OUTPUT MAY CONTAIN ERRORS, INACCURACIES, OR HALLUCINATIONS.
        </p>
        <p>
          <strong>You must always verify AI-extracted data against the original documents</strong> before
          using it for financial reporting, tax filing, legal proceedings, or any context where accuracy
          is critical. OmniParse provides confidence scores as a guide, but these are estimates and not
          guarantees of accuracy.
        </p>
        <p>
          <strong>The AI Chat assistant is a conversational tool, not a source of truth.</strong> Responses
          to your questions about your invoice data are generated by AI models and may be inaccurate,
          incomplete, or out-of-context. Always cross-reference chat responses against the underlying
          invoice records and source documents before making financial decisions, payments, vendor
          communications, or tax filings based on them.
        </p>
        <p>
          <strong>AI providers:</strong> OmniParse uses third-party AI providers for vision extraction and text generation. The primary provider is <strong>Mistral AI</strong> (Paris, France — EU-based, no SCC required for transfers). <strong>Groq Inc.</strong> (US-based) has confirmed Standard Contractual Clauses (SCCs) in effect as of September 12, 2026 (EU SCC Module 2, self-executing under Groq's DPA). Fallback providers OpenRouter and Google Gemini (both US-based) have SCCs pending verification. These providers may experience rate limits, outages, or model deprecations that affect the availability and quality of AI features. We do not control and are not responsible for the behavior of these upstream models beyond our integration layer.
        </p>
        <p>
          See our <a href="/ai-act-notice" className="underline">AI Transparency Notice</a> for full
          details on AI limitations and your rights.
        </p>
      </section>

      <section>
        <h2>7a. No Professional Advice</h2>
        <p>
          The Service is provided for informational and administrative purposes only and does not
          constitute accounting, tax, legal, financial or other professional advice. AI-generated
          calculations, classifications, summaries, recommendations and chat responses must not be
          relied upon as the sole basis for financial, accounting, tax, legal or business decisions.
        </p>
        <p>
          Currency conversions, exchange rates, tax calculations and financial aggregations may be
          inaccurate or based on incomplete or outdated information. Always consult a qualified
          professional for advice specific to your situation.
        </p>
      </section>

      <section>
        <h2>7b. Calculation and Data Accuracy Disclaimer</h2>
        <p>
          Calculations and statistics generated by the Service may contain errors, including errors
          caused by incorrect extraction, interpretation, aggregation, rounding, currency conversion
          or other processing. You are responsible for independently verifying all results before
          relying on them for any purpose.
        </p>
        <p>
          AI models, providers and processing methods may be changed, updated, replaced or discontinued.
          Material changes to AI providers (e.g., switching the primary vision-extraction provider)
          will be announced in the Service or by email at least 7 days in advance, except where the
          change is urgently required for security or availability reasons. Changes in models may
          affect extraction results, classifications, calculations and chat responses. The same input
          document may produce different results when processed by different models or at different
          times.
        </p>
      </section>

      <section>
        <h2>8. Service Availability and Limitations (Including IMAP Email Capture)</h2>
        <p>
          <strong>The Service is provided on a best-effort basis.</strong> OmniParse uses automated
          processes (including IMAP email scanning, AI vision-language models, classification
          heuristics, and external AI providers) to capture and extract invoice data. None of these
          processes are guaranteed to be complete, accurate, or timely. We explicitly disclaim any
          warranty that the Service will capture every invoice, classify it correctly, or extract
          all data without error.
        </p>
        <p>
          <strong>The IMAP email auto-capture feature is an auxiliary convenience, not a substitute
          for proper invoice management.</strong> Specifically, the Service may fail to capture
          invoices for reasons including but not limited to:
        </p>
        <ul className="list-disc pl-6 space-y-1 text-sm">
          <li>AI provider rate limits, outages, model deprecations, or temporary unavailability</li>
          <li>Classifier false negatives (the AI incorrectly determines an email is not an invoice)</li>
          <li>Email attachment format issues (corrupted PDFs, unsupported image formats, encrypted archives)</li>
          <li>IMAP server-side issues (mailbox sync delays, throttling by Gmail/Outlook/etc.)</li>
          <li>Vercel function timeout (60-second limit per scan call)</li>
          <li>Network connectivity issues between Vercel, the email provider, and AI providers</li>
          <li>Pending Review queue cap (100 items per inbox — scan pauses when reached)</li>
          <li>Sender blocklist (user or system blocks a legitimate invoice sender)</li>
          <li>Emails older than the scan cursor (UID-based resume may skip emails if cursor is corrupted)</li>
          <li>Bugs, configuration errors, or schema migrations that affect data integrity</li>
        </ul>
        <p>
          <strong>You must not rely solely on the Service for time-critical or financially significant
          invoice management.</strong> You remain responsible for:
        </p>
        <ul className="list-disc pl-6 space-y-1 text-sm">
          <li>Periodically checking that all expected invoices have been captured</li>
          <li>Manually uploading invoices that the Service failed to capture</li>
          <li>Verifying due dates and payment deadlines against source documents</li>
          <li>Maintaining backup processes for invoice tracking independent of OmniParse</li>
          <li>Reviewing the Pending Review queue regularly (at minimum weekly, or before any payment run)</li>
        </ul>
        <p>
          <strong>OmniParse is not liable for missed invoices, late payment fees, vendor relationship
          damage, tax filing errors, late filing penalties, or any other damages arising from the
          Service&apos;s failure to capture or correctly process an invoice.</strong> This includes
          scenarios where the user has stopped checking their email inbox manually and relies
          exclusively on the Service&apos;s auto-capture feature.
        </p>
        <p>
          <strong>Czech law grounding:</strong> This limitation is consistent with:
        </p>
        <ul className="list-disc pl-6 space-y-1 text-sm">
          <li><strong>Act No. 89/2012 Sb. (Civil Code) § 2913:</strong> Parties may agree to limit
          contractual liability, except for damage caused intentionally or by gross negligence.
          Invoice extraction is an auxiliary convenience, not the user&apos;s primary business activity.</li>
          <li><strong>Act No. 89/2012 Sb. § 2913(2):</strong> In gratuitous (free) contracts,
          liability for slight negligence is generally excluded unless the damage was caused
          intentionally or by gross negligence.</li>
          <li><strong>Directive 93/13/EEC (Unfair Contract Terms) Art. 3 + 4:</strong> This clause
          is not unfair because (a) the Service is clearly auxiliary, (b) the user has alternative
          invoice management options, (c) the limitation is transparent and brought to the
          user&apos;s attention before signup.</li>
          <li><strong>Act No. 634/1992 Sb. (Consumer Protection) § 16:</strong> This clause does
          not disproportionately shift risk to the consumer because the user retains control of
          their email inbox and can always verify capture independently.</li>
        </ul>
        <p>
          <strong>For paid users only:</strong> Where OmniParse is found directly at fault for
          damages (e.g., a confirmed bug in our code, not a third-party AI provider issue),
          liability is capped at the amount you paid to OmniParse in the 12 months preceding
          the claim. For Free tier users, liability for slight negligence is excluded to the
          extent permitted by Czech Civil Code § 2913(2); liability for intentional damage
          and gross negligence remains unaffected in all cases.
        </p>
        <p>
          <strong>Notification of issues:</strong> If you become aware that the Service has failed
          to capture an invoice or has extracted incorrect data, please notify us at
          <strong> damr58h@gmail.com</strong> as soon as practicable. We will investigate and, where
          possible, restore or correct the affected data. Prompt notification helps us serve you
          better; this does not shorten any statutory limitation period under applicable law.
        </p>
      </section>

      <section>
        <h2>9. Disclaimer of Warranties</h2>
        <p>
          THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTIES OF
          ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF
          MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
        </p>
        <p>
          We do not warrant that the Service will be uninterrupted, error-free, or free of harmful
          components. We do not warrant that AI extraction results will be accurate or complete.
          AI providers (Mistral, OpenRouter, Groq, Google Gemini) may experience rate limits, model
          deprecations, or outages that affect availability of AI features. Mistral is EU-based (Paris);
          OpenRouter, Groq, and Google are US-based.
        </p>
      </section>

      <section>
        <h2>10. Limitation of Liability</h2>
        <p>
          To the maximum extent permitted by applicable law, Simon Curda shall not be liable for any
          indirect, incidental, special, consequential, or punitive damages, including but not limited
          to loss of profits, data, or business opportunities, arising from your use of the Service,
          including losses arising from reliance on AI-generated output that the user failed to
          independently verify.
        </p>
        <p>
          Our total liability for any claim shall not exceed the amount you paid to us in the 12 months
          preceding the claim, or zero if you are using the free tier.
        </p>
        <p>
          <strong>Nothing in these Terms excludes or limits liability that cannot lawfully be excluded
          or limited under applicable law.</strong> This includes liability for intentional damage,
          gross negligence, and statutory consumer protection rights.
        </p>
        <p>
          <strong>EU consumer note:</strong> Nothing in these Terms limits any statutory consumer rights
          you may have under EU law, including under Czech Act No. 89/2012 Sb. (Civil Code) and Czech
          Act No. 634/1992 Sb. (Consumer Protection). Where mandatory consumer protection law applies,
          it overrides conflicting provisions of these Terms.
        </p>
      </section>

      <section>
        <h2>11. Indemnification</h2>
        <p>
          To the extent permitted by applicable law, and except where prohibited by mandatory consumer
          protection law (including EU Directive 93/13/EEC on unfair contract terms and Czech Act
          No. 634/1992 Coll.), you agree to indemnify and hold harmless Simon Curda from and against
          any claims, damages, losses, or expenses (including reasonable attorneys&apos; fees) arising
          from (a) your use of the Service in violation of these Terms or applicable law, (b) your
          infringement of any third-party rights (including uploading documents you do not have the
          right to process), or (c) your violation of applicable data-protection law in respect of
          personal data you upload.
        </p>
        <p>
          <strong>Consumer carve-out:</strong> If you are a consumer within the meaning of Czech Act
          No. 89/2012 Coll. (Civil Code) § 419, this indemnification clause applies only to the extent
          that the relevant claim arises from your intentional breach or gross negligence, and in no
          event shall a consumer be required to indemnify Simon Curda for damages caused by Simon
          Curda&apos;s own act or omission.
        </p>
      </section>

      <section>
        <h2>12. Subscription Plans and Billing</h2>
        <p>
          Paid plans (Pro, Plus, Business, Enterprise) are billed monthly or annually via Stripe. You
          can cancel your subscription at any time from your Stripe customer portal. Cancellation
          takes effect at the end of the current billing period — you retain access to paid features
          until then, and no further charges are made.
        </p>
        <p>
          When you delete your account, any active Stripe subscription is automatically cancelled to
          prevent ongoing charges.
        </p>
        <p>
          <strong>Refund policy:</strong>
        </p>
        <ul className="list-disc pl-6 space-y-1 text-sm">
          <li><strong>Within 14 days of payment, no AI usage:</strong> Full refund on request (see §14 Right of Withdrawal). Contact damr58h@gmail.com.</li>
          <li><strong>Within 14 days of payment, AI features used:</strong> Right of withdrawal is forfeited under §1837(j) of the Civil Code (digital content with express consent to start). No refund, but you retain access until the end of the billing period.</li>
          <li><strong>After 14 days, monthly plan:</strong> No refund of the current month&apos;s charge; subscription remains active until end of billing period. No further charges after cancellation.</li>
          <li><strong>After 14 days, annual plan:</strong> Pro-rata refund of unused full months remaining on the plan, less a reasonable administrative fee of EUR 10. Contact damr58h@gmail.com to request a pro-rata refund.</li>
          <li><strong>Service-impacting outage:</strong> If OmniParse experiences a verified outage exceeding 24 consecutive hours that prevents you from using paid features, contact us for a service-credit or pro-rata refund for the affected period.</li>
          <li><strong>Free tier:</strong> No payment is made, so no refund is applicable. Account deletion is available at any time.</li>
        </ul>
        <p>
          Refunds are processed back to the original payment method via Stripe within 14 days of
          approval, as required by Art. 13(1) of Directive 2011/83/EU.
        </p>
      </section>

      <section>
        <h2>13. Modifications to Terms</h2>
        <p>
          We may update these Terms from time to time. <strong>Material changes will be notified to
          you via email (to your account email address) and via an in-Service notice at least 30 days
          before the change takes effect.</strong> For changes that are not material (e.g., corrections
          of typos, clarifications, or changes that do not affect your rights or obligations), we may
          update these Terms without prior notice, with effect from the &quot;Last updated&quot; date.
        </p>
        <p>
          <strong>For consumer users:</strong> Pursuant to § 1752 of the Civil Code (Act No. 89/2012
          Coll.), material changes to these Terms that would worsen your position as a consumer take
          effect only if you expressly agree to them. Your continued use of the Service after the
          30-day notice period constitutes such express agreement unless you terminate your account
          before the change takes effect (in which case the previous version of the Terms continues
          to apply for any open billing period).
        </p>
        <p>
          The &quot;Last updated&quot; date at the top of this page indicates when these Terms were
          last revised. We will retain prior versions of these Terms and provide them on request.
        </p>
      </section>

      <section>
        <h2>14. Right of Withdrawal (EU Consumers)</h2>
        <p>
          Under Czech Civil Code (Act No. 89/2012 Coll.) §§ 1829 and 1837, and Directive 2011/83/EU
          on consumer rights, consumers concluding distance contracts (contracts concluded online)
          have a <strong>14-day right of withdrawal</strong>.
        </p>
        <p>
          <strong>However</strong>, pursuant to § 1837(j) of the Civil Code and Art. 16(m) of
          Directive 2011/83/EU, the right of withdrawal does <strong>NOT</strong> apply to:
        </p>
        <ul className="list-disc pl-6 space-y-1 text-sm">
          <li>Digital content or services where the consumer has expressly requested that the service
          begin during the withdrawal period AND has acknowledged that by doing so, they lose the
          right to withdraw;</li>
          <li>Services that have been fully performed with the consumer&apos;s prior express consent
          and acknowledgment.</li>
        </ul>
        <p>
          <strong>For this waiver to be valid under § 1837(j) and Art. 16(m) CRD, the following
          express acknowledgment is required at signup (separate from the Terms acceptance checkbox):</strong>
        </p>
        <p className="p-3 bg-amber-500/5 border-l-4 border-amber-500 rounded-r">
          <em>&quot;I acknowledge that OmniParse is a digital service that begins immediately upon my
          first use of AI features (upload, scan, or chat). I expressly consent to OmniParse beginning
          performance during the 14-day withdrawal period, and I acknowledge that I will lose my
          right of withdrawal once the service has started, pursuant to § 1837(j) of the Czech Civil
          Code and Art. 16(m) of Directive 2011/83/EU.&quot;</em>
        </p>
        <p>
          By creating an OmniParse account and checking this separate acknowledgment box, you expressly
          agree that:
        </p>
        <ul className="list-disc pl-6 space-y-1 text-sm">
          <li>The Service begins immediately upon your first use of AI features (upload, scan, or chat);</li>
          <li>You acknowledge that you are losing the 14-day right of withdrawal pursuant to § 1837(j)
          of the Civil Code by requesting the Service to begin during the withdrawal period;</li>
          <li>This waiver applies only to the AI processing features. You may still delete your account
          at any time (Settings → Delete Account) without obligation.</li>
        </ul>
        <p>
          <strong>One-click withdrawal button:</strong> Pursuant to Art. 4(2) of Directive (EU)
          2023/2673 (effective 19 June 2026), if you have not yet used any AI features, a one-click
          &quot;Withdraw&quot; button is available in your account Settings that allows you to
          exercise your right of withdrawal without further formalities. Withdrawal must be confirmed
          by us within 24 hours.
        </p>
        <p>
          <strong>For Free tier users:</strong> Since no payment is made, no withdrawal refund is
          applicable. Account deletion is available at any time.
        </p>
        <p>
          <strong>For paid subscribers:</strong> If you cancel your subscription within 14 days of
          payment AND have not used any AI features in that period, you are entitled to a full refund
          (processed within 14 days via Stripe). Contact <strong>damr58h@gmail.com</strong> to request
          a refund. If you have used AI features during the 14-day period, the right of withdrawal is
          forfeited per § 1837(j).
        </p>
      </section>

      <section>
        <h2>15. Consumer Information and Dispute Resolution</h2>
        <p>
          Pursuant to § 1753 of the Civil Code (Act No. 89/2012 Coll.), the following information is
          provided to consumers before concluding a distance contract:
        </p>
        <ul className="list-disc pl-6 space-y-1 text-sm">
          <li><strong>Provider:</strong> Simon Curda (natural person), Czech Republic</li>
          <li><strong>Contact:</strong> damr58h@gmail.com</li>
          <li><strong>Service description:</strong> AI-powered invoice extraction, validation, and analytics platform</li>
          <li><strong>Total price (incl. taxes):</strong> Free tier available (no charge). Paid plans from USD 49/month to USD 499/month as described on the pricing page; VAT is reverse-charged for EU B2B customers with a valid VAT ID and included for EU consumers at the applicable Czech VAT rate.</li>
          <li><strong>Additional fees:</strong> None beyond the subscription price. No delivery costs (digital service delivered online).</li>
          <li><strong>Contract duration:</strong> Monthly or annual subscription, cancelable at any time (cancellation takes effect at end of billing period).</li>
          <li><strong>Performance timeframe:</strong> The Service begins immediately upon account creation and first use of AI features.</li>
          <li><strong>Payment method:</strong> Credit/debit card via Stripe. Invoicing available for Enterprise plans on request.</li>
          <li><strong>Right of withdrawal:</strong> See § 14 above (limited for digital content under § 1837(j) Civil Code).</li>
          <li><strong>Applicable law:</strong> Czech law (see § 16 below)</li>
          <li><strong>Court of jurisdiction:</strong> For consumer disputes, the court of the consumer&apos;s domicile; for B2B disputes, the competent courts of the Czech Republic.</li>
          <li><strong>Language:</strong> These Terms are available in English. Communication with the provider may be conducted in English or Czech.</li>
          <li><strong>After-sales obligations:</strong> None beyond the warranties and obligations set out in these Terms.</li>
          <li><strong>Professional liability insurance:</strong> Not maintained (the operator is a natural person acting in a non-commercial capacity); claims are subject to the liability caps in § 10.</li>
          <li><strong>Code of conduct:</strong> The provider has not subscribed to any code of conduct under § 1753(1)(i) Civil Code.</li>
        </ul>
        <h3 className="text-base font-semibold mt-4 mb-2">Out-of-Court Dispute Resolution (ADR)</h3>
        <p>
          Czech consumers may seek out-of-court dispute resolution through the following entity:
        </p>
        <ul className="list-disc pl-6 space-y-1 text-sm">
          <li><strong>Česká obchodní inspekce (ČOI)</strong> — Czech Trade Inspection Authority</li>
          <li>Address: Štěpánská 567, 120 00 Praha 2, Czech Republic</li>
          <li>Website: <a href="https://coi.gov.cz" target="_blank" rel="noopener">coi.gov.cz</a></li>
          <li>ADR information: <a href="https://coi.gov.cz/informace-o-adr" target="_blank" rel="noopener">coi.gov.cz/informace-o-adr</a></li>
        </ul>
        <p>
          A proposal for out-of-court dispute resolution must be submitted within 1 year from the date
          the consumer first exercised their right in the matter. The procedure is governed by Act No.
          634/1992 Coll. (Consumer Protection Act) §§ 20b–20e.
        </p>
        <p>
          EU consumers may also seek alternative dispute resolution through the European Commission&apos;s
          consumer redress resources at
          <a href="https://consumer-redress.ec.europa.eu" target="_blank" rel="noopener"> consumer-redress.ec.europa.eu</a>.
        </p>
      </section>

      <section>
        <h2>16. Governing Law and Dispute Resolution</h2>
        <p>
          These Terms are governed by the laws of the Czech Republic, without regard to conflict of law
          principles. EU consumer protection laws apply additionally for users classified as consumers
          under EU law.
        </p>
        <p>
          For disputes arising from these Terms, you agree to first attempt resolution by contacting us
          at <strong>damr58h@gmail.com</strong>. If the dispute cannot be resolved within 30 days, it
          shall be submitted to the competent courts of the Czech Republic. For consumer disputes,
          the court of the consumer&apos;s domicile shall have jurisdiction.
        </p>
      </section>

      <section>
        <h2>17. Severability</h2>
        <p>
          If any provision of these Terms is found to be unenforceable or invalid, that provision shall
          be limited or eliminated to the minimum extent necessary, and the remaining provisions shall
          remain in full force and effect.
        </p>
      </section>

      <section>
        <h2>18. Non-Reliance on AI Output</h2>
        <p>
          You acknowledge and agree that:
        </p>
        <ul className="list-disc pl-6 space-y-1 text-sm">
          <li>(a) AI-extracted data and chat responses are provided for informational purposes only;</li>
          <li>(b) OmniParse does not warrant accuracy, completeness, timeliness, or fitness for any specific purpose;</li>
          <li>(c) You are solely responsible for verifying all extracted data and chat responses against source documents before any use;</li>
          <li>(d) If you rely on inaccurate AI output for financial decisions, tax filings, legal actions, vendor payments, or any other purpose, OmniParse is not liable for resulting damages, losses, or penalties;</li>
          <li>(e) The confidence scores provided are model-generated estimates only and do not guarantee accuracy;</li>
          <li>(f) Chat responses may contain errors, hallucinations, or be out of context — always cross-reference against the underlying invoice records before acting on them;</li>
          <li>(g) OmniParse may modify, suspend, or discontinue AI features or change AI providers, with reasonable notice for material changes as described in § 7b.</li>
        </ul>
        <p>
          By accepting these Terms, you agree that you will not hold OmniParse, its operator, or its
          AI providers liable for losses arising from reliance on AI output.
        </p>
      </section>

      <section>
        <h2>20. Force Majeure</h2>
        <p>
          Neither party shall be liable for any failure or delay in performing its obligations under
          these Terms (except for payment obligations) to the extent such failure or delay is caused
          by events beyond its reasonable control, including but not limited to acts of God, natural
          disasters, war, terrorism, civil unrest, epidemics or pandemics, governmental actions,
          labor disputes, internet or telecommunications failures, or failures of third-party AI
          providers, hosting providers, or payment processors. The affected party shall notify the
          other party without undue delay and shall use commercially reasonable efforts to resume
          performance as soon as reasonably practicable.
        </p>
      </section>

      <section>
        <h2>21. Notices</h2>
        <p>
          <strong>Notices from OmniParse to you:</strong> Will be sent to your account email address
          or displayed in the Service. Email notices are deemed received 24 hours after sending.
          In-Service notices are deemed received upon first display.
        </p>
        <p>
          <strong>Notices from you to OmniParse:</strong> Send to damr58h@gmail.com with a clear
          subject line (e.g., &quot;DSR&quot;, &quot;DPA&quot;, &quot;Refund Request&quot;,
          &quot;Account Termination&quot;). Legal notices are deemed received on the date we reply
          acknowledging receipt.
        </p>
      </section>

      <section>
        <h2>22. Acceptable Use Policy</h2>
        <p>You agree not to:</p>
        <ul className="list-disc pl-6 space-y-1 text-sm">
          <li>Upload documents you do not have the right to process (copyright, privacy, or other legal restrictions);</li>
          <li>Upload documents containing personal data of EU data subjects without a valid legal basis for transfer to US-based AI providers;</li>
          <li>Use automated scraping, bots, or rate-limit bypass tools to overwhelm the Service;</li>
          <li>Attempt IDOR (insecure direct object reference), prompt injection, SQL injection, XSS, or other exploits against the Service;</li>
          <li>Upload child sexual abuse material (CSAM), hate speech, content promoting violence or terrorism, or content that is illegal in your jurisdiction or the operator&apos;s jurisdiction (Czech Republic);</li>
          <li>Use the Service for fraud, money laundering, tax evasion, or any other illegal activity;</li>
          <li>Reverse-engineer, decompile, or attempt to extract AI model weights, training data, or proprietary algorithms;</li>
          <li>Resell or sublicense access to the Service without written permission;</li>
          <li>Interfere with the proper functioning of the Service, including by introducing viruses, malware, or other malicious code.</li>
          <li>Create multiple accounts to bypass plan limits or rate limits;</li>
          <li>Use the Service to burn AI provider quotas in an abusive or automated manner.</li>
        </ul>
        <p>
          <strong>Account monitoring and enforcement:</strong> We monitor account activity to detect
          potential abuse, including excessive API usage, rapid account creation, and unusual patterns
          of document processing. We reserve the right to:
        </p>
        <ul className="list-disc pl-6 space-y-1 text-sm mt-2">
          <li><strong>Freeze</strong> accounts suspected of abuse — the user can still log in but AI features are blocked;</li>
          <li><strong>Suspend</strong> accounts suspected of abuse, with prior written notice by email where feasible. For paid accounts, we will provide at least 7 days&apos; notice before suspension unless the violation is urgent (e.g., CSAM, ongoing fraud);</li>
          <li><strong>Delete</strong> accounts that materially violate this Acceptable Use Policy, including all associated data. For paid accounts, you may appeal a deletion decision within 14 days by emailing damr58h@gmail.com;</li>
          <li><strong>Report</strong> suspected illegal activity to the relevant authorities (Czech Police, ÚOOÚ, Europol).</li>
        </ul>
        <p>
          If your account is frozen, you will see a message indicating the reason when you attempt to
          use AI features. To request reinstatement, contact <strong>damr58h@gmail.com</strong>.
        </p>
      </section>

      <section>
        <h2>23. Contact</h2>
        <p>For questions about these Terms: <strong>damr58h@gmail.com</strong></p>
      </section>

      <p className="text-xs mt-8">
        Compliant with EU Directive 93/13/EEC (unfair contract terms), EU Directive 2011/83/EU (consumer rights, including right of withdrawal),
        EU Directive (EU) 2023/2673 (one-click withdrawal button, effective 19 June 2026),
        Czech Act No. 89/2012 Coll. (Civil Code, including §§ 419, 1752, 1753, 1829, 1837, 2913),
        Czech Act No. 634/1992 Coll. (Consumer Protection, including §§ 16, 20b–20e),
        Czech Act No. 110/2019 Coll. (Czech GDPR implementation),
        Czech Act No. 127/2005 Coll. § 89 (Electronic Communications — ePrivacy implementation), and
        Czech Act No. 480/2004 Coll. (Information Society Services — unsolicited communications).
      </p>
    </LegalLayout>
  );
}
