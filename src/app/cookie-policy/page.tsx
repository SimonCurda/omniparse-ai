import LegalLayout from '@/app/legal-layout';

export const dynamic = 'force-static';

export default function CookiePolicyPage() {
  return (
    <LegalLayout title="Cookie Policy" lastUpdated="September 19, 2026">
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
        <p><strong>Essential storage (always active — exempt from consent per ePrivacy Art. 5(3), as implemented by Czech Act No. 127/2005 Coll. § 89):</strong></p>
        <ul>
          <li><strong>Authentication token (op_token):</strong> Stores your JWT session token in Local Storage so you stay signed in across page refreshes. <em>Retention:</em> 7 days (matching JWT expiry), then auto-cleared on next page load. <em>Purpose:</em> Strictly necessary for the Service to function.</li>
          <li><strong>Cookie consent record (omniparse_cookie_consent):</strong> The consent-preference record is used to remember the user&apos;s storage preferences and to avoid repeatedly displaying the consent prompt. Its classification and retention are assessed according to its specific purpose and applicable law. <em>Retention:</em> 12 months from last update, then re-prompted. <em>Purpose:</em> Prevents re-showing the consent banner and records your consent decision for accountability.</li>
        </ul>
        <p><strong>Non-essential storage (requires consent — only set after you accept via the cookie banner):</strong></p>
        <ul>
          <li><strong>Theme preference (theme):</strong> Stores your light/dark mode choice. <em>Retention:</em> Until withdrawn or browser data cleared. <em>Purpose:</em> User preference (UI customization).</li>
          <li><strong>Keyboard shortcuts (op_shortcuts):</strong> Stores custom keyboard shortcut assignments. <em>Retention:</em> Until withdrawn or browser data cleared. <em>Purpose:</em> User preference (UI customization).</li>
          <li><strong>Legal consent (op_legal_consent):</strong> Records GDPR data-transfer consent for document uploads. <em>Retention:</em> Duration of account; refreshed on each upload if revoked. <em>Purpose:</em> Compliance (GDPR consent evidence). <em>Note on separation:</em> This storage item records a consent decision; it is distinct from the legal basis for processing documents, which is determined separately based on the user&apos;s role, the purpose of processing and applicable law. Where consent is the legal basis, it will be requested through a separate, specific and informed mechanism and will not be bundled with unrelated cookie preferences.</li>
          <li><strong>Crash logs (op_crash_log):</strong> Stores recent client-side errors for debugging. <em>Retention:</em> Rolling window — last 10 errors only, FIFO overwrite. <em>Purpose:</em> Service stability and debugging. Client-side crash logs are limited to a rolling window of the latest 10 entries. OmniParse is designed to avoid including document contents, authentication tokens or unnecessary personal data in crash logs. Where personal data is inadvertently included, it is handled under the applicable retention and security controls.</li>
        </ul>
        <p><strong>Analytics:</strong></p>
        <ul>
          <li>Currently, no analytics cookies or storage items are active. If we implement analytics in the future, we will (a) update this Policy with the specific item name, purpose, and retention; (b) seek your explicit consent via the cookie banner; and (c) ensure the analytics provider is GDPR-compliant (e.g., DPF-certified or SCC-backed).</li>
        </ul>
        <p><strong>Third-party cookies:</strong></p>
        <ul>
          <li>OmniParse does not set third-party cookies on the omniparse-ai.vercel.app domain. No advertising, tracking, social-media, or fingerprinting cookies are used.</li>
          <li><strong>Note about Stripe:</strong> If you upgrade to a paid plan, Stripe&apos;s checkout page (at checkout.stripe.com) may set its own cookies on the Stripe domain (not omniparse-ai.vercel.app). These are governed by <a href="https://stripe.com/cookies" target="_blank" rel="noopener">Stripe&apos;s cookie policy</a> and are necessary for payment security and fraud prevention. OmniParse does not control Stripe&apos;s cookies.</li>
        </ul>
        <p><strong>Other storage technologies:</strong></p>
        <ul>
          <li>OmniParse&apos;s current production configuration uses Local Storage (not browser cookies) for client-side state. If cookies are introduced in the future (e.g., for session management, CSRF protection, or framework-level features), this Policy will be updated with the specific cookie name, purpose, duration, security attributes (Secure, HttpOnly, SameSite), and whether the cookie is first-party or third-party.</li>
        </ul>
      </section>

      <section>
        <h2>3. Legal Basis</h2>
        <p>
          Under the EU ePrivacy Directive (2002/58/EC), as amended by Directive 2009/136/EC, and GDPR:
        </p>
        <ul>
          <li><strong>Essential storage (op_token, omniparse_cookie_consent, Next.js session cookies):</strong> Exempt from consent requirements as strictly necessary for the provision of the Service explicitly requested by the user (ePrivacy Art. 5(3) exception, as implemented by Czech Act No. 127/2005 Coll. § 89).</li>
          <li><strong>Non-essential storage (theme, op_shortcuts, op_legal_consent, op_crash_log):</strong> Requires your explicit, informed, prior consent via the cookie banner (GDPR Art. 6(1)(a) + ePrivacy Art. 5(3)). Consent must be as easy to withdraw as to give. You may withdraw consent at any time by (a) clicking the &quot;Essential only&quot; button in the cookie banner re-openable via Settings → Privacy, or (b) clearing your browser&apos;s Local Storage.</li>
          <li>You have the right to be informed about what data is collected and for what purpose (this section).</li>
          <li>You have the right to lodge a complaint with the Czech DPA (ÚOOÚ) if you believe our cookie practices violate applicable law.</li>
        </ul>
      </section>

      <section>
        <h2>4. Cookie Banner and Granular Consent</h2>
        <p>
          On your first visit to the Service, a cookie banner appears at the bottom of the screen.
          You have the following options:
        </p>
        <ul>
          <li><strong>&quot;Accept all&quot;:</strong> Records consent for both essential and all non-essential storage (theme, shortcuts, legal consent, crash logs).</li>
          <li><strong>&quot;Essential only&quot;:</strong> Records consent for essential storage only; non-essential items are not set, and any previously set non-essential items are cleared.</li>
          <li><strong>&quot;Manage preferences&quot; (planned):</strong> A granular preference-management feature is planned. Until it is implemented, the banner provides the currently available choices described below. The Service does not represent that per-category consent controls are available before that feature is released.</li>
        </ul>
        <p>
          The banner does not block page load (essential cookies work regardless). Your choice is
          recorded in Local Storage under the key <code>omniparse_cookie_consent</code> along with a
          timestamp, and persists for 12 months. After 12 months, or if you clear your Local Storage,
          the banner will re-appear.
        </p>
        <p>
          You can change your choice at any time by clicking the &quot;Cookie settings&quot; link in the
          footer, or by clearing the <code>omniparse_cookie_consent</code> key from your browser&apos;s
          Local Storage.
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
          Under Czech Act No. 127/2005 Coll. (Electronic Communications Act) § 89, as amended effective
          1 January 2022 to align with the ePrivacy Directive: the processing of Local Storage data
          and cookies requires the user&apos;s consent unless it is strictly necessary for the operation
          of the service requested by the user. OmniParse complies with this requirement through the
          cookie consent banner (§ 4 above). Act No. 480/2004 Coll. (Information Society Services Act)
          applies to unsolicited commercial communications and is not relevant to OmniParse&apos;s cookie
          practices, as OmniParse does not engage in direct marketing.
        </p>
      </section>

      <section>
        <h2>7. Contact</h2>
        <p>For questions about this Cookie Policy: <strong>damr58h@gmail.com</strong></p>
      </section>

      <p className="text-xs mt-8">
        Complies with EU ePrivacy Directive 2002/58/EC (as amended by Directive 2009/136/EC), GDPR Art. 6(1)(a) and Art. 7, Czech Act No. 127/2005 Coll. § 89 (Electronic Communications — ePrivacy implementation), and EDPB Guidelines 03/2022 on dark patterns in social media platform interfaces.
      </p>
    </LegalLayout>
  );
}
