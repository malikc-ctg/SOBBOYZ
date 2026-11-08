'use client';

import { useEffect, useState } from 'react';
import { Copy, CheckCircle, Share2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export default function PartnerAccountPage() {
  const [partner, setPartner] = useState<{
    company_name: string; billing_email: string;
    referral_code: string | null; credit_balance: number;
    invoice_billing: boolean; partner_type: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch('/api/partners/me').then(r => r.json()).then(setPartner);
  }, []);

  function copyCode() {
    if (partner?.referral_code) {
      navigator.clipboard.writeText(partner.referral_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto space-y-6">
      <h1 className="text-xl md:text-2xl font-bold text-foreground">Account</h1>

      {!partner ? (
        <div className="space-y-4">
          <Skeleton className="h-36 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
      ) : (
        <>
          <div className="bg-card border border-border rounded-xl p-4 sm:p-5 space-y-3">
            <h2 className="text-sm font-semibold">Account Details</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Company</p>
                <p className="font-medium">{partner.company_name}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Partner Type</p>
                <p className="font-medium capitalize">{partner.partner_type.replace('_', ' ')}</p>
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground mb-0.5">Billing Email</p>
                <p className="font-medium break-all">{partner.billing_email}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Billing Mode</p>
                <p className="font-medium">{partner.invoice_billing ? 'Monthly Invoice' : 'Per-Job Deposit'}</p>
              </div>
            </div>
          </div>

          {/* Credit balance */}
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 sm:p-5">
            <p className="text-xs text-green-600 mb-1">Credit Balance</p>
            <p className="text-3xl font-bold text-green-800">${partner.credit_balance.toFixed(2)}</p>
            <p className="text-xs text-green-600 mt-1">Applied automatically to your next booking</p>
          </div>

          {/* Referral code */}
          {partner.referral_code && (
            <div className="bg-card border border-border rounded-xl p-4 sm:p-5">
              <div className="flex items-center gap-2 mb-3">
                <Share2 className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold">Your Referral Code</h2>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                Refer another partner and earn credit when they complete their first job.
              </p>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <div className="flex-1 bg-muted rounded-lg px-4 py-3">
                  <p className="text-lg sm:text-xl font-mono font-bold tracking-widest text-foreground">{partner.referral_code}</p>
                </div>
                <button
                  onClick={copyCode}
                  className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                    copied ? 'bg-green-600 text-white' : 'bg-primary text-primary-foreground hover:bg-primary/90'
                  }`}
                >
                  {copied ? <CheckCircle className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
