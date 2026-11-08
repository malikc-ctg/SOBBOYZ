import Link from 'next/link';

export const metadata = {
  title: 'Privacy Policy — Sea of Blue',
  description: 'Sea of Blue residential cleaning operations platform Privacy Policy.',
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen text-white flex flex-col font-sans relative overflow-x-hidden" style={{ backgroundColor: '#010A14' }}>
      {/* Deep blue atmospheric background blur */}
      <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-[#021A35]/30 rounded-full blur-[120px] pointer-events-none" />

      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-white/5 bg-[#010A14]/80 backdrop-blur-md">
        <div className="container flex h-16 items-center justify-between max-w-5xl mx-auto px-6">
          <Link href="/" className="flex items-center justify-start hover:opacity-80 transition-opacity">
            <img
              src="/nav-logo.png?v=2"
              alt="Sea of Blue"
              className="h-4 w-auto object-contain"
            />
          </Link>
          <Link
            href="/"
            className="text-xs uppercase tracking-widest text-white/50 hover:text-white transition-colors"
          >
            Back to Home
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 py-20 relative z-10">
        <div className="container max-w-3xl mx-auto px-6">
          {/* Page Title */}
          <div className="mb-12 border-b border-white/10 pb-8">
            <h1 className="font-rustic text-white text-4xl md:text-5xl tracking-wide mb-3">
              Privacy Policy
            </h1>
            <p className="text-white/40 text-sm">Last Updated: June 6, 2026</p>
          </div>

          {/* Legal Copy */}
          <div className="space-y-8 text-white/70 leading-relaxed text-sm md:text-base">
            <section className="space-y-4">
              <h2 className="text-white text-xl font-bold tracking-tight">1. Introduction</h2>
              <p>
                Welcome to Sea of Blue (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;). We are committed to protecting your privacy and ensuring a secure experience when you visit our website at <code className="text-white bg-white/5 px-1.5 py-0.5 rounded">seaofblue.app</code> and use our residential cleaning dispatch and operations platform (the &quot;Service&quot;).
              </p>
              <p>
                This Privacy Policy explains how we collect, use, process, disclose, and safeguard your personal information. By accessing or using our Service, you agree to the collection and use of information in accordance with this policy.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-white text-xl font-bold tracking-tight">2. Information We Collect</h2>
              <p>We collect several types of information from and about users of our Service, including:</p>
              <ul className="list-disc list-inside pl-4 space-y-2">
                <li>
                  <strong className="text-white/95">Personal Identification Information:</strong> Name, email address, phone number, physical address, and payment billing details (processed securely via third-party processors).
                </li>
                <li>
                  <strong className="text-white/95">Employee-Specific Information:</strong> Business registration numbers, commercial general liability insurance details, background check verification data, and profile information.
                </li>
                <li>
                  <strong className="text-white/95">Location Data:</strong> For employees on our network, we collect precise or approximate location data to enable job dispatching, route optimization, and real-time transit notifications for customers.
                </li>
                <li>
                  <strong className="text-white/95">Usage and Device Data:</strong> IP addresses, browser type, operating system, page viewing history, and device identifiers collected automatically through cookies or diagnostic tools.
                </li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="text-white text-xl font-bold tracking-tight">3. How We Use Your Information</h2>
              <p>We process your information to provide, run, and improve our services, including:</p>
              <ul className="list-disc list-inside pl-4 space-y-2">
                <li>Managing accounts, dispatching cleaning requests, and facilitating direct communications between customers and assigned employees.</li>
                <li>Processing payments from customers and facilitating employee payouts.</li>
                <li>Ensuring network security, validating business registration, and verifying commercial general liability coverage for quality assurance.</li>
                <li>Sending operational updates, marketing invitations (for private beta participants), and support communications.</li>
                <li>Complying with legal obligations, regulatory audits, and resolving billing disputes.</li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="text-white text-xl font-bold tracking-tight">4. Sharing Your Information</h2>
              <p>We do not sell your personal data. We share your information only under the following circumstances:</p>
              <ul className="list-disc list-inside pl-4 space-y-2">
                <li>
                  <strong className="text-white/95">With assigned providers:</strong> Sharing customer name and service address with the employee dispatched to perform the cleaning job.
                </li>
                <li>
                  <strong className="text-white/95">Third-Party Service Providers:</strong> Sharing data with secure operational partners, such as payment gateways (Stripe), email routing hosts (Resend), and notification servers.
                </li>
                <li>
                  <strong className="text-white/95">Legal Requirements:</strong> Disclosing information if required to do so by Ontario laws, or in response to valid subpoenas, court orders, or public authority requests.
                </li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="text-white text-xl font-bold tracking-tight">5. Data Retention and Security</h2>
              <p>
                We retain your information for as long as your account is active, or as needed to provide you the Service. We employ administrative, technical, and physical security measures designed to protect your personal data from unauthorized access, loss, alteration, or disclosure.
              </p>
              <p>
                However, please note that no method of transmission over the Internet or method of electronic storage is 100% secure, and we cannot guarantee absolute data security.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-white text-xl font-bold tracking-tight">6. Your Privacy Rights</h2>
              <p>
                Depending on your location, you may have rights regarding your personal information, including the right to request access, correction, transfer, or deletion of the data we hold about you. To exercise these rights, please contact our support team.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-white text-xl font-bold tracking-tight">7. Changes to This Privacy Policy</h2>
              <p>
                We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the &quot;Last Updated&quot; date at the top of this policy.
              </p>
            </section>

            <section className="space-y-4 border-t border-white/10 pt-8">
              <h2 className="text-white text-xl font-bold tracking-tight">8. Contact Us</h2>
              <p>If you have any questions or concerns regarding this Privacy Policy, please reach out to us:</p>
              <p className="text-white/95">
                Email: <a href="mailto:info@seaofblue.app" className="underline hover:text-white transition-colors">info@seaofblue.app</a>
              </p>
            </section>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 py-8 bg-[#010A14] text-xs text-white/30 text-center relative z-10">
        <div className="container max-w-5xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <p>&copy; {new Date().getFullYear()} Sea of Blue. All rights reserved.</p>
          <div className="flex gap-6">
            <Link href="/privacy" className="hover:text-white/60 transition-colors">
              Privacy Policy
            </Link>
            <Link href="/terms" className="hover:text-white/60 transition-colors">
              Terms of Service
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
