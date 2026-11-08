import Link from 'next/link';

export const metadata = {
  title: 'Terms of Service — Sea of Blue',
  description: 'Sea of Blue residential cleaning operations platform Terms of Service.',
};

export default function TermsOfServicePage() {
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
              Terms of Service
            </h1>
            <p className="text-white/40 text-sm">Last Updated: June 6, 2026</p>
          </div>

          {/* Legal Copy */}
          <div className="space-y-8 text-white/70 leading-relaxed text-sm md:text-base">
            <section className="space-y-4">
              <h2 className="text-white text-xl font-bold tracking-tight">1. Acceptance of Terms</h2>
              <p>
                By accessing, browsing, or using the website <code className="text-white bg-white/5 px-1.5 py-0.5 rounded">seaofblue.app</code> and our residential cleaning dispatch and operations platform (the &quot;Platform&quot; or &quot;Services&quot;), you agree to be bound by these Terms of Service (the &quot;Terms&quot;) and all applicable laws and regulations in the province of Ontario, Canada.
              </p>
              <p>
                If you do not agree to these Terms, please do not use the Platform. We reserve the right to amend, suspend, or terminate these Terms or your access to the Services at any time.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-white text-xl font-bold tracking-tight">2. Service Scope and Platforms</h2>
              <p>
                Sea of Blue operates a selective dispatch network connecting residential consumers (&quot;Customers&quot;) with independent professional cleaning companies, teams, and employees (&quot;Providers&quot;).
              </p>
              <p>
                Sea of Blue acts as a technology platform facilitating matching, scheduling, dispatch tracking, invoicing, and support. We are not a direct employer of the Providers. All Providers operate as independent businesses and remain solely responsible for the quality, safety, and performance of their cleaning services.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-white text-xl font-bold tracking-tight">3. Account Eligibility and Verification</h2>
              <p>To use our Platform as a Customer or Provider, you must:</p>
              <ul className="list-disc list-inside pl-4 space-y-2">
                <li>Be at least 18 years of age and legally capable of entering binding agreements.</li>
                <li>Provide accurate, truthful, and up-to-date information during registration and booking.</li>
                <li>For Providers: Complete the selective beta application, maintain commercial general liability insurance, verify business registration status, and consent to background checks and verification protocols. Submitting an application does not guarantee approval.</li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="text-white text-xl font-bold tracking-tight">4. Booking, Dynamic Pricing, and Billing</h2>
              <ul className="list-disc list-inside pl-4 space-y-2">
                <li>
                  <strong className="text-white/95">Pricing &amp; Quotes:</strong> Quotes are generated dynamically based on home size, cleaning frequency, and demand metrics. All rates are subject to change prior to booking confirmation.
                </li>
                <li>
                  <strong className="text-white/95">Payments:</strong> Customers authorize third-party payment gateways (Stripe) to charge their selected payment methods upon booking confirmation or job completion.
                </li>
                <li>
                  <strong className="text-white/95">Provider Payouts:</strong> Approved Providers receive payouts net of system processing fees, in accordance with the payout schedules. Providers are responsible for all provincial (HST) and federal tax filings.
                </li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="text-white text-xl font-bold tracking-tight">5. Cancellations and Dispute Resolution</h2>
              <p>
                Cancellations are subject to the policies detailed in our service guidelines. Cleaning jobs canceled close to scheduled times may incur cancellation fees.
              </p>
              <p>
                In the event of a customer dispute regarding service quality, damaged property, or billing issues, users agree to utilize the Sea of Blue Dispute Engine to resolve claims. We work in good faith to arbitrate issues between Customers and independent Providers.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-white text-xl font-bold tracking-tight">6. Limitation of Liability and Indemnity</h2>
              <p>
                To the maximum extent permitted by applicable law in Ontario, Sea of Blue shall not be liable for any indirect, incidental, punitive, special, or consequential damages resulting from the use of, or inability to use, our Platform or independent Provider services.
              </p>
              <p>
                You agree to defend, indemnify, and hold harmless Sea of Blue, its officers, employees, and directors from any claims, damages, liabilities, or losses arising out of your breach of these Terms, misuse of the platform, or violations of third-party rights.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-white text-xl font-bold tracking-tight">7. Governing Law</h2>
              <p>
                These Terms of Service and any dispute arising out of or related to your use of the Platform shall be governed by and construed in accordance with the laws of the Province of Ontario and the federal laws of Canada applicable therein, without regard to choice of law principles.
              </p>
            </section>

            <section className="space-y-4 border-t border-white/10 pt-8">
              <h2 className="text-white text-xl font-bold tracking-tight">8. Contact Us</h2>
              <p>If you have any questions about these Terms of Service, please contact our legal counsel:</p>
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
