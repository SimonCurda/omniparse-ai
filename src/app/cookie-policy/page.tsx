import LegalLayout from '@/app/legal-layout';

export const dynamic = 'force-static';

export default function CookiePolicyPage() {
  return (
    <LegalLayout title="Cookie Policy" lastUpdated="August 5, 2026">
      <section>
        <h2>1. What Are Cookies</h2>
        <p>
          Cookies are small text files stored on your device by websites you visit. OmniParse primarily uses
          browser Local Storage rather than traditional cookies, but the same principles and legal requirements apply
          under the EU ePrivacy Directive (2002/58/EC) and GDPR.
        </p>
      </section>

      <section>
        <h2>2. What We Use</h2>
        <p><strong>Essential (always active — no consent required):</strong></p>
        <ul>
          <li><strong>Theme preference:</strong> Stores your light/dark mode choice in Local Storage.</li>
          <li><strong>Cookie consent record:</strong> Stores your consent choice and timestamp so we do not ask again.</li>
          <li><strong>Authentication token:</strong> Stores your JWT session token in Local Storage so you stay signed in across page refreshes.</li>
        </ul>
        <p><strong>Analytics (only with your consent):</strong></p>
        <ul>
          <li>Currently, no analytics cookies are active. If we implement analytics in the future, we will update this policy and seek your consent via the cookie banner.</li>
        </ul>
        <p><strong>Third-party cookies:</strong></p>
        <ul>
          <li>OmniParse does not set third-party cookies. No advertising, tracking, or social media cookies are used.</li>
        </ul>
      </section>

      <section>
        <h2>3. Legal Basis</h2>
        <p>
          Under the EU ePrivacy Directive (2002/58/EC), as amended by Directive 2009/136/EC, and GDPR:
        </p>
        <ul>
          <li><strong>Essential storage:</strong> Exempt from consent requirements as strictly necessary for the provision of the Service.</li>
          <li><strong>Non-essential storage:</strong> Requires your explicit, informed, prior consent.</li>
          <li>You may withdraw consent at any time by clearing your browser&apos;s Local Storage.</li>
          <li>You have the right to be informed about what data is collected and for what purpose.</li>
        </ul>
      </section>

      <section>
        <h2>4. Managing Your Preferences</h2>
        <p>
          You can manage or remove Local Storage data through your browser settings:
        </p>
        <ul>
          <li><strong>Chrome:</strong> Settings &gt; Privacy and security &gt; Cookies and other site data &gt; Site data</li>
          <li><strong>Firefox:</strong> Settings &gt; Privacy &amp; Security &gt; Cookies and Site Data</li>
          <li><strong>Safari:</strong> Preferences &gt; Privacy &gt; Manage Website Data</li>
        </ul>
        <p>
          Blocking or deleting Local Storage data may affect the Service&apos;s functionality — for example,
          your authentication session and theme preference will be lost.
        </p>
      </section>

      <section>
        <h2>5. Czech Republic</h2>
        <p>
          Under Czech Act No. 127/2005 Coll. on Electronic Communications and amendments to certain related acts:
          the processing of Local Storage data requires the user&apos;s consent unless it is strictly necessary
          for the operation of the service. OmniParse complies with this requirement through the cookie consent banner.
        </p>
      </section>

      <section>
        <h2>6. Contact</h2>
        <p>For questions about this Cookie Policy: <strong>privacy@omniparse.ai</strong></p>
      </section>

      <p className="text-xs mt-8">
        Complies with EU ePrivacy Directive 2002/58/EC, GDPR Art. 6(1)(a), and Czech Act No. 127/2005 Coll.
      </p>
    </LegalLayout>
  );
}
