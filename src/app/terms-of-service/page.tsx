import LegalLayout from '@/app/legal-layout';

export const dynamic = 'force-static';

export default function TermsOfServicePage() {
  return (
    <LegalLayout title="Terms of Service" lastUpdated="August 5, 2026">
      <section>
        <h2>1. Acceptance of Terms</h2>
        <p>
          By accessing or using OmniParse ("the Service"), you agree to be bound by these Terms of Service ("Terms").
          If you do not agree with any part of these Terms, you must not use the Service.
          These Terms apply to all users of the Service.
        </p>
      </section>

      <section>
        <h2>2. Description of Service</h2>
        <p>
          OmniParse is an AI-powered document parsing application that extracts structured data from invoices and similar business documents.
          The Service uses vision-language models to analyze uploaded documents and return extracted data in JSON format.
        </p>
        <p><strong>Current capabilities:</strong></p>
        <ul>
          <li>Document upload (PDF, JPEG, PNG, WebP) up to 10MB per file</li>
          <li>AI-powered field extraction with per-field confidence scores</li>
          <li>AI chat assistant with interactive artifact generation (tables, charts, summaries)</li>
          <li>Data export (CSV and JSON) from the invoices table</li>
          <li>Visual analytics dashboard with charts</li>
          <li>User authentication with email, password, and JWT tokens</li>
        </ul>
      </section>

      <section>
        <h2>3. User Responsibilities</h2>
        <ul>
          <li>You are solely responsible for the documents you upload to the Service.</li>
          <li>You must have the legal right to process any documents you submit (ownership, authorization, or legitimate interest).</li>
          <li>You must not use the Service for any unlawful purpose, including fraud, money laundering, or tax evasion.</li>
          <li>You must not attempt to reverse-engineer, decompile, or disrupt the Service.</li>
          <li>You must not use automated tools to overwhelm the Service (no scraping, no DDoS).</li>
          <li>You acknowledge that AI-extracted data may contain errors and you are responsible for verifying results before use.</li>
        </ul>
      </section>

      <section>
        <h2>4. Intellectual Property</h2>
        <p>
          Content you upload remains your property. OmniParse does not claim ownership of your documents or extracted data.
          The Service itself, including its code, design, and documentation, is the property of OmniParse AI.
        </p>
        <p>
          You may not copy, modify, distribute, or create derivative works from the Service itself without written permission.
        </p>
      </section>

      <section>
        <h2>5. Data Processing</h2>
        <p>
          Uploaded documents are processed per-request by the AI. Extracted data is stored in your account database
          and is accessible from your dashboard. You can delete your data at any time.
          See our <a href="/privacy-policy" className="underline">Privacy Policy</a> for full details on data handling.
        </p>
      </section>

      <section>
        <h2>6. AI Disclaimer</h2>
        <p>
          THE SERVICE USES ARTIFICIAL INTELLIGENCE FOR DOCUMENT ANALYSIS AND CHAT RESPONSES.
          AI OUTPUT MAY CONTAIN ERRORS, INACCURACIES, OR HALLUCINATIONS.
        </p>
        <p>
          <strong>You must always verify AI-extracted data against the original documents</strong> before using it
          for financial reporting, tax filing, legal proceedings, or any context where accuracy is critical.
          OmniParse provides confidence scores as a guide, but these are estimates and not guarantees of accuracy.
        </p>
        <p>
          See our <a href="/ai-act-notice" className="underline">AI Transparency Notice</a> for full details on AI limitations and your rights.
        </p>
      </section>

      <section>
        <h2>7. Disclaimer of Warranties</h2>
        <p>
          THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTIES OF ANY KIND,
          EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY,
          FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
        </p>
        <p>
          We do not warrant that the Service will be uninterrupted, error-free, or free of harmful components.
          We do not warrant that AI extraction results will be accurate or complete.
        </p>
      </section>

      <section>
        <h2>8. Limitation of Liability</h2>
        <p>
          To the maximum extent permitted by applicable law, OmniParse AI shall not be liable for any indirect,
          incidental, special, consequential, or punitive damages, including but not limited to loss of profits,
          data, or business opportunities, arising from or related to your use of the Service.
        </p>
        <p>
          Our total liability for any claim shall not exceed the amount you paid to us in the 12 months preceding the claim,
          or zero if you are using the free/demo tier.
        </p>
      </section>

      <section>
        <h2>9. Indemnification</h2>
        <p>
          You agree to indemnify and hold harmless OmniParse AI, its officers, directors, employees, and agents
          from and against any claims, damages, losses, or expenses arising from your use of the Service
          or your violation of these Terms.
        </p>
      </section>

      <section>
        <h2>10. Modifications to Terms</h2>
        <p>
          We may update these Terms from time to time. Material changes will be notified via the Service or by email.
          Continued use of the Service after changes constitutes acceptance of the updated Terms.
          The &quot;Last updated&quot; date at the top of this page indicates when these Terms were last revised.
        </p>
      </section>

      <section>
        <h2>11. Governing Law and Dispute Resolution</h2>
        <p>
          These Terms are governed by the laws of the Czech Republic, without regard to conflict of law principles.
          EU consumer protection laws apply additionally for users classified as consumers under EU law.
        </p>
        <p>
          For disputes arising from these Terms, you agree to first attempt resolution by contacting us at
          legal@omniparse.ai. If the dispute cannot be resolved, it shall be submitted to the competent courts
          of the Czech Republic.
        </p>
        <p>
          Under EU Regulation 524/2013, EU consumers may use the <strong>European Online Dispute Resolution (ODR) platform</strong>
          at ec.europa.eu/consumers/odr for out-of-court dispute resolution.
        </p>
      </section>

      <section>
        <h2>12. Severability</h2>
        <p>
          If any provision of these Terms is found to be unenforceable or invalid, that provision shall be limited
          or eliminated to the minimum extent necessary, and the remaining provisions shall remain in full force and effect.
        </p>
      </section>

      <section>
        <h2>13. Contact</h2>
        <p>For questions about these Terms: <strong>legal@omniparse.ai</strong></p>
      </section>

      <p className="text-xs mt-8">
        Compliant with EU Directive 93/13/EEC (unfair contract terms), EU Regulation 524/2013 (ODR),
        Czech Act No. 89/2012 Sb. (Civil Code), and Czech Act No. 634/1992 Sb. (Consumer Protection).
      </p>
    </LegalLayout>
  );
}
