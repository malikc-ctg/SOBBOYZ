'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ExternalLink, TrendingUp, DollarSign, Briefcase } from 'lucide-react';
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';

interface PartnerJob {
  id: string; job_number: string; scheduled_date: string;
  address_line1: string; city: string; service_type: string;
  status: string; final_price: number | null; quoted_price: number;
  billing_notes?: string;
}

interface Financials {
  base_price: number;
  posting_fee: number;
  total_charged: number;
  commission_earned: number;
}

function parseFinancials(job: PartnerJob): Financials | null {
  if (!job.billing_notes) return null;
  try { return JSON.parse(job.billing_notes); } catch { return null; }
}

const STATUS_COLORS: Record<string, string> = {
  confirmed: 'bg-blue-100 text-blue-700',
  assigned: 'bg-indigo-100 text-indigo-700',
  on_the_way: 'bg-amber-100 text-amber-700',
  in_progress: 'bg-purple-100 text-purple-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

export default function PartnerJobsPage() {
  const [jobs, setJobs] = useState<PartnerJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    fetch('/api/partners/me/jobs')
      .then(r => r.json())
      .then(d => { setJobs(Array.isArray(d) ? d : []); setLoading(false); });
  }, []);

  const filtered = statusFilter ? jobs.filter(j => j.status === statusFilter) : jobs;

  // Aggregate stats
  const totalPosted = filtered.length;
  const totalFeesPaid = filtered.reduce((sum, j) => {
    const f = parseFinancials(j);
    return sum + (f?.posting_fee ?? 0);
  }, 0);
  const totalCommissionEarned = filtered.filter(j => ['completed', 'reviewed', 'paid_out'].includes(j.status)).reduce((sum, j) => {
    const f = parseFinancials(j);
    return sum + (f?.commission_earned ?? 0);
  }, 0);

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl md:text-2xl font-bold text-foreground">Jobs</h1>
        <Link href="/partner/book" className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors shrink-0">
          + Book New Job
        </Link>
      </div>

      {/* Financial Summary */}
      {!loading && filtered.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Briefcase className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Jobs Posted</p>
            </div>
            <p className="text-2xl font-bold text-foreground">{totalPosted}</p>
          </div>
          <div className="bg-card border border-amber-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="h-4 w-4 text-amber-500" />
              <p className="text-xs text-muted-foreground">Posting Fees Paid</p>
            </div>
            <p className="text-2xl font-bold text-amber-600">${totalFeesPaid.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">5% per job</p>
          </div>
          <div className="bg-card border border-green-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-green-500" />
              <p className="text-xs text-muted-foreground">Commission Earned</p>
            </div>
            <p className="text-2xl font-bold text-green-600">${totalCommissionEarned.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">25% on completed jobs</p>
          </div>
        </div>
      )}

      {/* Filter chips */}
      <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1 -mx-1 px-1">
        {['', 'confirmed', 'in_progress', 'completed', 'cancelled'].map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors capitalize shrink-0 whitespace-nowrap ${
              statusFilter === s ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground hover:bg-accent'
            }`}
          >
            {s === '' ? 'All' : s.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      {/* Mobile Stacked Job Cards */}
      <div className="md:hidden space-y-2.5">
        {loading ? (
          [1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-4 space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-4 w-24" />
            </div>
          ))
        ) : filtered.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-8 text-center space-y-3">
            <Briefcase className="h-10 w-10 text-muted-foreground/30 mx-auto" />
            <p className="text-muted-foreground text-sm">No jobs found.</p>
            <Link href="/partner/book" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
              Book your first job →
            </Link>
          </div>
        ) : (
          filtered.map(job => {
            const financials = parseFinancials(job);
            const basePrice = financials?.base_price ?? (job.final_price ?? job.quoted_price);
            const postingFee = financials?.posting_fee ?? 0;
            const commissionEarned = financials?.commission_earned ?? 0;
            const isCompleted = ['completed', 'reviewed', 'paid_out'].includes(job.status);
            return (
              <div key={job.id} className="bg-card border border-border rounded-xl p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{job.address_line1}</p>
                    <p className="text-xs text-muted-foreground">
                      {job.city} · {format(new Date(job.scheduled_date + 'T12:00:00'), 'MMM d, yyyy')}
                    </p>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize shrink-0 ${STATUS_COLORS[job.status] ?? 'bg-muted text-muted-foreground'}`}>
                    {job.status.replace(/_/g, ' ')}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/60 text-xs">
                  <div>
                    <p className="text-muted-foreground">Base</p>
                    <p className="font-semibold">${basePrice.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Fee (5%)</p>
                    <p className="font-medium text-amber-600">{postingFee > 0 ? `+$${postingFee.toFixed(2)}` : '—'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-muted-foreground">Commission</p>
                    {commissionEarned > 0 ? (
                      <p className={`font-bold ${isCompleted ? 'text-green-600' : 'text-muted-foreground'}`}>
                        {isCompleted ? '+' : '~'}${commissionEarned.toFixed(2)}
                      </p>
                    ) : (
                      <p>—</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between pt-1 text-xs">
                  <span className="text-muted-foreground capitalize">{job.service_type.replace(/_/g, ' ')}</span>
                  <Link href={`/tracking/${job.id}`} className="text-primary font-medium flex items-center gap-1 hover:underline">
                    Track Job <ExternalLink className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Desktop Jobs Table */}
      <div className="hidden md:block bg-card border border-border rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center justify-between gap-4">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-5 w-20 rounded-full" />
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <Briefcase className="h-10 w-10 text-muted-foreground/30 mx-auto" />
            <p className="text-muted-foreground text-sm">No jobs found.</p>
            <Link href="/partner/book" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
              Book your first job →
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[680px]">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">Date</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Address</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Service</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Status</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Base Price</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Fee (5%)</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Commission (25%)</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map(job => {
                const financials = parseFinancials(job);
                const basePrice = financials?.base_price ?? (job.final_price ?? job.quoted_price);
                const postingFee = financials?.posting_fee ?? 0;
                const commissionEarned = financials?.commission_earned ?? 0;
                const isCompleted = ['completed', 'reviewed', 'paid_out'].includes(job.status);
                return (
                  <tr key={job.id} className="border-b border-border/50 hover:bg-muted/20">
                    <td className="px-5 py-3.5 text-muted-foreground text-xs whitespace-nowrap">
                      {format(new Date(job.scheduled_date + 'T12:00:00'), 'MMM d, yyyy')}
                    </td>
                    <td className="px-4 py-3.5">
                      <p className="font-medium text-foreground">{job.address_line1}</p>
                      <p className="text-xs text-muted-foreground">{job.city}</p>
                    </td>
                    <td className="px-4 py-3.5 text-muted-foreground capitalize text-xs">
                      {job.service_type.replace(/_/g, ' ')}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_COLORS[job.status] ?? 'bg-muted text-muted-foreground'}`}>
                        {job.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right font-medium">
                      ${basePrice.toFixed(2)}
                    </td>
                    <td className="px-4 py-3.5 text-right text-amber-600 font-medium">
                      {postingFee > 0 ? `+$${postingFee.toFixed(2)}` : '—'}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      {commissionEarned > 0 ? (
                        <span className={`font-bold ${isCompleted ? 'text-green-600' : 'text-muted-foreground'}`}>
                          {isCompleted ? '+' : '~'}${commissionEarned.toFixed(2)}
                          {!isCompleted && <span className="text-[10px] ml-0.5 font-normal">(pending)</span>}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3.5">
                      <Link href={`/tracking/${job.id}`} className="text-primary text-xs flex items-center gap-0.5 hover:underline whitespace-nowrap">
                        Track <ExternalLink className="h-3 w-3" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
