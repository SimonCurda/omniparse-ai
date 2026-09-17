import LegalLayout from '@/app/legal-layout';

export const dynamic = 'force-static';

export default function CookiePolicyPage() {
  return (
    <LegalLayout title="Cookie Policy" lastUpdated="September 12, 2026">
      <section>
        <h2>1. What Are Cookies and Local Storage</h2>
        <p>
          Cookies are small text files stored on your device by websites you visit. OmniParse primarily
          uses browser Local Storage rather than traditional cookies. Under the EU ePrivacy Directive
          (2002/58/EC) as amended by Directive 2009/136/EC, the consent requirements apply to both
          cookies and Local Storage. Each item stored is classified as either essential or non-essential
          based on its purpose.
        </p>
      </section>

      <section>
        <h2>2. What We Store and Why</h2>
        <p><strong>Essential storage (always active — exempt from consent per ePrivacy Art. 5(3)):</strong></p>
        <ul>
          <li><strong>Authentication token (op_token):</strong> Stores your JWT session token in Local Storage so you stay signed in across page refreshes. Required for the Service to function.</li>
          <li><strong>Cookie consent record (omniparse_cookie_consent):</strong> Stores your consent choice and timestamp. Purpose: prevents re-showing the consent banner. Required to respect your consent decision.</li>
        </ul>
        <p><strong>Non-essential storage (requires consent — only set after you accept via the cookie banner):</strong></p>
        <ul>
          <li><strong>Theme preference (theme):</strong> Stores your light/dark mode choice. Purpose: user preference.</li>
          <li><strong>Keyboard shortcuts (op_shortcuts):</strong> Stores custom keyboard shortcut assignments. Purpose: user preference.</li>
          <li><strong>Legal consent (op_legal_consent):</strong> Records GDPR data transfer consent. Purpose: compliance.</li>
          <li><strong>Crash logs (op_crash_log):</strong> Stores recent client-side errors for debugging. Purpose: service stability. Limited to last 10 errors.</li>
        </ul>
        <p><strong>Analytics:</strong></p>
        <ul>
          <li>Currently, no analytics cookies are active. If we implement analytics in the future, we will update this policy and seek your consent via the cookie banner.</li>
        </ul>
        <p><strong>Third-party cookies:</strong></p>
        <ul>
          <li>OmniParse does not set third-party cookies. No advertising, tracking, or social media cookies are used.</li>
          <li><strong>Note about Stripe:</strong> If you upgrade to a paid plan, Stripe&apos;s checkout page may set its own cookies on the Stripe domain (not omniparse-ai.vercel.app). See <a href="https://stripe.com/cookies" target="_blank" rel="noopener">Stripe&apos;s cookie policy</a> for details.</li>
        </ul>
      </section>

      <section>
        <h2>3. Legal Basis</h2>
        <p>
          Under the EU ePrivacy Directive (2002/58/EC), as amended by Directive 2009/136/EC, and GDPR:
        </p>
        <ul>
          <li><strong>Essential storage (op_token, omniparse_cookie_consent):</strong> Exempt from consent requirements as strictly necessary for the provision of the Service explicitly requested by the user (ePrivacy Art. 5(3) exception).</li>
          <li><strong>Non-essential storage (theme, op_shortcuts, op_legal_consent, op_crash_log):</strong> Requires your explicit, informed, prior consent via the cookie banner. You may withdraw consent at any time by clearing your browser&apos;s Local Storage or by using the &quot;Essential only&quot; button.</li>
          <li>You may withdraw consent at any time by clearing your browser&apos;s Local Storage.</li>
          <li>You have the right to be informed about what data is collected and for what purpose (this section).</li>
        </ul>
      </section>

      <section>
        <h2>4. Cookie Banner</h2>
        <p>
          On your first visit to the Service, a cookie banner appears at the bottom of the screen. You
          have two options:
        </p>
        <ul>
          <li><strong>&quot;Accept all&quot;:</strong> Records consent for both essential and (future) analytics storage.</li>
          <li><strong>&quot;Essential only&quot;:</strong> Records consent for essential storage only; no analytics storage will be set.</li>
        </ul>
        <p>
          Your choice is recorded in Local Storage under the key <code>omniparse_cookie_consent</code> and
          persists across sessions. You can change your choice at any time by clearing this key from your
          browser&apos;s Local Storage.
        </p>
      </section>

      <section>
        <h2>5. Managing Your Preferences</h2>
        <p>
          You can manage or remove Local Storage data through your browser settings:
        </p>
        <ul>
          <li><strong>Chrome:</strong> Settings &gt; Privacy and security &gt; Cookies and other site data &gt; Site data</li>
          <li><strong>Firefox:</strong> Settings &gt; Privacy &amp; Security &gt; Cookies and Site Data</li>
          <li><strong>Safari:</strong> Preferences &gt; Privacy &gt; Manage Website Data</li>
        </ul>
        <p>
          Blocking or deleting Local Storage data may affect the Service&apos;s functionality — for
          example, your authentication session and theme preference will be lost.
        </p>
      </section>

      <section>
        <h2>6. Czech Republic</h2>
        <p>
          Under Czech Act No. 127/2005 Coll. on Electronic Communications and amendments to certain
          related acts: the processing of Local Storage data requires the user&apos;s consent unless it
          is strictly necessary for the operation of the service. OmniParse complies with this
          requirement through the cookie consent banner.
        </p>
      </section>

      <section>
        <h2>7. Contact</h2>
        <p>For questions about this Cookie Policy: <strong>damr58h@gmail.com</strong></p>
      </section>

      <p className="text-xs mt-8">
        Complies with EU ePrivacy Directive 2002/58/EC, GDPR Art. 6(1)(a), and Czech Act No. 127/2005 Coll.
      </p>
    </LegalLayout>
  );
}
