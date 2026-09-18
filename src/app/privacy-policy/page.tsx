import LegalLayout from '@/app/legal-layout';

export const dynamic = 'force-static';

export default function PrivacyPolicyPage() {
  return (
    <LegalLayout title="Privacy Policy" lastUpdated="September 18, 2026">
      <section>
        <h2>1. Data Controller</h2>
        <p>
          The data controller for personal data processed through this Service is
          <strong> Simon Curda</strong> (natural person), based in the
          Czech Republic. For GDPR purposes (EU Regulation 2016/679), the Controller is responsible for
          ensuring compliance with data protection law. The Controller has not appointed a Data Protection
          Officer (DPO) as none is legally required under GDPR Art. 37 for an operation of this scope and
          nature; all GDPR-related matters are handled directly by the Controller.
        </p>
        <p>
          Contact: <strong>damr58h@gmail.com</strong> (use this for all GDPR-related requests:
          access, rectification, erasure, restriction, portability, objection, and consent withdrawal).
          We aim to respond within 30 days as required by GDPR Art. 12(3). Where a request is complex
          or numerous, this period may be extended by a further two months pursuant to GDPR Art. 12(3),
          in which case we will inform you of the extension and the reasons within the initial 30-day period.
        </p>
        <p>
          <strong>Identity of the Controller and contact details (GDPR Art. 13(1)(a)–(b)):</strong>
          Simon Curda, natural person, domicile Czech Republic. Email: damr58h@gmail.com.
          For Data Subject Requests, please use the subject line &quot;DSR — [your name]&quot;.
          For B2B / DPA matters, please use the subject line &quot;DPA — [company name]&quot;.
        </p>
      </section>

      <section>
        <h2>2. Personal Data We Collect</h2>
        <p>
          <strong>Account information:</strong> When you register, we collect your name and email address.
          Your password is hashed using bcrypt (12 rounds) and never stored in plaintext.
        </p>
        <p>
          <strong>Documents you upload:</strong> When you use the document parsing feature, your files
          (PDF, JPEG, PNG, WebP) are sent to AI processing providers (see Section 6 for the full list).
          The original file is stored in your account database (base64-encoded) for 30 days so you can
          preview it in the dashboard, then deleted from the active environment after 30 days. The extracted data is stored
          in your account until you delete it or terminate your account.
        </p>
        <p>
          <strong>Chat history:</strong> Messages you send to the AI chat assistant and the responses
          returned are stored in your account database until you delete them via the
          dashboard&apos;s Clear button or by deleting your account.
        </p>
        <p>
          <strong>Technical data:</strong> We collect standard server logs including your IP address,
          browser type, and request timestamps for security and service stability purposes.
        </p>
        <p>
          <strong>Local storage data:</strong> The application uses your browser&apos;s local storage to
          remember your authentication token, theme preference, and cookie consent choice. Invoice and
          chat data is stored server-side in your account, not in local storage.
        </p>
      </section>

      <section>
        <h2>3. Legal Basis for Processing (GDPR Art. 6)</h2>
        <ul>
          <li><strong>Account creation and authentication:</strong> Contractual necessity (Art. 6(1)(b)) — necessary to provide the Service you requested.</li>
          <li><strong>Document parsing:</strong> Consent (Art. 6(1)(a)) — you actively upload documents for processing. You can withdraw this consent by deleting your invoices.</li>
          <li><strong>Chat interactions:</strong> Consent (Art. 6(1)(a)) — you actively send messages to the AI chat.</li>
          <li><strong>Terms acceptance:</strong> Consent (Art. 6(1)(a)) — recorded at signup with timestamps.</li>
          <li><strong>Security, service stability, and abuse prevention:</strong> Legitimate interest (Art. 6(1)(f)) — server logs for abuse prevention, rate limiting, fraud detection, and account monitoring. We monitor account activity patterns (invoice volume, chat usage, email scanning frequency, account age) to detect potential abuse. Accounts suspected of abuse may be frozen (AI features blocked) or deleted in accordance with our Terms of Service. A legitimate-interest balancing test has been conducted and is documented in our internal Records of Processing Activities (ROPA); it is available to supervisory authorities on request.</li>
          <li><strong>Local storage preferences:</strong> Consent via cookie banner (Art. 6(1)(a) + ePrivacy Directive Art. 5(3), implemented in Czech Act No. 127/2005 Coll. § 89).</li>
          <li><strong>Processing of personal data appearing in customer-uploaded invoices</strong> (e.g., names of vendor employees, contact persons, signatories): Legitimate interest (Art. 6(1)(f)) — necessary to provide the document-extraction Service the customer requested. Where such data reveals special categories (Art. 9), processing is limited to what is strictly necessary for invoice extraction and is not used for any other purpose.</li>
        </ul>
      </section>

      <section>
        <h2>4. Data Retention (GDPR Art. 5(1)(e))</h2>
        <p>
          We retain personal data only for as long as necessary for the purposes described in this Policy,
          or as required by applicable law. The following retention periods apply:
        </p>
        <div className="my-4 overflow-x-auto">
          <table className="w-full text-sm border border-border rounded">
            <thead className="bg-muted/30">
              <tr>
                <th className="text-left p-2 border-b border-border font-semibold">Data category</th>
                <th className="text-left p-2 border-b border-border font-semibold">Retention period</th>
                <th className="text-left p-2 border-b border-border font-semibold">Basis / exception</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-border/50">
                <td className="p-2 align-top"><strong>Uploaded document files</strong> (PDFs, images, base64-encoded in primary DB)</td>
                <td className="p-2 align-top">30 days in active environment</td>
                <td className="p-2 align-top">Auto-purged after 30 days. Extraction results remain in account.</td>
              </tr>
              <tr className="border-b border-border/50">
                <td className="p-2 align-top"><strong>Extracted invoice data</strong></td>
                <td className="p-2 align-top">Until account deletion (or user deletes individual invoice)</td>
                <td className="p-2 align-top">Deleted within 90 days of account termination.</td>
              </tr>
              <tr className="border-b border-border/50">
                <td className="p-2 align-top"><strong>Chat history</strong></td>
                <td className="p-2 align-top">Until cleared by user or account deletion</td>
                <td className="p-2 align-top">Cascade-deleted with account.</td>
              </tr>
              <tr className="border-b border-border/50">
                <td className="p-2 align-top"><strong>Audit logs</strong> (invoice edits, approvals, deletions)</td>
                <td className="p-2 align-top">Lifetime of account</td>
                <td className="p-2 align-top">Cascade-deleted with account.</td>
              </tr>
              <tr className="border-b border-border/50">
                <td className="p-2 align-top"><strong>Account data</strong> (email, name, hashed password, settings)</td>
                <td className="p-2 align-top">Until account deletion</td>
                <td className="p-2 align-top">User can delete at any time from Settings.</td>
              </tr>
              <tr className="border-b border-border/50">
                <td className="p-2 align-top"><strong>Server logs</strong> (Vercel — IP, browser, timestamps)</td>
                <td className="p-2 align-top">30 days</td>
                <td className="p-2 align-top">Vercel Hobby/Pro plans auto-delete after 30 days.</td>
              </tr>
              <tr className="border-b border-border/50">
                <td className="p-2 align-top"><strong>Database backups</strong> (Supabase PITR)</td>
                <td className="p-2 align-top">7 days (rolling)</td>
                <td className="p-2 align-top">Disaster recovery only; overwritten on rolling basis.</td>
              </tr>
              <tr className="border-b border-border/50">
                <td className="p-2 align-top"><strong>Stripe billing records</strong></td>
                <td className="p-2 align-top">Per Stripe policy (~10 years)</td>
                <td className="p-2 align-top">Required by financial/tax regulations. Governed by Stripe&apos;s privacy policy.</td>
              </tr>
              <tr className="border-b border-border/50">
                <td className="p-2 align-top"><strong>Incident logs</strong> (security incidents involving AI systems)</td>
                <td className="p-2 align-top">2 years</td>
                <td className="p-2 align-top">Best practice for regulatory audit purposes (AI Act Art. 12).</td>
              </tr>
              <tr>
                <td className="p-2 align-top"><strong>Withdrawal / consent records</strong> (termsAcceptedAt, withdrawalAcknowledgedAt, withdrawnAt, lastTosEmailSentAt)</td>
                <td className="p-2 align-top">Lifetime of account + 90 days</td>
                <td className="p-2 align-top">Evidence of consent for regulatory audit; cascade-deleted with account.</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          <strong>No indefinite retention.</strong> We do not retain personal data indefinitely. Where
          longer retention is required by law (e.g., financial records under Czech accounting regulations),
          retention is limited to the statutory period and data is then deleted.
        </p>
        <p>
          <strong>Relationship between 30-day and 90-day periods:</strong> Uploaded document <em>files</em>
          (the binary PDF/image) are purged after 30 days. <em>Extracted data</em> (the structured JSON —
          vendor, invoice number, line items) remains in your account for as long as your account is
          active, and is deleted within 90 days of account termination. These are different data
          categories with different retention needs; the 30-day period applies to file binaries, the
          90-day period applies to post-termination cleanup of all remaining personal data.
        </p>
      </section>

      <section>
        <h2>5. Your Rights Under GDPR (Art. 12-23)</h2>
        <p>You have the following rights regarding your personal data:</p>
        <ul>
          <li><strong>Right of access (Art. 15):</strong> Request a copy of all personal data we hold about you. Use the &quot;Export my data&quot; feature in Settings, or contact us.</li>
          <li><strong>Right to rectification (Art. 16):</strong> Request correction of inaccurate personal data. Edit your profile from Settings.</li>
          <li><strong>Right to erasure / &quot;right to be forgotten&quot; (Art. 17):</strong> Request deletion of your personal data. Use the &quot;Delete account&quot; feature in Settings — this deletes all your data within seconds.</li>
          <li><strong>Right to restriction of processing (Art. 18):</strong> Request that we limit how we use your data. Contact us to request this.</li>
          <li><strong>Right to data portability (Art. 20):</strong> Receive your data in a structured, machine-readable format. Use the &quot;Export my data&quot; feature in Settings.</li>
          <li><strong>Right to object (Art. 21):</strong> Object to processing based on legitimate interests (e.g. server log collection).</li>
          <li><strong>Right to withdraw consent (Art. 7(3)):</strong> Withdraw consent at any time via cookie settings, by deleting your invoices and chat history, or by contacting us.</li>
          <li><strong>Rights related to automated decision-making and profiling (Art. 22):</strong> OmniParse does <strong>not</strong> engage in solely automated decision-making producing legal or similarly significant effects concerning you. AI extraction and chat responses are tools to assist you; all material decisions (e.g., invoice approval, payment authorization) require your explicit human action. You have the right not to be subject to a decision based solely on automated processing; if you believe any such decision has occurred, contact us immediately.</li>
        </ul>
        <p>
          To exercise any of these rights, contact us at <strong>damr58h@gmail.com</strong>.
          We will respond within 30 days as required by GDPR Art. 12(3).
          You also have the right to lodge a complaint with a supervisory authority — in particular
          the Czech Office for Personal Data Protection (ÚOOÚ) at <a href="https://www.uoou.cz" target="_blank" rel="noopener">uoou.cz</a>, or, if you reside in another EU/EEA Member State, the supervisory authority of your habitual residence.
        </p>
      </section>

      <section>
        <h2>6. Subprocessors and AI Providers</h2>
        <p>
          We use the following third-party services to provide the Service. Each processes personal data
          on our behalf as a subprocessor under GDPR Art. 28. Data Processing Agreements (DPAs) and
          Standard Contractual Clauses (SCCs) are in place with all <em>active</em> providers (see
          per-provider status below).
        </p>
        <p className="mt-3 p-3 bg-emerald-500/5 border-l-4 border-emerald-500 rounded-r">
          <strong className="text-emerald-700 dark:text-emerald-500">EU-based AI provider available.</strong>{' '}
          Mistral AI (Paris, France) processes documents within the EU. Transfers to Mistral
          are expected to remain within the EEA, subject to Mistral&apos;s applicable terms. We prioritize Mistral for
          vision extraction and chat when available. When <code>MISTRAL_DISABLE_TRAINING=true</code> is
          set in our server configuration (default), we send <code>usage_options=&#123;&quot;enable_training&quot;: false&#125;</code> on
          every Mistral API call to disable training on prompt content (effective on paid Mistral tier;
          on free tier, Mistral may ignore or reject this parameter).
        </p>
        <ul>
          <li><strong>Vercel Inc.</strong> (United States, DPF-certified) — Web hosting and serverless function execution. Processes: IP addresses, request metadata. <a href="https://vercel.com/legal/dpa" target="_blank" rel="noopener">Vercel DPA</a>.</li>
          <li><strong>Supabase Inc.</strong> (Ireland, EU) — Primary database hosting (PostgreSQL). Processes: all stored account data, invoices, chat messages. DPA built into Terms of Service (effective August 1, 2026) — automatically applies to all customers, no separate signature required. <a href="https://supabase.com/legal/customer-resources/data-processing-addendum" target="_blank" rel="noopener">Supabase DPA</a>. Subprocessor change notifications: <a href="https://supabase.com/legal/customer-resources/subprocessor-list" target="_blank" rel="noopener">supabase.com/legal/customer-resources/subprocessor-list</a>.</li>
          <li><strong>Mistral AI</strong> (Paris, France — EU) — Primary AI inference provider. Processes: uploaded document content (transiently) for vision extraction, chat messages (transiently). <strong>EU-based — no SCC required.</strong> Training opt-out (<code>usage_options.enable_training=false</code>) is sent on every request when <code>MISTRAL_DISABLE_TRAINING=true</code> (default). <a href="https://mistral.ai/legal/privacy-policy" target="_blank" rel="noopener">Mistral Privacy Policy</a>.</li>
          <li><strong>Groq Inc.</strong> (United States) — Secondary AI inference provider (after Mistral). Processes: uploaded document content (transiently), chat messages (transiently). <strong>SCCs confirmed</strong> (EU SCC Module 2, self-executing upon acceptance of Groq Services Agreement; DPA dated October 15, 2025). DPA accessible at <a href="https://console.groq.com" target="_blank" rel="noopener">console.groq.com</a>. Governing law: Ireland. <em>Note: Groq is optional in our configuration — operators may deploy in EU-only mode (Mistral only) by leaving GROQ_API_KEY unset.</em></li>
          <li><strong>Google LLC</strong> (United States, DPF-certified) — Final fallback AI inference provider. Models used: Gemini 2.0 Flash, Gemini 2.5 Flash, Gemini 1.5 Flash. <strong>DPF-certified</strong> — no SCC required while DPF remains valid. Google Cloud DPA self-executing upon acceptance of Google Cloud Terms; available at <a href="https://cloud.google.com/terms/data-processing-addendum" target="_blank" rel="noopener">cloud.google.com/terms/data-processing-addendum</a>. <em>Note: This uses Google&apos;s AI Studio free-tier endpoint. For production with EU personal data, consider migrating to Vertex AI.</em></li>
          <li><strong>Stripe Inc.</strong> (United States, DPF-certified) — Payment processing for paid plans. Processes: email, billing details. <a href="https://stripe.com/legal/dpa" target="_blank" rel="noopener">Stripe DPA</a>.</li>
        </ul>
        <p>
          <strong>OpenRouter — DISABLED by default.</strong> OpenRouter is an AI inference aggregator
          that routes requests to underlying model providers (Meta, Nvidia, Google, etc.). OpenRouter&apos;s
          free-tier models (all model IDs ending in <code>:free</code>) typically permit training on
          prompt content, and there is no DPA or SCC in place with OpenRouter as of September 2026.
          <strong>OpenRouter is therefore disabled by default in our production configuration</strong>
          (the <code>ENABLE_OPENROUTER</code> environment variable must be explicitly set to
          <code>true</code> by the operator after completing their own DPA/SCC review). When disabled,
          OpenRouter is never called — document content and chat messages are never transmitted to
          OpenRouter or its underlying providers.
        </p>
        <p>
          <strong>AI vision cascade (production default):</strong> Mistral (EU, primary) → Groq (US, SCCs confirmed, secondary) → Google Gemini (US, DPF-certified, final fallback). OpenRouter is skipped unless explicitly enabled by the operator.
        </p>
        <p>
          <strong>SCC Status (as of September 18, 2026):</strong>
          <ul className="list-disc pl-6 space-y-1 mt-2 text-sm">
            <li><strong>Supabase Inc.</strong> (Ireland, EU) — DPA built into Terms of Service (effective August 1, 2026). Automatically applies to all customers. EU-based — no SCC required.</li>
            <li><strong>Vercel Inc.</strong> (United States) — DPF-certified. DPA available at vercel.com/legal/dpa.</li>
            <li><strong>Groq Inc.</strong> — SCCs confirmed in effect (DPA dated October 15, 2025; EU SCC Module 2 self-executing upon acceptance of Groq Services Agreement). DPA accessible at <a href="https://console.groq.com" target="_blank" rel="noopener">console.groq.com</a>. Governing law: Ireland. Competent authority: Irish DPC. 72-hour breach notification. DPF certification status pending verification.</li>
            <li><strong>Mistral AI</strong> — EU-based (Paris, France). No Chapter V transfer issue; no SCC required. Training opt-out sent on every request (MISTRAL_DISABLE_TRAINING=true).</li>
            <li><strong>Google LLC (Gemini)</strong> — Google Cloud DPA self-executing upon acceptance of Google Cloud Terms. Google LLC is DPF-certified — no SCC required while DPF remains valid.</li>
            <li><strong>Stripe Inc.</strong> (United States) — DPF-certified. DPA available at stripe.com/legal/dpa.</li>
            <li><strong>OpenRouter</strong> — <strong>DISABLED by default</strong>. Not used in production unless operator explicitly sets ENABLE_OPENROUTER=true after completing DPA/SCC review. When disabled, no data is transferred to OpenRouter or its underlying providers.</li>
          </ul>
        </p>
        <p>
          <strong>EU users:</strong> AI processing via Mistral (EU-based) and Groq (US-based, SCCs confirmed)
          has appropriate safeguards in place under GDPR. Google is DPF-certified. OpenRouter is disabled
          by default. However, users should note that documents uploaded to the Service may contain
          personal data of multiple data subjects (e.g. vendor names, employee names, email addresses,
          bank details). The user uploading such documents is responsible for ensuring they have a valid
          legal basis under GDPR Art. 6 for processing that data, and that the transfer to AI providers
          is lawful under Chapter V.
        </p>
        <p>
          <strong>Model training — production configuration:</strong> OmniParse sends
          <code> usage_options=&#123;&quot;enable_training&quot;: false&#125;</code> on every Mistral API call
          (default server configuration) to disable training on prompt content. This opt-out is
          effective on paid Mistral tier; on free Mistral tier, Mistral may ignore or reject this
          parameter. OpenRouter (which has no training opt-out on free-tier models) is disabled by
          default. Groq&apos;s data-handling terms are governed by the Groq DPA and SCCs. Google Gemini
          (AI Studio free tier) data-handling is governed by Google&apos;s AI Studio terms; for stronger
          guarantees, operators may migrate to Vertex AI (out of scope for this deployment).
          <strong>OmniParse itself does not route customer content through AI API tiers that permit
          provider training on customer content</strong> when the default configuration (Mistral with
          training opt-out, OpenRouter disabled) is in effect. Operators who change this configuration
          must update this Policy accordingly.
        </p>
        <p>
          <strong>Important — Schrems III risk:</strong> The EU-US Data Privacy Framework (DPF) adequacy
          decision (10 July 2023) is currently subject to a CJEU appeal (&quot;Schrems III&quot;). If the DPF
          is invalidated, transfers to DPF-certified US recipients (Vercel, Google, Stripe) would need
          to rely on SCCs + Transfer Impact Assessment (TIA) instead. We maintain SCCs with Groq as a
          contingency and will execute SCCs with other US providers if the DPF is invalidated.
        </p>
      </section>

      <section>
        <h2>7. Security Measures (GDPR Art. 32)</h2>
        <p>
          OmniParse implements appropriate technical and organizational measures to ensure a level of
          security appropriate to the risk, taking into account the state of the art and the costs of
          implementation. Measures include:
        </p>
        <ul>
          <li><strong>Encryption in transit:</strong> HTTPS/TLS 1.2+ for all connections (Vercel-managed certificates, auto-renewed).</li>
          <li><strong>Encryption at rest:</strong> Supabase (PostgreSQL) provides transparent disk encryption (TDE) on managed infrastructure. IMAP credentials stored by users are encrypted with AES-256-GCM.</li>
          <li><strong>Password storage:</strong> Passwords are hashed with bcrypt (12 rounds) and never stored in plaintext or reversible form.</li>
          <li><strong>Authentication:</strong> JWT-based authentication with 7-day token expiry. Tokens are signed with a server-side secret and rotated periodically.</li>
          <li><strong>Rate limiting:</strong> 5 login attempts per minute per IP on authentication endpoints; broader rate limits on AI endpoints to prevent abuse.</li>
          <li><strong>Security headers:</strong> Content-Security-Policy, Strict-Transport-Security (HSTS, 2-year max-age, preload), X-Frame-Options: DENY, X-Content-Type-Options: nosniff, Referrer-Policy: strict-origin-when-cross-origin.</li>
          <li><strong>Per-user data isolation:</strong> Every database query includes a userId filter — no insecure direct object reference (IDOR) is possible at the query layer.</li>
          <li><strong>Prompt-injection defense:</strong> All chat messages are screened against 30+ prompt-injection attack patterns before being sent to AI providers.</li>
          <li><strong>Account deletion:</strong> Transactional cascade delete ensures full erasure of all user-owned rows, including invoices, chat, audit logs, and IMAP credentials.</li>
          <li><strong>Vendor due diligence:</strong> Subprocessors are assessed before engagement and re-assessed at least annually. DPAs and (where applicable) SCCs are in place (see §6 and §11).</li>
          <li><strong>Incident response:</strong> A documented incident-response procedure exists. Personal-data breaches are notified to the Czech DPA (ÚOOÚ) within 72 hours of becoming aware, where required by GDPR Art. 33, and to affected data subjects without undue delay where required by GDPR Art. 34.</li>
        </ul>
      </section>

      <section>
        <h2>8. Children&apos;s Data (GDPR Art. 8)</h2>
        <p>
          The Service is an invoice-extraction and analytics platform intended for use by adults acting
          in a professional or business capacity. The Service is <strong>not directed at children</strong>,
          and we do not knowingly collect personal data from children. In the Czech Republic, the age of
          digital consent under GDPR Art. 8 (as implemented by Act No. 110/2019 Coll.) is <strong>15</strong>.
          In other EU/EEA Member States the age ranges from 13 to 16 depending on national law.
        </p>
        <p>
          Users must be at least <strong>15 years old</strong> to register an account. By registering,
          you confirm that you have reached at least the age of digital consent in your jurisdiction
          (and where the local age is higher than 15, that you meet that higher age requirement). Users
          aged between the applicable digital-consent age and 18 must additionally obtain parental or
          guardian consent to use the Service and to enter into these Terms.
        </p>
        <p>
          If we learn that we have collected personal data from a child under the applicable age of
          digital consent without verifiable parental consent, we will delete that data promptly.
          Contact us at <strong>damr58h@gmail.com</strong> if you believe a child has
          provided us with personal data.
        </p>
      </section>

      <section>
        <h2>9. Czech Republic Compliance</h2>
        <p>
          For users in the Czech Republic, the following applies in addition to GDPR:
        </p>
        <ul>
          <li><strong>Act No. 110/2019 Coll.</strong> on the processing of personal data — Czech implementation of GDPR. Sets the age of digital consent at 15 (Art. 8 GDPR) and codifies national derogations.</li>
          <li><strong>Act No. 89/2012 Coll.</strong> (Civil Code) — contractual relationships, consumer protection, liability regime (incl. § 2913 on limitation of liability).</li>
          <li><strong>Act No. 127/2005 Coll.</strong> (Electronic Communications Act, &quot;Lex Telecom&quot;) § 89 — implements the ePrivacy Directive (2002/58/EC) cookie/storage consent rule, as amended effective 1 January 2022. Requires opt-in consent before storing or accessing information on a user&apos;s terminal equipment, except where strictly necessary (Art. 5(3) exception).</li>
          <li><strong>Act No. 480/2004 Coll.</strong> (Information Society Services Act) — governs unsolicited commercial communications (spam) and certain information-society-service provider obligations. <em>Note: this Act is not the cookie-consent statute; that role belongs to Act No. 127/2005 Coll. § 89.</em></li>
          <li><strong>Act No. 634/1992 Coll.</strong> (Consumer Protection Act) §§ 16, 20b–20e — out-of-court dispute resolution (ADR) before Česká obchodní inspekce (ČOI).</li>
          <li><strong>Digital Services Act (Regulation (EU) 2022/2065):</strong> Directly applicable in the Czech Republic since 17 February 2024. OmniParse operates as a hosting service (within the meaning of Art. 6 DSA) for customer-uploaded documents; it does not qualify as an online platform and is therefore not subject to the additional obligations in Chapter IV DSA.</li>
          <li><strong>Supervisory authority (data protection):</strong> Úřad pro ochranu osobních údajů (Office for Personal Data Protection), Pplk. Sochora 27, 170 00 Praha 7, Czech Republic. Website: <a href="https://www.uoou.cz" target="_blank" rel="noopener">uoou.cz</a>.</li>
          <li><strong>Consumer-protection authority:</strong> Česká obchodní inspekce (ČOI), Štěpánská 567, 120 00 Praha 2. Website: <a href="https://coi.gov.cz" target="_blank" rel="noopener">coi.gov.cz</a>.</li>
        </ul>
      </section>

      <section>
        <h2>10. Canadian PIPEDA Compliance</h2>
        <p>
          For users accessing the Service from Canada, OmniParse complies with the Personal Information
          Protection and Electronic Documents Act (PIPEDA, R.S.C. 2000, c. P-8.9). Bill C-27
          (which would have replaced PIPEDA with the Consumer Privacy Protection Act) died on the Order
          Paper on 6 January 2025 and did not become law; PIPEDA therefore remains in force unamended.
        </p>
        <p>The ten fair-information principles in Schedule 1 of PIPEDA are respected, in particular:</p>
        <ul>
          <li><strong>Accountability:</strong> Simon Curda (natural person, Czech Republic) is responsible for personal information under PIPEDA and has designated damr58h@gmail.com as the contact for privacy matters.</li>
          <li><strong>Identifying purposes:</strong> Purposes are described in §2 of this Policy.</li>
          <li><strong>Consent:</strong> Consent is obtained at signup (Terms acceptance) and via the cookie banner for non-essential storage. Canadian users may withdraw consent at any time by contacting us or by deleting their account.</li>
          <li><strong>Limiting collection:</strong> We collect only what is necessary for the Service (see §2).</li>
          <li><strong>Limiting use, disclosure, retention:</strong> Retention periods in §4 apply.</li>
          <li><strong>Accuracy:</strong> Users can correct their data via Settings; AI-extracted data can be edited in the dashboard.</li>
          <li><strong>Safeguards:</strong> See §7 (security measures).</li>
          <li><strong>Openness:</strong> This Policy and the Cookie Policy are publicly available without account.</li>
          <li><strong>Individual access:</strong> Canadian users may request access to, correction of, or deletion of their personal data by emailing damr58h@gmail.com.</li>
          <li><strong>Challenging compliance:</strong> Canadian users may challenge our compliance by contacting us or by filing a complaint with the Office of the Privacy Commissioner of Canada at <a href="https://www.priv.gc.ca" target="_blank" rel="noopener">priv.gc.ca</a>.</li>
        </ul>
        <p>
          <strong>Mandatory breach notification (PIPEDA § 10.1 and Breach of Security Safeguards Regulations):</strong>
          Where a breach of security safeguards involving personal information under our control creates a
          real risk of significant harm to a Canadian individual, we will notify the affected individual and
          the Privacy Commissioner of Canada as soon as feasible after determining the breach has occurred,
          and we will keep a record of the breach for at least 24 months.
        </p>
      </section>

      <section>
        <h2>11. Data Processing Addendum (DPA)</h2>
        <p>
          This Data Processing Addendum (&quot;DPA&quot;) applies when you (the &quot;Customer&quot;) act as a data
          controller and use the Service to process personal data on behalf of data subjects. This DPA
          reflects the parties&apos; agreement with respect to the processing of personal data under
          GDPR Art. 28.
        </p>
        <h3 className="text-base font-semibold mt-4 mb-2">11.1 Roles and Scope</h3>
        <ul className="list-disc pl-6 space-y-1 text-sm">
          <li><strong>Customer</strong> is the data controller. Customer determines the purposes and means of processing.</li>
          <li><strong>OmniParse</strong> (operated by Simon Curda) is the data processor. We process personal data only on documented instructions from Customer.</li>
          <li>We process documents and extracted data per your instructions (via the Service&apos;s UI and API). We do not use your data for any purpose other than providing the Service.</li>
        </ul>
        <h3 className="text-base font-semibold mt-4 mb-2">11.2 Subprocessors</h3>
        <p className="text-sm">OmniParse engages the following subprocessors. Customer grants general written authorization for OmniParse to engage these subprocessors; the current list is maintained in this Privacy Policy §6 and material changes will be notified 30 days in advance per §11.7:</p>
        <ul className="list-disc pl-6 space-y-1 text-sm mt-2">
          <li><strong>Vercel Inc.</strong> (United States, DPF-certified) — Web hosting and serverless function execution</li>
          <li><strong>Supabase Inc.</strong> (Ireland, EU) — Primary database hosting (PostgreSQL)</li>
          <li><strong>Mistral AI</strong> (Paris, France — EU) — Primary AI inference (vision + text). Training opt-out sent on every request.</li>
          <li><strong>Groq Inc.</strong> (United States, SCCs confirmed) — AI inference (secondary fallback). Optional — operator may disable for EU-only mode.</li>
          <li><strong>Google LLC</strong> (United States, DPF-certified) — AI inference (final fallback, Gemini models)</li>
          <li><strong>Stripe Inc.</strong> (United States, DPF-certified) — Payment processing (paid plans only)</li>
          <li><strong>OpenRouter</strong> (United States) — <strong>DISABLED BY DEFAULT</strong>. Not engaged unless operator explicitly sets ENABLE_OPENROUTER=true after completing DPA/SCC review. When disabled, no data is transferred to OpenRouter.</li>
        </ul>
        <h3 className="text-base font-semibold mt-4 mb-2">11.3 Data Subject Rights</h3>
        <p className="text-sm">
          Customer is responsible for responding to data subject rights requests (access, rectification,
          erasure, portability, objection). OmniParse will assist Customer with such requests, including
          by exporting or deleting personal data upon Customer&apos;s written request. Contact
          <strong> damr58h@gmail.com</strong> with the subject &quot;DPA — Data Subject Request&quot;.
        </p>
        <h3 className="text-base font-semibold mt-4 mb-2">11.4 Security Measures (GDPR Art. 32)</h3>
        <p className="text-sm">OmniParse implements the following technical and organizational measures (cross-referenced from Privacy Policy §7):</p>
        <ul className="list-disc pl-6 space-y-1 text-sm mt-2">
          <li>Encryption in transit (HTTPS/TLS 1.2+) for all connections</li>
          <li>Encryption at rest: Supabase-managed transparent disk encryption (TDE); AES-256-GCM for IMAP credentials at rest</li>
          <li>bcrypt password hashing (12 rounds)</li>
          <li>JWT-based authentication with 7-day expiry</li>
          <li>Per-request user scoping — no query returns cross-user data</li>
          <li>File data auto-purge after 30 days</li>
          <li>Account deletion with cascade (full erasure)</li>
          <li>Audit log of significant actions (invoice create/approve/delete)</li>
          <li>Rate limiting on auth endpoints (5 attempts/min/IP)</li>
          <li>Security headers: CSP, HSTS (2-year preload), X-Frame-Options: DENY, X-Content-Type-Options: nosniff, Referrer-Policy</li>
          <li>Prompt-injection screening on all chat messages (30+ patterns)</li>
          <li>Vendor due diligence: subprocessors assessed before engagement and re-assessed at least annually</li>
        </ul>
        <h3 className="text-base font-semibold mt-4 mb-2">11.5 International Transfers (GDPR Chapter V)</h3>
        <p className="text-sm">
          Personal data may be transferred to the United States for AI processing by Groq and Google.
          The EU-US Data Privacy Framework (DPF) adequacy decision of 10 July 2023 remains in force as
          of the date of this Policy, although it is subject to an ongoing CJEU appeal ("Schrems III").
          For US recipients self-certified under the DPF, the DPF alone provides a valid transfer
          mechanism and SCCs are not additionally required. For US recipients NOT DPF-certified,
          Standard Contractual Clauses (SCCs) consistent with the Schrems II ruling, together with a
          Transfer Impact Assessment (TIA), are required. <strong>OpenRouter is DISABLED by
          default</strong> — no personal data is transferred to OpenRouter unless the operator
          explicitly enables it after completing DPA/SCC review. <strong>SCC status by provider (as of
          September 18, 2026):</strong>
        </p>
        <ul className="list-disc pl-6 space-y-1 text-sm mt-2">
          <li><strong>Groq Inc.</strong> — SCCs confirmed in effect (DPA dated October 15, 2025; EU SCC Module 2 self-executing upon acceptance of Groq Services Agreement). DPA accessible at <a href="https://console.groq.com" target="_blank" rel="noopener">console.groq.com</a>. Governing law: Ireland. Competent authority: Irish Data Protection Commission. 72-hour breach notification. Groq&apos;s DPF certification status is pending verification at <a href="https://www.dataprivacyframework.gov" target="_blank" rel="noopener">dataprivacyframework.gov</a>; SCCs remain in place as a safeguard.</li>
          <li><strong>Mistral AI</strong> — EU-based (Paris, France). No Chapter V transfer issue; no SCC required. Training opt-out (<code>usage_options.enable_training=false</code>) sent on every request when MISTRAL_DISABLE_TRAINING=true (default).</li>
          <li><strong>Google LLC</strong> — Google Cloud DPA self-executing upon acceptance of Google Cloud Terms; available at <a href="https://cloud.google.com/terms/data-processing-addendum" target="_blank" rel="noopener">cloud.google.com/terms/data-processing-addendum</a>. Google LLC is DPF-certified (verified September 2026); SCCs serve as fallback should the DPF be invalidated by Schrems III.</li>
          <li><strong>Vercel Inc.</strong> — Vercel is DPF-certified. DPA available at <a href="https://vercel.com/legal/dpa" target="_blank" rel="noopener">vercel.com/legal/dpa</a>.</li>
          <li><strong>Stripe Inc.</strong> — Stripe is DPF-certified. DPA available at <a href="https://stripe.com/legal/dpa" target="_blank" rel="noopener">stripe.com/legal/dpa</a>.</li>
          <li><strong>OpenRouter</strong> — <strong>DISABLED BY DEFAULT</strong>. No personal data is transferred to OpenRouter unless the operator explicitly sets ENABLE_OPENROUTER=true. Before enabling, the operator must complete a DPA with OpenRouter, verify SCCs or DPF certification, switch to paid-tier models (to disable training), and update this Policy.</li>
        </ul>
        <p className="text-sm mt-2">
          OmniParse has confirmed SCCs with Groq (US-based) and uses Mistral (EU-based) as the primary
          provider. The cascade prioritizes Mistral first, then Groq — both have appropriate safeguards.
          Google is covered by the DPF. OpenRouter is disabled by default and not used unless the
          operator explicitly enables it. Users should be aware that documents may contain personal data
          of multiple data subjects — the user is responsible for ensuring they have a valid legal basis
          for processing and transferring such data under GDPR Art. 6 and Chapter V.
        </p>
        <h3 className="text-base font-semibold mt-4 mb-2">11.6 Duration and Deletion</h3>
        <p className="text-sm">
          This DPA continues for the duration of the Customer&apos;s use of the Service. Upon account
          termination, file binaries are deleted within 30 days, and all other personal data (extracted
          data, audit logs, chat history, IMAP credentials) is deleted within 90 days, except where
          longer retention is required by law (e.g., financial records under Czech accounting
          regulations). Backup copies maintained by Supabase for disaster recovery are deleted within
          7 days on a rolling basis. This is consistent with the retention schedule in §4 of this
          Privacy Policy.
        </p>
        <h3 className="text-base font-semibold mt-4 mb-2">11.7 Subprocessor Authorization</h3>
        <p className="text-sm">
          Customer grants general written authorization for OmniParse to engage the subprocessors listed in
          Section 11.2. OmniParse will notify Customer of any planned changes to the subprocessor list at
          least 30 days in advance via the Service or by email. Customer may object to a new subprocessor
          in writing within 30 days of notification. In the event of a reasonable objection, OmniParse will
          use commercially reasonable efforts to make available an alternative or recommend a change to
          Customer&apos;s use of the Service to avoid processing by the objected-to subprocessor. If OmniParse
          is unable to provide a reasonable alternative, Customer may suspend or terminate the affected
          Service.
        </p>
        <h3 className="text-base font-semibold mt-4 mb-2">11.9 Personal Data Breach Notification (GDPR Art. 33-34)</h3>
        <p className="text-sm">
          OmniParse will notify Customer without undue delay after becoming aware of a personal-data
          breach affecting Customer&apos;s personal data. Notification will include (i) a description of
          the nature of the breach, (ii) the likely consequences, (iii) the measures taken or proposed,
          and (iv) the contact point for further information. Where the breach is likely to result in a
          risk to the rights and freedoms of natural persons, OmniParse will assist Customer in
          fulfilling Customer&apos;s obligation under GDPR Art. 33 to notify the supervisory authority
          within 72 hours, and under Art. 34 to notify affected data subjects without undue delay.
        </p>
        <h3 className="text-base font-semibold mt-4 mb-2">11.10 Audit Rights</h3>
        <p className="text-sm">
          Customer may audit OmniParse&apos;s compliance with this DPA, upon reasonable prior written
          notice (at least 30 days) and not more than once per calendar year, during normal business
          hours and in a manner that does not interfere with OmniParse&apos;s operations. Alternatively,
          OmniParse may provide a current third-party audit report (e.g., SOC 2 Type II, ISO 27001) or
          equivalent documentation in lieu of an on-site audit, which the parties agree is a reasonable
          alternative under GDPR Art. 28(3)(h).
        </p>
        <h3 className="text-base font-semibold mt-4 mb-2">11.11 Acceptance and Activation</h3>
        <p className="text-sm">
          <strong>For B2B customers (businesses, organizations, accounting firms):</strong> This DPA
          takes effect and is binding between OmniParse (as processor) and the B2B Customer (as
          controller) upon the later of: (a) the Customer&apos;s acceptance of the Terms of Service, and
          (b) the Customer&apos;s first use of the Service to process personal data. The DPA is incorporated
          by reference into the Terms of Service; no separate signature is required for it to take
          effect (per GDPR Art. 28(9) and Recital 81, which permit DPAs to be formed by written
          agreement including electronic form).
        </p>
        <p className="text-sm">
          <strong>Activation mechanism:</strong> B2B Customers who require a standalone signed DPA
          (e.g., for their own compliance records, customer-facing DPAs, or large Enterprise contracts)
          may request one by contacting <strong>damr58h@gmail.com</strong> with the subject line
          &quot;DPA Activation — [Company Name]&quot;. We will execute a standalone Data Processing Agreement
          within 10 business days. Until then, this embedded DPA (Privacy Policy §11) governs the
          processing relationship.
        </p>
        <p className="text-sm">
          <strong>For individual users (consumers):</strong> By uploading documents to the Service and
          checking the data-transfer consent box in the Upload tab, you acknowledge that this DPA
          applies to the extent you act as a data controller processing personal data through the
          Service. For consumers acting in a personal capacity (not processing data on behalf of an
          organization), the controller-processor relationship under GDPR Art. 28 does not strictly
          arise — you are the controller and OmniParse is your processor under the Terms of Service.
        </p>
        <p className="text-sm">
          <strong>Version control:</strong> The &quot;Last updated&quot; date at the top of this Privacy
          Policy reflects the current DPA version. Material changes to this DPA will be notified to
          B2B Customers at least 30 days in advance per §11.7 (Subprocessor Authorization mechanism).
          Prior versions are retained and available on request.
        </p>
      </section>

      <section>
        <h2>12. Privacy Notice for Invoice Data Subjects (GDPR Art. 14)</h2>
        <p>
          Where customers upload documents (e.g., invoices) that contain personal data of individuals
          other than themselves — for example, contact persons at vendor companies, employee names,
          signatories, or bank-account holders — that personal data is processed by OmniParse on the
          customer&apos;s instructions. The customer is the controller with respect to that data;
          OmniParse acts as a processor on the customer&apos;s behalf.
        </p>
        <p>
          Pursuant to GDPR Art. 14, and in reliance on the Art. 14(5)(b) exemption (providing the
          information would involve a disproportionate effort because OmniParse has no direct
          relationship with those data subjects and they may be numerous), this public Privacy Notice
          serves as the transparency mechanism. We ask our customers to inform their data subjects of
          the use of OmniParse where feasible and to direct them to this Notice.
        </p>
        <p>
          <strong>If your personal data appears in a document processed by OmniParse:</strong>
        </p>
        <ul>
          <li><strong>Who is processing your data:</strong> The OmniParse customer who uploaded the document is the data controller. OmniParse (Simon Curda, natural person, Czech Republic) acts as a processor on their behalf.</li>
          <li><strong>Purposes:</strong> Extraction of structured data from invoices for accounting, accounts-payable, and vendor-management purposes.</li>
          <li><strong>Legal basis:</strong> Legitimate interest of the customer in efficient invoice processing (GDPR Art. 6(1)(f)).</li>
          <li><strong>Recipients:</strong> AI inference providers (Mistral, Groq, OpenRouter, Google) and infrastructure providers (Vercel, Supabase, Stripe) — see §6 above.</li>
          <li><strong>Retention:</strong> Personal data is deleted within 90 days of the customer&apos;s account termination, or earlier if the customer deletes the document.</li>
          <li><strong>Your rights:</strong> You have rights of access, rectification, erasure, restriction, portability, and objection. To exercise these rights, contact the customer (the controller) directly; if you cannot reach them, contact us at <strong>damr58h@gmail.com</strong> and we will route your request.</li>
          <li><strong>Right to complain:</strong> You may lodge a complaint with the Czech DPA (ÚOOÚ) or with the supervisory authority of your habitual residence.</li>
        </ul>
      </section>

      <section>
        <h2>13. Changes to This Policy</h2>
        <p>
          We may update this Privacy Policy from time to time. Material changes will be notified via
          the Service or by email at least 30 days before taking effect. The &quot;Last updated&quot; date
          at the top of this page indicates when this Policy was last revised. Continued use of the
          Service after changes constitutes acceptance of the updated Policy.
        </p>
      </section>

      <section>
        <h2>14. Contact</h2>
        <ul>
          <li><strong>Data controller:</strong> Simon Curda, natural person, Czech Republic</li>
          <li><strong>General contact &amp; all GDPR requests:</strong> damr58h@gmail.com</li>
          <li><strong>B2B / DPA matters:</strong> damr58h@gmail.com (subject line &quot;DPA — [company name]&quot;)</li>
          <li><strong>Data Subject Requests (Art. 15-22):</strong> damr58h@gmail.com (subject line &quot;DSR — [your name]&quot;)</li>
          <li><strong>Czech supervisory authority:</strong> <a href="https://www.uoou.cz" target="_blank" rel="noopener">uoou.cz</a></li>
          <li><strong>Canadian Commissioner:</strong> <a href="https://www.priv.gc.ca" target="_blank" rel="noopener">priv.gc.ca</a></li>
        </ul>
      </section>
    </LegalLayout>
  );
}
