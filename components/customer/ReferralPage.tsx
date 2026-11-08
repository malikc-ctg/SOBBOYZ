'use client';

import { useEffect, useState } from 'react';
import { Copy, CheckCircle, Share2, Gift } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import type { CustomerReferral } from '@/types';
import { format } from 'date-fns';

interface ReferralPageProps {
  customerId: string;
}

export default function ReferralPage({ customerId }: ReferralPageProps) {
  const [code, setCode] = useState('');
  const [creditBalance, setCreditBalance] = useState(0);
  const [referrals, setReferrals] = useState<CustomerReferral[]>([]);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`/api/referrals?customer_id=${customerId}`).then(r => r.json()),
      fetch(`/api/referrals?customer_id=${customerId}&action=history`).then(r => r.json()),
    ]).then(([data, history]) => {
      setCode(data.code ?? '');
      setCreditBalance(data.credit_balance ?? 0);
      setReferrals(history ?? []);
      setLoading(false);
    });
  }, [customerId]);

  function copyCode() {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function shareCode() {
    if (navigator.share) {
      navigator.share({
        title: 'Sea of Blue — Get $20 off your first clean',
        text: `Use my code ${code} to get $20 off your first Sea of Blue home cleaning! 🧹`,
        url: `${window.location.origin}/booking?ref=${code}`,
      });
    } else {
      copyCode();
    }
  }

  if (loading) {
    return (
      <div className="p-6 max-w-md mx-auto space-y-5">
        <div className="space-y-2">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-full" />
        </div>
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-36 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-md mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold text-foreground">Give $20, Get $30</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Share your code. Your friend gets $20 off their first clean.
          You get $30 credit after their first clean is complete.
        </p>
      </div>

      {/* Credit balance */}
      {creditBalance > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <p className="text-xs text-green-600 mb-0.5">Your credit balance</p>
          <p className="text-3xl font-bold text-green-800">${creditBalance.toFixed(2)}</p>
          <p className="text-xs text-green-500 mt-0.5">Applied automatically to your next booking</p>
        </div>
      )}

      {/* Referral code */}
      <div className="bg-card border border-border rounded-xl p-5">
        <p className="text-xs text-muted-foreground mb-2">Your referral code</p>
        <p className="text-3xl font-mono font-bold tracking-widest text-foreground mb-4">{code}</p>
        <div className="flex gap-2">
          <button
            onClick={copyCode}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              copied ? 'bg-green-600 text-white' : 'bg-muted text-foreground hover:bg-accent'
            }`}
          >
            {copied ? <CheckCircle className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? 'Copied!' : 'Copy code'}
          </button>
          <button
            onClick={shareCode}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Share2 className="h-4 w-4" />
            Share
          </button>
        </div>
      </div>

      {/* How it works */}
      <div className="space-y-2">
        {[
          { step: '1', text: 'Share your code with a friend' },
          { step: '2', text: 'They get $20 off their first clean' },
          { step: '3', text: 'You get $30 credit when their first clean is complete' },
        ].map((item) => (
          <div key={item.step} className="flex items-center gap-3 text-sm">
            <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0">
              {item.step}
            </span>
            <span className="text-muted-foreground">{item.text}</span>
          </div>
        ))}
      </div>

      {/* Referral history */}
      {referrals.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-foreground mb-3">Referral History</h2>
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            {referrals.map((ref) => (
              <div key={ref.id} className="flex items-center justify-between px-4 py-3 border-b border-border/50 last:border-0">
                <div className="flex items-center gap-2">
                  <Gift className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{(ref.referred_customer as { full_name?: string } | undefined)?.full_name ?? 'Friend'}</p>
                    <p className="text-xs text-muted-foreground">{format(new Date(ref.created_at), 'MMM d, yyyy')}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    ref.status === 'credit_applied' ? 'bg-green-100 text-green-700'
                    : ref.status === 'qualified' ? 'bg-blue-100 text-blue-700'
                    : 'bg-muted text-muted-foreground'
                  }`}>
                    {ref.status === 'credit_applied' ? `+$${ref.referrer_credit}`
                    : ref.status === 'qualified' ? 'Booked'
                    : 'Pending'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
