'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { ArrowLeft, Send, CheckCircle, DollarSign, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import type { Dispute, DisputeMessage } from '@/types';
import { format } from 'date-fns';

const CATEGORY_LABELS: Record<string, string> = {
  missed_items: 'Missed Items', damage: 'Damage',
  no_show: 'No Show', billing: 'Billing', other: 'Other',
};

function MessageThread({ messages, role }: { messages: DisputeMessage[]; role: 'customer' | 'employee' }) {
  const [msg, setMsg] = useState('');

  const filtered = messages.filter((m) =>
    role === 'customer'
      ? ['customer', 'admin'].includes(m.sender_role)
      : ['employee', 'admin'].includes(m.sender_role)
  );

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-5 py-3 border-b border-border bg-muted/30">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {role === 'customer' ? 'Customer Thread' : 'Employee Thread'}
        </h3>
      </div>
      <div className="p-4 space-y-3 min-h-[140px] max-h-60 overflow-y-auto">
        {filtered.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4">No messages yet</p>
        )}
        {filtered.map((m) => (
          <div key={m.id} className={`flex ${m.sender_role === 'admin' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${
              m.sender_role === 'admin'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-foreground'
            }`}>
              <p className="text-[10px] opacity-70 mb-0.5">{m.sender_role}</p>
              {m.message}
              <p className="text-[10px] opacity-50 mt-0.5 text-right">{format(new Date(m.sent_at), 'h:mm a')}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="px-4 py-3 border-t border-border flex gap-2">
        <input
          className="flex-1 text-sm bg-muted rounded-lg px-3 py-2 border-0 outline-none"
          placeholder={`Message ${role}…`}
          value={msg}
          onChange={(e) => setMsg(e.target.value)}
        />
        <button
          disabled={!msg.trim()}
          className="p-2 bg-primary text-primary-foreground rounded-lg disabled:opacity-50 hover:bg-primary/90 transition-colors"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export default function DisputeDetailPage() {
  const params = useParams();
  const [dispute, setDispute] = useState<Dispute | null>(null);
  const [messages, setMessages] = useState<DisputeMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState(false);
  const [resolution, setResolution] = useState({
    notes: '', refund_amount: '', employee_penalty: '',
    new_status: 'resolved_customer' as string,
  });

  useEffect(() => {
    fetch(`/api/disputes/${params.id}`)
      .then(r => r.json())
      .then(({ dispute: d, messages: m }) => {
        setDispute(d); setMessages(m ?? []); setLoading(false);
      });
  }, [params.id]);

  async function handleResolve(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch(`/api/disputes/${params.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        resolved_by: 'admin',
        resolution_notes: resolution.notes,
        refund_amount: resolution.refund_amount ? parseFloat(resolution.refund_amount) : undefined,
        employee_penalty: resolution.employee_penalty ? parseFloat(resolution.employee_penalty) : undefined,
        new_status: resolution.new_status,
      }),
    });
    if (res.ok) {
      setDispute((d) => d ? { ...d, status: resolution.new_status as Dispute['status'] } : null);
      setResolving(false);
    }
  }

  if (loading) return <div className="p-8 text-muted-foreground text-sm">Loading dispute…</div>;
  if (!dispute) return <div className="p-8 text-muted-foreground text-sm">Dispute not found.</div>;

  const job = dispute.job as unknown as Record<string, unknown> | null;
  const customer = dispute.customer as unknown as Record<string, unknown> | null;
  const employee = dispute.employee as unknown as Record<string, unknown> | null;
  const isResolved = ['resolved_customer', 'resolved_company', 'escalated'].includes(dispute.status);

  return (
    <div className="p-3 sm:p-6 lg:p-8 space-y-6 max-w-5xl mx-auto min-w-0">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/sobadmin/disputes" className="p-2 hover:bg-muted rounded-lg transition-colors">
          <ArrowLeft className="h-4 w-4 text-muted-foreground" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg sm:text-xl font-bold text-foreground truncate">Dispute — {CATEGORY_LABELS[dispute.category]}</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Opened {format(new Date(dispute.created_at), 'MMMM d, yyyy')}</p>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-medium capitalize shrink-0 ${
          dispute.status === 'open' ? 'bg-red-100 text-red-700'
          : dispute.status === 'under_review' ? 'bg-amber-100 text-amber-700'
          : 'bg-green-100 text-green-700'
        }`}>
          {dispute.status.replace(/_/g, ' ')}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Customer & Job info */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-card border border-border rounded-xl p-4 sm:p-5">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Complaint</h2>
            <p className="text-sm text-foreground mb-4">{dispute.description}</p>
            {dispute.evidence_urls && dispute.evidence_urls.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                {dispute.evidence_urls.map((url, i) => (
                  <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline">
                    Evidence {i + 1}
                  </a>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Customer */}
            <div className="bg-card border border-border rounded-xl p-5">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Customer</h2>
              <p className="font-medium text-sm">{String(customer?.full_name ?? '—')}</p>
              <p className="text-xs text-muted-foreground">{String(customer?.email ?? '')}</p>
              <p className="text-xs text-muted-foreground mt-2">Score: <span className="font-medium">{String(customer?.customer_score ?? '—')}</span></p>
            </div>
            {/* Job */}
            <div className="bg-card border border-border rounded-xl p-5">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Job</h2>
              <p className="font-medium text-sm">{String(job?.job_number ?? '—')}</p>
              <p className="text-xs text-muted-foreground capitalize">{String(job?.service_type ?? '').replace(/_/g, ' ')}</p>
              <p className="text-xs text-muted-foreground">Final: ${Number(job?.final_price ?? 0).toFixed(2)}</p>
              {employee && <p className="text-xs text-muted-foreground mt-1">Employee: {String(employee.full_name ?? '—')}</p>}
            </div>
          </div>

          {/* Message threads — separate, never cross-visible */}
          <MessageThread messages={messages} role="customer" />
          {employee && <MessageThread messages={messages} role="employee" />}
        </div>

        {/* Resolution panel */}
        <div className="space-y-4">
          {isResolved ? (
            <div className="bg-green-50 border border-green-200 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <h2 className="text-sm font-semibold text-green-800">Resolved</h2>
              </div>
              <p className="text-xs text-green-700">{dispute.resolution_notes}</p>
              {dispute.refund_amount && (
                <p className="text-xs text-green-700 mt-2">Refund issued: ${dispute.refund_amount.toFixed(2)}</p>
              )}
              {dispute.employee_penalty && (
                <p className="text-xs text-amber-700 mt-1">Employee penalty: ${dispute.employee_penalty.toFixed(2)}</p>
              )}
            </div>
          ) : (
            <div className="bg-card border border-border rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <h2 className="text-sm font-semibold">Resolve Dispute</h2>
              </div>
              {!resolving ? (
                <button
                  onClick={() => setResolving(true)}
                  className="w-full py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
                >
                  Start Resolution
                </button>
              ) : (
                <form onSubmit={handleResolve} className="space-y-3">
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">Resolution</label>
                    <select className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" value={resolution.new_status} onChange={e => setResolution(r => ({ ...r, new_status: e.target.value }))}>
                      <option value="resolved_customer">Resolved — Customer (issue found)</option>
                      <option value="resolved_company">Resolved — Company (no issue)</option>
                      <option value="escalated">Escalate to Founder</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">Internal Notes *</label>
                    <textarea required rows={3} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background resize-none" value={resolution.notes} onChange={e => setResolution(r => ({ ...r, notes: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1 flex items-center gap-1"><DollarSign className="h-3 w-3" />Refund Amount</label>
                    <input type="number" step="0.01" min="0" className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" placeholder="0.00" value={resolution.refund_amount} onChange={e => setResolution(r => ({ ...r, refund_amount: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">Employee Penalty</label>
                    <input type="number" step="0.01" min="0" className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" placeholder="0.00" value={resolution.employee_penalty} onChange={e => setResolution(r => ({ ...r, employee_penalty: e.target.value }))} />
                    <p className="text-[10px] text-muted-foreground mt-0.5">Deducted from next payout. Score adjusted proportionally.</p>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setResolving(false)} className="flex-1 py-2 border border-border rounded-lg text-sm hover:bg-muted transition-colors">Cancel</button>
                    <button type="submit" className="flex-1 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">Confirm</button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
