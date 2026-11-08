'use client';

import { useEffect, useState } from 'react';
import { Download, TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import type { PartnerInvoice } from '@/types';
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  sent: 'bg-blue-100 text-blue-700',
  paid: 'bg-green-100 text-green-700',
  overdue: 'bg-red-100 text-red-700',
};

interface InvoiceWithMeta extends PartnerInvoice {
  total_posting_fees?: number;
  total_commission_earned?: number;
  net_earnings?: number;
}

export default function PartnerInvoicesPage() {
  const [invoices, setInvoices] = useState<InvoiceWithMeta[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/partners/invoices?partner_id=me')
      .then(r => r.json())
      .then(d => { setInvoices(Array.isArray(d) ? d : []); setLoading(false); });
  }, []);

  const [qboStatuses, setQboStatuses] = useState<Record<string, any>>({});

  useEffect(() => {
    const qboIds = invoices.filter(i => (i as any).qbo_invoice_id).map(i => (i as any).qbo_invoice_id);
    if (qboIds.length === 0) return;
    fetch(`/api/integrations/quickbooks/invoices?ids=${qboIds.join(',')}`)
      .then(r => r.json())
      .then(data => {
        if (data.invoices) {
          const map: Record<string, any> = {};
          data.invoices.forEach((inv: any) => { map[inv.Id] = inv; });
          setQboStatuses(map);
        }
      })
      .catch(() => {});
  }, [invoices]);

  // Aggregate totals
  const totalFeesPaid = invoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + (i.total_posting_fees ?? 0), 0);
  const totalCommissions = invoices.reduce((sum, i) => sum + (i.total_commission_earned ?? 0), 0);
  const totalDue = invoices.filter(i => ['sent', 'overdue'].includes(i.status)).reduce((sum, i) => sum + i.total_due, 0);

  return (
    <div className="p-4 md:p-8 space-y-6">
      <h1 className="text-xl md:text-2xl font-bold text-foreground">Invoices & Earnings</h1>

      {/* Summary cards */}
      {!loading && invoices.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          <div className="bg-card border border-amber-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingDown className="h-4 w-4 text-amber-500" />
              <p className="text-xs text-muted-foreground">Posting Fees Paid</p>
            </div>
            <p className="text-2xl font-bold text-amber-600">${totalFeesPaid.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground mt-1">5% per job posted</p>
          </div>
          <div className="bg-card border border-green-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-green-500" />
              <p className="text-xs text-muted-foreground">Commission Earned</p>
            </div>
            <p className="text-2xl font-bold text-green-600">${totalCommissions.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground mt-1">25% on completed jobs</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Outstanding Balance</p>
            </div>
            <p className={`text-2xl font-bold ${totalDue > 0 ? 'text-red-600' : 'text-foreground'}`}>${totalDue.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground mt-1">Across open invoices</p>
          </div>
        </div>
      )}

      {/* Mobile Invoice Cards */}
      <div className="md:hidden space-y-2.5">
        {loading ? (
          [1, 2, 3].map((i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-4 space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-44" />
              <Skeleton className="h-4 w-24" />
            </div>
          ))
        ) : invoices.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-8 text-center space-y-2">
            <DollarSign className="h-10 w-10 text-muted-foreground/30 mx-auto" />
            <p className="text-muted-foreground text-sm">No invoices yet.</p>
            <p className="text-xs text-muted-foreground">Invoices are generated monthly after your first job.</p>
          </div>
        ) : (
          invoices.map(inv => (
            <div key={inv.id} className="bg-card border border-border rounded-xl p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-mono text-sm font-semibold">{inv.invoice_number}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(inv.period_start), 'MMM d')} – {format(new Date(inv.period_end), 'MMM d, yyyy')}
                  </p>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize shrink-0 ${STATUS_STYLES[inv.status]}`}>
                  {inv.status}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/60 text-xs">
                <div>
                  <p className="text-muted-foreground">Subtotal</p>
                  <p className="font-medium">${inv.subtotal.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Commission</p>
                  <p className="font-medium text-green-600">
                    {inv.total_commission_earned ? `-$${inv.total_commission_earned.toFixed(2)}` : '—'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-muted-foreground">Total Due</p>
                  <p className="font-bold">${inv.total_due.toFixed(2)}</p>
                </div>
              </div>
              <div className="flex items-center justify-between pt-1 text-xs">
                <span className="text-muted-foreground">
                  Due: {inv.due_date ? format(new Date(inv.due_date), 'MMM d, yyyy') : '—'}
                </span>
                <button className="text-primary font-medium flex items-center gap-1 hover:underline">
                  <Download className="h-3.5 w-3.5" /> PDF
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Desktop Invoices Table */}
      <div className="hidden md:block bg-card border border-border rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center justify-between gap-4">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
            ))}
          </div>
        ) : invoices.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <DollarSign className="h-10 w-10 text-muted-foreground/30 mx-auto" />
            <p className="text-muted-foreground text-sm">No invoices yet.</p>
            <p className="text-xs text-muted-foreground">Invoices are generated monthly after your first job.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[760px]">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">Invoice #</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Period</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Service Subtotal</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Posting Fees (5%)</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Commission (25%)</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Credits</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Total Due</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Status</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Payment Status</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Due Date</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {invoices.map(inv => (
                <tr key={inv.id} className="border-b border-border/50 hover:bg-muted/20">
                  <td className="px-5 py-3.5 font-mono text-xs">{inv.invoice_number}</td>
                  <td className="px-4 py-3.5 text-muted-foreground text-xs whitespace-nowrap">
                    {format(new Date(inv.period_start), 'MMM d')} – {format(new Date(inv.period_end), 'MMM d, yyyy')}
                  </td>
                  <td className="px-4 py-3.5 text-right">${inv.subtotal.toFixed(2)}</td>
                  <td className="px-4 py-3.5 text-right text-amber-600 font-medium">
                    {inv.total_posting_fees
                      ? `+$${inv.total_posting_fees.toFixed(2)}`
                      : <span className="text-muted-foreground">—</span>
                    }
                  </td>
                  <td className="px-4 py-3.5 text-right text-green-600 font-medium">
                    {inv.total_commission_earned
                      ? `-$${inv.total_commission_earned.toFixed(2)}`
                      : <span className="text-muted-foreground">—</span>
                    }
                  </td>
                  <td className="px-4 py-3.5 text-right text-green-600">
                    {inv.credits_applied > 0 ? `-$${inv.credits_applied.toFixed(2)}` : '—'}
                  </td>
                  <td className="px-4 py-3.5 text-right font-semibold">${inv.total_due.toFixed(2)}</td>
                  <td className="px-4 py-3.5">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_STYLES[inv.status]}`}>
                      {inv.status}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    {(() => {
                      const qboInvId = (inv as any).qbo_invoice_id;
                      const qboInv = qboInvId ? qboStatuses[qboInvId] : null;
                      if (!qboInvId) return <span className="text-xs text-muted-foreground">Not synced</span>;
                      if (!qboInv) return <Skeleton className="h-5 w-20 rounded-full" />;
                      const balance = Number(qboInv.Balance ?? 0);
                      const total = Number(qboInv.TotalAmt ?? 0);
                      if (balance === 0 && total > 0) return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">Paid ✓</span>;
                      if (balance < total) return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">Partial (${balance.toFixed(2)} remaining)</span>;
                      return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">Awaiting Payment</span>;
                    })()}
                  </td>
                  <td className="px-4 py-3.5 text-muted-foreground text-xs whitespace-nowrap">
                    {inv.due_date ? format(new Date(inv.due_date), 'MMM d, yyyy') : '—'}
                  </td>
                  <td className="px-4 py-3.5">
                    <button className="text-primary text-xs flex items-center gap-0.5 hover:underline whitespace-nowrap">
                      <Download className="h-3 w-3" /> PDF
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Info note */}
      <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl p-4 text-sm text-blue-700 dark:text-blue-300">
        <p className="font-semibold mb-1">How your billing works</p>
        <ul className="space-y-1 text-xs">
          <li>• <strong>Posting Fee (5%)</strong>: Charged when you submit a job. Covers dispatching a verified, insured cleaner to your property.</li>
          <li>• <strong>Commission (25%)</strong>: You earn 25% of the base job price back when the job is marked as completed.</li>
          <li>• <strong>Net Cost</strong>: After commission, your effective cost is just <strong>the service price minus 20%</strong> — a significant B2B discount.</li>
          <li>• Invoices are issued monthly and can be paid by credit card or bank transfer.</li>
        </ul>
      </div>
    </div>
  );
}
