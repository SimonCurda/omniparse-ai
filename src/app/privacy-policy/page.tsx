import LegalLayout from '@/app/legal-layout';

export const dynamic = 'force-static';

export default function PrivacyPolicyPage() {
  return (
    <LegalLayout title="Privacy Policy" lastUpdated="December 9, 2026">
      <section>
        <h2>1. Data Controller</h2>
        <p>
          The data controller for personal data processed through this Service is
          <strong> Simon Curda</strong> (natural person, sole trader registration pending), based in the
          Czech Republic. For GDPR purposes (EU Regulation 2016/679), the Controller is responsible for
          ensuring compliance with data protection law.
        </p>
        <p>
          Contact: <strong>damr58h@gmail.com</strong> (use this for all GDPR-related requests:
          access, rectification, erasure, restriction, portability, objection, and consent withdrawal).
          We aim to respond within 30 days as required by GDPR Art. 12(3).
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
          preview it in the dashboard, then automatically deleted. The extracted data is stored
          indefinitely in your account until you delete it.
        </p>
        <p>
          <strong>Chat history:</strong> Messages you send to the AI chat assistant and the responses
          returned are stored in your account database indefinitely until you delete them via the
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
          <li><strong>Terms acceptance:</strong> Consent (Art. 6(1)(a)) — recorded at signup with timestamps. We do not collect or verify age at signup.</li>
          <li><strong>Security and service stability:</strong> Legitimate interest (Art. 6(1)(f)) — server logs for abuse prevention, rate limiting, and fraud detection.</li>
          <li><strong>Local storage preferences:</strong> Consent via cookie banner (Art. 6(1)(a) + ePrivacy Directive).</li>
        </ul>
      </section>

      <section>
        <h2>4. Data Retention</h2>
        <ul>
          <li><strong>Uploaded document files:</strong> Stored for 30 days for preview, then automatically purged by a scheduled job. Extraction results remain.</li>
          <li><strong>Extracted invoice data:</strong> Stored in your account for as long as your account exists. Delete individual invoices from the dashboard to remove this data.</li>
          <li><strong>Chat history:</strong> Stored in your account until you clear it from the dashboard chat tab or delete your account.</li>
          <li><strong>Server logs:</strong> Retained for 30 days by the hosting provider (Vercel), then automatically deleted.</li>
          <li><strong>Account data:</strong> Stored for the duration of your account. You can delete your account and all associated data at any time from Settings. Account deletion also cancels any active Stripe subscription.</li>
          <li><strong>Audit logs:</strong> Records of actions taken on your invoices (edits, status changes, approvals) are stored in your account and are deleted when your account is deleted.</li>
        </ul>
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
        </ul>
        <p>
          To exercise any of these rights, contact us at <strong>damr58h@gmail.com</strong>.
          We will respond within 30 days as required by GDPR Art. 12(3).
          You also have the right to lodge a complaint with a supervisory authority.
        </p>
      </section>

      <section>
        <h2>6. Subprocessors and AI Providers</h2>
        <p>
          We use the following third-party services to provide the Service. Each processes personal data
          on our behalf as a subprocessor under GDPR Art. 28. Data Processing Agreements (DPAs) and
          Standard Contractual Clauses (SCCs) are in place with all confirmed providers (see per-provider
          status below).
        </p>
        <p className="mt-3 p-3 bg-emerald-500/5 border-l-4 border-emerald-500 rounded-r">
          <strong className="text-emerald-700 dark:text-emerald-500">EU-based AI provider available.</strong>{' '}
          Mistral AI (Paris, France) processes documents entirely within the EU. Transfers to Mistral
          are not subject to GDPR Chapter V restrictions (no SCC needed). We prioritize Mistral for
          vision extraction when available.
        </p>
        <ul>
          <li><strong>Vercel Inc.</strong> (United States) — Web hosting and serverless function execution. Processes: IP addresses, request metadata. <a href="https://vercel.com/legal/dpa" target="_blank" rel="noopener">Vercel DPA</a>.</li>
          <li><strong>Supabase Inc.</strong> (Ireland, EU) — Primary database hosting (PostgreSQL). Processes: all stored account data, invoices, chat messages. <a href="https://supabase.com/legal/dpa" target="_blank" rel="noopener">Supabase DPA</a>.</li>
          <li><strong>Mistral AI</strong> (Paris, France — EU) — Primary AI inference provider. Processes: uploaded document content (transiently) for vision extraction. <strong>EU-based — no SCC required.</strong> <a href="https://mistral.ai/legal/privacy-policy" target="_blank" rel="noopener">Mistral Privacy Policy</a>.</li>
          <li><strong>OpenRouter</strong> (United States) — AI inference aggregator. Fallback when Mistral is unavailable. Processes: transient document content and chat messages. <a href="https://openrouter.ai/legal/privacy" target="_blank" rel="noopener">OpenRouter Privacy</a>.</li>
          <li><strong>Groq Inc.</strong> (United States) — AI inference provider. Secondary fallback. Processes: uploaded document content (transiently), chat messages (transiently) for AI extraction and chat responses. <a href="https://groq.com/legal/dpa" target="_blank" rel="noopener">Groq DPA</a> (paid tier).</li>
          <li><strong>Google LLC</strong> (United States) — Final fallback AI inference provider. Models used: Gemini 2.0 Flash, Gemini 2.5 Flash, Gemini 1.5 Flash.</li>
          <li><strong>Stripe Inc.</strong> (United States) — Payment processing for paid plans. Processes: email, billing details. <a href="https://stripe.com/legal/dpa" target="_blank" rel="noopener">Stripe DPA</a>.</li>
        </ul>
        <p>
          <strong>AI vision cascade:</strong> Mistral (EU, primary) → OpenRouter (US, fallback) → Groq (US, secondary fallback) → Google Gemini (US, final fallback).
          For EU users concerned about US transfers, ensuring Mistral is configured means vision extraction stays within the EU.
        </p>
        <p>
          <strong>SCC Status (as of December 9, 2026):</strong>
          <ul className="list-disc pl-6 space-y-1 mt-2 text-sm">
            <li><strong>Groq Inc.</strong> — ✅ SCCs confirmed in effect (DPA effective October 15, 2025; EU SCC Module 2 self-executing upon acceptance of Groq Services Agreement). Confirmed December 9, 2026. Governing law: Ireland. <a href="https://groq.com/legal/dpa" target="_blank" rel="noopener">Groq DPA</a>.</li>
            <li><strong>Mistral AI</strong> — EU-based (Paris, France). As an EU-established provider, transfers to Mistral are expected to remain within the EEA, subject to Mistral&apos;s applicable terms and data-processing agreements.</li>
            <li><strong>OpenRouter</strong> — ⏳ SCC status: pending verification. DPA request sent December 2026.</li>
            <li><strong>Google LLC (Gemini)</strong> — ⏳ SCC status: pending verification. Google Cloud DPA available at <a href="https://cloud.google.com/terms/data-processing-addendum" target="_blank" rel="noopener">cloud.google.com/terms/data-processing-addendum</a> (self-executing upon acceptance of Google Cloud Terms).</li>
          </ul>
        </p>
        <p>
          <strong>EU users:</strong> AI processing via Mistral (EU-based) and Groq (US-based, SCCs confirmed)
          has appropriate safeguards in place under GDPR. However, users should note that documents uploaded
          to the Service may contain personal data of multiple data subjects (e.g. vendor names, employee
          names, email addresses, bank details). The user uploading such documents is responsible for
          ensuring they have a valid legal basis under GDPR Art. 6 for processing that data, and that the
          transfer to AI providers is lawful under Chapter V. OpenRouter and Google remain as fallback
          providers pending SCC verification.
        </p>
        <p>
          <strong>Model training:</strong> We do not intentionally use customer documents or conversations to train or fine-tune AI models. Processing by third-party AI providers is governed by the applicable provider terms and data-processing agreements. The specific terms vary by provider, service tier (paid vs. unpaid), and product configuration. Data may be temporarily processed, cached, or retained by AI providers for security, abuse prevention, monitoring, billing, debugging, or other purposes specified in their applicable terms.
        </p>
      </section>

      <section>
        <h2>7. Security Measures (GDPR Art. 32)</h2>
        <ul>
          <li>Encryption in transit (HTTPS/TLS) for all connections</li>
          <li>Password hashing with bcrypt (12 rounds)</li>
          <li>JWT authentication with 7-day token expiry</li>
          <li>Rate limiting on authentication endpoints (5 login attempts / minute per IP)</li>
          <li>Content-Security-Policy header on all responses to mitigate XSS attacks</li>
          <li>Strict Transport Security (HSTS) with 2-year max-age and preload</li>
          <li>X-Frame-Options: DENY to prevent clickjacking</li>
          <li>Per-user data isolation — every database query includes a userId filter (no IDOR)</li>
          <li>Prompt injection detection on all chat messages (30+ attack patterns)</li>
          <li>Account deletion is transactional — database rows are cascade-deleted to ensure full erasure</li>
        </ul>
      </section>

      <section>
        <h2>8. Children&apos;s Data (GDPR Art. 8)</h2>
        <p>
          The Service is not directed at children under 13. We do not perform age verification at signup.
          If you are under 18, you confirm that you have obtained parental or guardian consent to use this
          Service. Parental consent requirements vary by jurisdiction — in the EU, the age of digital
          consent is between 13 and 16 depending on the Member State (in Czech Republic, it is 15).
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
          <li><strong>Act No. 110/2019 Coll.</strong> on the processing of personal data — Czech implementation of GDPR.</li>
          <li><strong>Act No. 89/2012 Sb.</strong> (Civil Code) — contractual relationships and consumer protection.</li>
          <li><strong>Act No. 480/2004 Sb.</strong> (Electronic Communications Act) — cookies and similar storage technologies.</li>
          <li><strong>Act No. 634/1992 Sb.</strong> (Consumer Protection) — out-of-court dispute resolution.</li>
          <li><strong>Supervisory authority:</strong> Úřad pro ochranu osobních údajů (Office for Personal Data Protection), Pplk. Sochora 27, 170 00 Praha 7, Czech Republic. Website: <a href="https://www.uoou.cz" target="_blank" rel="noopener">uoou.cz</a>.</li>
        </ul>
      </section>

      <section>
        <h2>10. Canadian PIPEDA Compliance</h2>
        <p>
          For users accessing the Service from Canada, OmniParse complies with the Personal Information
          Protection and Electronic Documents Act (PIPEDA). The 10 fair information principles are
          respected. Canadian users may file complaints with the Office of the Privacy Commissioner of
          Canada at <a href="https://www.priv.gc.ca" target="_blank" rel="noopener">priv.gc.ca</a>.
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
        <p className="text-sm">OmniParse engages the following subprocessors. Customer grants general written authorization for OmniParse to engage these subprocessors; the current list is maintained in this Privacy Policy and material changes will be notified 30 days in advance:</p>
        <ul className="list-disc pl-6 space-y-1 text-sm mt-2">
          <li><strong>Vercel Inc.</strong> (United States) — Web hosting and serverless function execution</li>
          <li><strong>Supabase Inc.</strong> (Ireland, EU) — Primary database hosting (PostgreSQL)</li>
          <li><strong>OpenRouter</strong> (United States) — AI inference (primary vision + text)</li>
          <li><strong>Groq Inc.</strong> (United States) — AI inference (fallback vision + text)</li>
          <li><strong>Google LLC</strong> (United States) — AI inference (final fallback vision)</li>
          <li><strong>Stripe Inc.</strong> (United States) — Payment processing (paid plans only)</li>
        </ul>
        <h3 className="text-base font-semibold mt-4 mb-2">11.3 Data Subject Rights</h3>
        <p className="text-sm">
          Customer is responsible for responding to data subject rights requests (access, rectification,
          erasure, portability, objection). OmniParse will assist Customer with such requests, including
          by exporting or deleting personal data upon Customer&apos;s written request. Contact
          <strong> damr58h@gmail.com</strong> with the subject &quot;DPA — Data Subject Request&quot;.
        </p>
        <h3 className="text-base font-semibold mt-4 mb-2">11.4 Security Measures (GDPR Art. 32)</h3>
        <p className="text-sm">OmniParse implements the following technical and organizational measures:</p>
        <ul className="list-disc pl-6 space-y-1 text-sm mt-2">
          <li>AES-256-GCM encryption for IMAP credentials at rest</li>
          <li>bcrypt password hashing (10 rounds)</li>
          <li>TLS 1.2+ for all data in transit</li>
          <li>JWT-based authentication with 7-day expiry</li>
          <li>Per-request user scoping — no query returns cross-user data</li>
          <li>File data auto-purge after 30 days (configurable)</li>
          <li>Account deletion with cascade (full erasure)</li>
          <li>Audit log of significant actions (invoice create/approve/delete)</li>
        </ul>
        <h3 className="text-base font-semibold mt-4 mb-2">11.5 International Transfers (GDPR Chapter V)</h3>
        <p className="text-sm">
          Personal data may be transferred to the United States for AI processing by Groq, OpenRouter, and
          Google. The US does not have an adequacy decision. We rely on Standard Contractual Clauses
          (SCCs) consistent with the Schrems II ruling. <strong>SCC status by provider (as of December 9, 2026):</strong>
        </p>
        <ul className="list-disc pl-6 space-y-1 text-sm mt-2">
          <li><strong>Groq Inc.</strong> — ✅ SCCs confirmed in effect (December 9, 2026). DPA with EU SCC Module 2 is self-executing upon acceptance of Groq Services Agreement. Governing law: Ireland. Competent authority: Irish Data Protection Commission. 72-hour breach notification.</li>
          <li><strong>Mistral AI</strong> — EU-based (Paris, France). As an EU-established provider, transfers are expected to remain within the EEA, subject to Mistral&apos;s applicable terms.</li>
          <li><strong>OpenRouter</strong> — ⏳ SCC status: pending verification. DPA request sent December 2026.</li>
          <li><strong>Google LLC</strong> — ⏳ SCC status: pending verification. Google Cloud DPA available at cloud.google.com/terms/data-processing-addendum (self-executing upon acceptance of Google Cloud Terms).</li>
        </ul>
        <p className="text-sm mt-2">
          OmniParse has confirmed SCCs with Groq (US-based) and uses Mistral (EU-based). However,
          users should be aware that documents may contain personal data of multiple data subjects.
          The user is responsible for ensuring they have a valid legal basis for processing and
          transferring such data. The platform's cascade prioritizes Mistral first, then Groq —
          both have appropriate safeguards. OpenRouter and Google are additional fallbacks pending
          SCC verification.
        </p>
        <h3 className="text-base font-semibold mt-4 mb-2">11.6 Duration and Deletion</h3>
        <p className="text-sm">
          This DPA continues for the duration of your subscription. Upon account termination, all personal
          data is deleted within 30 days (file binaries) and 90 days (extracted data, audit logs), except
          where longer retention is required by law.
        </p>
        <h3 className="text-base font-semibold mt-4 mb-2">11.7 Acceptance</h3>
        <p className="text-sm">
          By uploading documents to the Service and checking the data transfer consent box in the Upload
          tab, Customer accepts this DPA on behalf of themselves and any data subjects whose personal data
          they upload.
        </p>
      </section>

      <section>
        <h2>12. Changes to This Policy</h2>
        <p>
          We may update this Privacy Policy from time to time. Material changes will be notified via
          the Service or by email. The &quot;Last updated&quot; date at the top of this page indicates
          when this Policy was last revised. Continued use of the Service after changes constitutes
          acceptance of the updated Policy.
        </p>
      </section>

      <section>
        <h2>13. Contact</h2>
        <ul>
          <li><strong>Data controller:</strong> Simon Curda, Czech Republic</li>
          <li><strong>General contact &amp; all GDPR requests:</strong> damr58h@gmail.com</li>
          <li><strong>Czech supervisory authority:</strong> <a href="https://www.uoou.cz" target="_blank" rel="noopener">uoou.cz</a></li>
          <li><strong>Canadian Commissioner:</strong> <a href="https://www.priv.gc.ca" target="_blank" rel="noopener">priv.gc.ca</a></li>
        </ul>
      </section>
    </LegalLayout>
  );
}
