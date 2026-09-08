import LegalLayout from '@/app/legal-layout';

export const dynamic = 'force-static';

export default function PrivacyPolicyPage() {
  return (
    <LegalLayout title="Privacy Policy" lastUpdated="August 5, 2026">
      <section>
        <h2>1. Data Controller</h2>
        <p>
          <strong>OmniParse AI</strong> (hereinafter &quot;the Controller&quot;) is the data controller for personal data processed through this Service.
          For GDPR purposes (EU Regulation 2016/679), the Controller is responsible for ensuring compliance with data protection law.
        </p>
        <p>
          Data Protection Officer (DPO) contact: <strong>dpo@omniparse.ai</strong>
        </p>
      </section>

      <section>
        <h2>2. Personal Data We Collect</h2>
        <p>
          <strong>Documents you upload:</strong> When you use the document parsing feature, your files (PDF, images) are sent to our AI processing endpoint.
          Documents are processed per-request and are not permanently stored on our servers. The extracted data is returned and stored securely
          in your account database. We do not retain your uploaded document files beyond the duration of the API request.
        </p>
        <p>
          <strong>Account information:</strong> When you register, we collect your name and email address.
          Your password is hashed using bcrypt (12 rounds) and never stored in plaintext.
          This data is processed based on your consent (GDPR Art. 6(1)(a)) for the purpose of providing the Service.
        </p>
        <p>
          <strong>Technical data:</strong> We collect standard server logs including your IP address, browser type, and request timestamps
          for security and service stability purposes. This is processed under our legitimate interest (GDPR Art. 6(1)(f)).
        </p>
        <p>
          <strong>Local storage data:</strong> The application uses your browser&apos;s local storage to remember your authentication token,
          theme preference, and cookie consent choice. Invoice and chat data is stored server-side in your account, not in local storage.
        </p>
      </section>

      <section>
        <h2>3. Legal Basis for Processing (GDPR Art. 6)</h2>
        <ul>
          <li><strong>Document parsing:</strong> Consent (Art. 6(1)(a)) — you actively upload documents for processing.</li>
          <li><strong>Chat interactions:</strong> Consent (Art. 6(1)(a)) — you actively send messages to the AI chat.</li>
          <li><strong>Security and service stability:</strong> Legitimate interest (Art. 6(1)(f)) — server logs for abuse prevention.</li>
          <li><strong>Local storage preferences:</strong> Consent via cookie banner (Art. 6(1)(a) + ePrivacy Directive).</li>
        </ul>
      </section>

      <section>
        <h2>4. Data Retention</h2>
        <ul>
          <li><strong>Uploaded documents:</strong> Not stored beyond the API request duration. Processed in memory only.</li>
          <li><strong>Extracted invoice data:</strong> Stored in your account database for as long as your account exists.</li>
          <li><strong>Chat history:</strong> Stored in your account database. You can clear it at any time from the dashboard.</li>
          <li><strong>Server logs:</strong> Retained for 30 days, then automatically deleted.</li>
          <li><strong>Account data:</strong> Stored for the duration of your account. You can delete your account and all associated data at any time from Settings.</li>
        </ul>
      </section>

      <section>
        <h2>5. Your Rights Under GDPR (Art. 12-23)</h2>
        <p>You have the following rights regarding your personal data:</p>
        <ul>
          <li><strong>Right of access (Art. 15):</strong> Request a copy of all personal data we hold about you.</li>
          <li><strong>Right to rectification (Art. 16):</strong> Request correction of inaccurate personal data.</li>
          <li><strong>Right to erasure / &quot;right to be forgotten&quot; (Art. 17):</strong> Request deletion of your personal data.</li>
          <li><strong>Right to restriction of processing (Art. 18):</strong> Request that we limit how we use your data.</li>
          <li><strong>Right to data portability (Art. 20):</strong> Receive your data in a structured, machine-readable format.</li>
          <li><strong>Right to object (Art. 21):</strong> Object to processing based on legitimate interests.</li>
          <li><strong>Right to withdraw consent (Art. 7(3)):</strong> Withdraw consent at any time via cookie settings or by contacting us.</li>
        </ul>
        <p>
          To exercise any of these rights, contact us at <strong>dpo@omniparse.ai</strong>.
          We will respond within 30 days as required by GDPR Art. 12(3).
          You also have the right to lodge a complaint with a supervisory authority.
        </p>
      </section>

      <section>
        <h2>6. Data Transfers</h2>
        <p>
          AI processing is handled by Google Gemini (Google DeepMind), which may transmit your document data to Google's AI infrastructure.
          When such transfers occur, we ensure appropriate safeguards are in place, including:
        </p>
        <ul>
          <li>Data processing agreements (GDPR Art. 28) with any subprocessors</li>
          <li>Processing within the EU/EEA where possible, or with adequacy decisions in place</li>
          <li>No permanent storage of your documents by AI providers (per-request processing only)</li>
        </ul>
        <p>
          Your documents are not used to train AI models. We do not log the content of your documents or chat messages.
        </p>
      </section>

      <section>
        <h2>7. Security Measures (GDPR Art. 32)</h2>
        <ul>
          <li>Encryption in transit (HTTPS/TLS) for all connections</li>
          <li>Per-request processing — documents are not stored on disk</li>
          <li>No sensitive data in server logs (document content is never logged)</li>
          <li>Secure development practices with regular dependency updates</li>
        </ul>
      </section>

      <section>
        <h2>8. Canadian PIPEDA Compliance</h2>
        <p>
          For users accessing the Service from Canada, OmniParse complies with the Personal Information Protection and Electronic Documents Act (PIPEDA).
          The 10 fair information principles are respected:
        </p>
        <ul>
          <li><strong>Accountability:</strong> OmniParse AI is responsible for personal data under its control.</li>
          <li><strong>Identifying Purposes:</strong> Purposes for data collection are disclosed in this policy.</li>
          <li><strong>Consent:</strong> Knowledge and consent are required for collection, use, or disclosure.</li>
          <li><strong>Limiting Collection:</strong> Only data necessary for the stated purposes is collected.</li>
          <li><strong>Limiting Use:</strong> Data is only used for the purposes disclosed.</li>
          <li><strong>Accuracy:</strong> Data is kept as accurate and up-to-date as necessary.</li>
          <li><strong>Safeguards:</strong> Appropriate security measures protect personal data.</li>
          <li><strong>Openness:</strong> This privacy policy is readily available to all users.</li>
          <li><strong>Individual Access:</strong> Users may access and challenge the accuracy of their data.</li>
          <li><strong>Challenging Compliance:</strong> Users may challenge our compliance with PIPEDA principles.</li>
        </ul>
        <p>
          Canadian users may file complaints with the Office of the Privacy Commissioner of Canada at <strong>priv.gc.ca</strong>.
        </p>
      </section>

      <section>
        <h2>9. Czech Republic Compliance</h2>
        <p>
          For users in the Czech Republic, the following applies in addition to GDPR:
        </p>
        <ul>
          <li><strong>Act No. 110/2019 Coll.</strong> on the processing of personal data — OmniParse complies with this Czech implementation of GDPR.</li>
          <li><strong>Supervisory authority:</strong> Urad pro ochranu osobnich udaju (Office for Personal Data Protection), Pplk. Sochora 27, 170 00 Praha 7, Czech Republic. Website: <strong>uoou.cz</strong></li>
          <li><strong>Act No. 89/2012 Sb.</strong> (Civil Code) — Governs contractual relationships and consumer protection in the Czech Republic.</li>
          <li><strong>Act No. 480/2004 Sb.</strong> (Electronic Communications Act) — Governs electronic communications and related data processing.</li>
        </ul>
      </section>

      <section>
        <h2>10. Contact</h2>
        <ul>
          <li><strong>DPO:</strong> dpo@omniparse.ai</li>
          <li><strong>Czech Authority:</strong> uoou.cz</li>
          <li><strong>Canadian Commissioner:</strong> priv.gc.ca</li>
          <li><strong>General contact:</strong> legal@omniparse.ai</li>
        </ul>
      </section>
    </LegalLayout>
  );
}
