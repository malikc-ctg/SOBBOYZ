'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PlusCircle, Briefcase, DollarSign, TrendingUp } from 'lucide-react';

interface PartnerDashData {
  partner: { company_name: string; credit_balance: number; referral_code: string };
  this_month: { jobs: number; spend: number; credit_earned: number };
  active_jobs: Array<{ id: string; job_number: string; address_line1: string; city: string; service_type: string; status: string; scheduled_date: string }>;
  recent_invoices: Array<{ id: string; invoice_number: string; total_due: number; status: string; period_start: string }>;
}

export default function PartnerDashboard() {
  const [data, setData] = useState<PartnerDashData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // In production, get partner_id from session
    fetch('/api/partners/me/dashboard').then(r => r.json()).then((d) => { setData(d); setLoading(false); });
  }, []);

  if (loading) {
    return <div className="p-8 min-h-[400px]" />;
  }

  // Fallback demo data
  const partner = data?.partner ?? { company_name: 'Partner Company', credit_balance: 0, referral_code: 'SOB-DEMO1' };
  const thisMonth = data?.this_month ?? { jobs: 0, spend: 0, credit_earned: 0 };
  const activeJobs = data?.active_jobs ?? [];
  const recentInvoices = data?.recent_invoices ?? [];

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{partner.company_name}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Welcome back</p>
      </div>

      {/* Credit balance highlight */}
      {partner.credit_balance > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
          <TrendingUp className="h-5 w-5 text-green-600" />
          <div>
            <p className="text-sm font-semibold text-green-800">${partner.credit_balance.toFixed(2)} credit available</p>
            <p className="text-xs text-green-600">Applied automatically to your next booking</p>
          </div>
        </div>
      )}

      {/* This month summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <Briefcase className="h-4 w-4 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">Jobs This Month</p>
          </div>
          <p className="text-2xl font-bold text-foreground">{thisMonth.jobs}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="h-4 w-4 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">Total Spend</p>
          </div>
          <p className="text-2xl font-bold text-foreground">${thisMonth.spend.toFixed(0)}</p>
        </div>
        <div className="bg-card border border-green-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-4 w-4 text-green-500" />
            <p className="text-xs text-muted-foreground">Commission Earned</p>
          </div>
          <p className="text-2xl font-bold text-green-600">${thisMonth.credit_earned.toFixed(0)}</p>
          <p className="text-xs text-muted-foreground mt-1">25% on completed jobs</p>
        </div>
      </div>

      {/* Quick book */}
      <Link
        href="/partner/book"
        className="flex items-center justify-center gap-2 w-full py-3 bg-primary text-primary-foreground rounded-xl font-medium hover:bg-primary/90 transition-colors"
      >
        <PlusCircle className="h-5 w-5" />
        Book a New Job
      </Link>

      {/* Active jobs */}
      {activeJobs.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-foreground mb-3">Active Jobs</h2>
          <div className="space-y-2">
            {activeJobs.map((job) => (
              <Link
                key={job.id}
                href={`/tracking/${job.id}`}
                className="flex items-center justify-between bg-card border border-border rounded-xl px-4 py-3 hover:bg-muted/30 transition-colors"
              >
                <div>
                  <p className="text-sm font-medium">{job.address_line1}, {job.city}</p>
                  <p className="text-xs text-muted-foreground capitalize">{job.service_type.replace(/_/g, ' ')} · {job.scheduled_date}</p>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${
                  job.status === 'in_progress' ? 'bg-blue-100 text-blue-700'
                  : job.status === 'confirmed' ? 'bg-green-100 text-green-700'
                  : 'bg-muted text-muted-foreground'
                }`}>
                  {job.status.replace(/_/g, ' ')}
                </span>
              </Link>
            ))}
          </div>
          <Link href="/partner/jobs" className="text-xs text-primary mt-2 inline-block hover:underline">
            View all jobs →
          </Link>
        </div>
      )}

      {/* Recent invoices */}
      {recentInvoices.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-foreground mb-3">Recent Invoices</h2>
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            {recentInvoices.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between px-4 py-3 border-b border-border/50 last:border-0">
                <div>
                  <p className="text-sm font-medium">{inv.invoice_number}</p>
                  <p className="text-xs text-muted-foreground">{inv.period_start}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">${inv.total_due.toFixed(2)}</p>
                  <span className={`text-xs font-medium ${
                    inv.status === 'paid' ? 'text-green-600'
                    : inv.status === 'overdue' ? 'text-red-600'
                    : 'text-amber-600'
                  }`}>
                    {inv.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <Link href="/partner/invoices" className="text-xs text-primary mt-2 inline-block hover:underline">
            View all invoices →
          </Link>
        </div>
      )}
    </div>
  );
}
