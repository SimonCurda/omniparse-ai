import LegalLayout from '@/app/legal-layout';

export const dynamic = 'force-static';

export default function PrivacyPolicyPage() {
  return (
    <LegalLayout title="Privacy Policy" lastUpdated="September 9, 2026">
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
          <li><strong>Terms acceptance and age confirmation:</strong> Consent (Art. 6(1)(a)) — recorded at signup with timestamps.</li>
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
          on our behalf as a subprocessor under GDPR Art. 28. We have signed or are in the process of
          signing Data Processing Agreements (DPAs) with each provider.
        </p>
        <ul>
          <li><strong>Vercel Inc.</strong> (United States) — Web hosting and serverless function execution. Processes: IP addresses, request metadata. <a href="https://vercel.com/legal/dpa" target="_blank" rel="noopener">Vercel DPA</a>.</li>
          <li><strong>Supabase Inc.</strong> (Ireland, EU) — Primary database hosting (PostgreSQL). Processes: all stored account data, invoices, chat messages. <a href="https://supabase.com/legal/dpa" target="_blank" rel="noopener">Supabase DPA</a>.</li>
          <li><strong>Groq Inc.</strong> (United States) — AI inference provider. Processes: uploaded document content (PDF/images, transiently), chat messages (transiently) for AI extraction and chat responses. <a href="https://groq.com/legal/dpa" target="_blank" rel="noopener">Groq DPA</a> (paid tier).</li>
          <li><strong>OpenRouter</strong> (United States) — AI inference aggregator. Used as a fallback when Groq is unavailable. Processes: same as Groq (transient document content and chat messages). <a href="https://openrouter.ai/legal/privacy" target="_blank" rel="noopener">OpenRouter Privacy</a>.</li>
          <li><strong>Stripe Inc.</strong> (United States) — Payment processing for paid plans. Processes: email, billing details. <a href="https://stripe.com/legal/dpa" target="_blank" rel="noopener">Stripe DPA</a>.</li>
        </ul>
        <p>
          <strong>Important:</strong> Your documents are sent to Groq and/or OpenRouter for AI processing.
          Both are US-based providers. Under GDPR Chapter V (transfers to third countries), since the US
          lacks an adequacy decision, we rely on Standard Contractual Clauses (SCCs) for these transfers,
          consistent with the Schrems II ruling. We are in the process of executing SCCs with each US
          provider. Until those are signed, transfers to US AI providers are at your own risk — please
          do not upload documents containing personal data of EU data subjects until SCCs are in place.
        </p>
        <p>
          <strong>Your documents are NOT used to train AI models.</strong> Groq and OpenRouter both
          have policies against using customer API inputs for model training. Documents are processed
          in memory only and discarded after the response is generated.
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
          The Service is not directed at children under 15. At signup, we require users to confirm they
          are at least 15 years old. If we learn that we have collected personal data from a child under
          15 without parental consent, we will delete that data promptly. Contact us at
          <strong> damr58h@gmail.com</strong> if you believe a child has provided us with personal data.
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
        <h2>11. Changes to This Policy</h2>
        <p>
          We may update this Privacy Policy from time to time. Material changes will be notified via
          the Service or by email. The &quot;Last updated&quot; date at the top of this page indicates
          when this Policy was last revised. Continued use of the Service after changes constitutes
          acceptance of the updated Policy.
        </p>
      </section>

      <section>
        <h2>12. Contact</h2>
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
