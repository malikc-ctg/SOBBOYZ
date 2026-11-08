'use client';

import { useState, useEffect } from 'react';
import { Plus, Send, AlertTriangle, CheckCircle2, Clock, RefreshCw, FileText, Search, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';

function formatCAD(val: number) {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(val);
}

export function InvoicingSuite() {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [remindingId, setRemindingId] = useState<string | null>(null);

  const [form, setForm] = useState({
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    address: '',
    city: 'Toronto',
    postalCode: '',
    dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    description: 'Residential Deep Cleaning Service',
    amount: '250.00',
    memo: 'Thank you for choosing Sea of Blue Cleaning Services!',
  });

  async function loadInvoices() {
    setLoading(true);
    try {
      const res = await fetch('/api/finance/invoices');
      if (!res.ok) throw new Error('Failed to load invoices');
      const data = await res.json();
      setInvoices(data.invoices || []);
    } catch (err: any) {
      toast.error(err.message || 'Error loading invoices');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadInvoices();
  }, []);

  async function handleCreateInvoice(e: React.FormEvent) {
    e.preventDefault();
    if (!form.customerName.trim() || !form.amount) {
      toast.error('Customer name and amount are required');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/finance/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: form.customerName,
          customerEmail: form.customerEmail,
          customerPhone: form.customerPhone,
          address: form.address,
          city: form.city,
          postalCode: form.postalCode,
          dueDate: form.dueDate,
          memo: form.memo,
          items: [
            {
              description: form.description,
              amount: parseFloat(form.amount),
              qty: 1,
            },
          ],
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to create invoice');

      toast.success(`Invoice #${json.docNumber || json.invoiceId} created & sent via QuickBooks!`);
      setCreateOpen(false);
      setForm({
        customerName: '',
        customerEmail: '',
        customerPhone: '',
        address: '',
        city: 'Toronto',
        postalCode: '',
        dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        description: 'Residential Deep Cleaning Service',
        amount: '250.00',
        memo: 'Thank you for choosing Sea of Blue Cleaning Services!',
      });
      loadInvoices();
    } catch (err: any) {
      toast.error(err.message || 'Invoice generation error');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSendReminder(inv: any) {
    setRemindingId(inv.id);
    try {
      const res = await fetch('/api/finance/invoices', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceId: inv.id }),
      });

      if (!res.ok) throw new Error('Failed to dispatch reminder');
      toast.success(`Payment reminder sent for Invoice #${inv.docNumber}!`);
    } catch (err: any) {
      toast.error(err.message || 'Could not send reminder');
    } finally {
      setRemindingId(null);
    }
  }

  const filteredInvoices = invoices.filter(
    (i) =>
      i.customerName?.toLowerCase().includes(search.toLowerCase()) ||
      i.docNumber?.toLowerCase().includes(search.toLowerCase())
  );

  const totalOutstanding = invoices.reduce((sum, i) => sum + (i.balance || 0), 0);
  const overdueCount = invoices.filter((i) => i.status === 'overdue').length;

  return (
    <div className="space-y-6">
      {/* Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Invoicing & Collections Engine</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Real-time QuickBooks invoicing, automated payment links, and dunning cadences
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadInvoices} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" />
            Create & Send Invoice
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Total Outstanding A/R
            </CardTitle>
            <Clock className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCAD(totalOutstanding)}</div>
            <p className="text-xs text-muted-foreground mt-1">Across all open client accounts</p>
          </CardContent>
        </Card>

        <Card className={overdueCount > 0 ? 'border-red-300 bg-red-50/20' : ''}>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Overdue Invoices
            </CardTitle>
            <AlertTriangle className={`h-4 w-4 ${overdueCount > 0 ? 'text-red-600' : 'text-muted-foreground'}`} />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <span className={`text-2xl font-bold ${overdueCount > 0 ? 'text-red-700' : ''}`}>
                {overdueCount}
              </span>
              {overdueCount > 0 && (
                <Badge variant="outline" className="bg-red-100 text-red-800 border-red-300 text-xs">
                  Action Required
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Requiring collection follow-up</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Settled Invoices
            </CardTitle>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{invoices.filter((i) => i.status === 'paid').length}</div>
            <p className="text-xs text-muted-foreground mt-1">Paid in full via QuickBooks</p>
          </CardContent>
        </Card>
      </div>

      {/* Invoices List */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3">
          <CardTitle className="text-sm font-semibold">Active Client Invoices & Dunning</CardTitle>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search invoice or customer..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-xs"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {loading ? (
            <div className="p-5 space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center justify-between gap-4">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-5 w-20 rounded-full" />
                  <Skeleton className="h-8 w-24 rounded-md" />
                </div>
              ))}
            </div>
          ) : filteredInvoices.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground text-sm">
              <FileText className="h-8 w-8 mx-auto mb-2 text-muted-foreground/60" />
              <p className="font-medium text-foreground">No invoices found</p>
              <p className="text-xs mt-1">Click &quot;Create &amp; Send Invoice&quot; to issue your first bill.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">Invoice #</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Customer</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Issued Date</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Due Date</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Total</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Balance Due</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Collection Status</th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvoices.map((inv) => (
                  <tr key={inv.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                    <td className="px-5 py-3.5 font-mono text-xs font-medium">{inv.docNumber}</td>
                    <td className="px-4 py-3.5 font-medium">{inv.customerName}</td>
                    <td className="px-4 py-3.5 text-xs text-muted-foreground">{inv.txnDate}</td>
                    <td className="px-4 py-3.5 text-xs text-muted-foreground">{inv.dueDate || '—'}</td>
                    <td className="px-4 py-3.5 text-right font-medium">{formatCAD(inv.totalAmt)}</td>
                    <td className="px-4 py-3.5 text-right font-bold">
                      {inv.balance > 0 ? (
                        <span className="text-amber-600">{formatCAD(inv.balance)}</span>
                      ) : (
                        <span className="text-muted-foreground font-normal">$0.00</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      {inv.status === 'paid' ? (
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs">
                          Paid ✓
                        </Badge>
                      ) : inv.dunningStage === 'freeze_warning' ? (
                        <Badge variant="outline" className="bg-red-100 text-red-800 border-red-300 text-xs">
                          14d+ Overdue · Freeze
                        </Badge>
                      ) : inv.dunningStage === 'urgent' ? (
                        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-xs">
                          {inv.daysLate}d Late · Urgent
                        </Badge>
                      ) : inv.dunningStage === 'grace_period' ? (
                        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-xs">
                          {inv.daysLate}d Late
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs">
                          Awaiting Payment
                        </Badge>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      {inv.status !== 'paid' && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          disabled={remindingId === inv.id}
                          onClick={() => handleSendReminder(inv)}
                        >
                          <Send className="h-3 w-3 mr-1" />
                          Remind
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Create Invoice Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create & Send QuickBooks Invoice</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateInvoice} className="space-y-3 pt-2">
            <div>
              <Label htmlFor="custName">Customer / Company Name *</Label>
              <Input
                id="custName"
                placeholder="e.g. Acme Corp or Jane Doe"
                value={form.customerName}
                onChange={(e) => setForm({ ...form, customerName: e.target.value })}
                required
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="custEmail">Email (for payment link)</Label>
                <Input
                  id="custEmail"
                  type="email"
                  placeholder="billing@client.com"
                  value={form.customerEmail}
                  onChange={(e) => setForm({ ...form, customerEmail: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="custPhone">Phone</Label>
                <Input
                  id="custPhone"
                  placeholder="416-555-0199"
                  value={form.customerPhone}
                  onChange={(e) => setForm({ ...form, customerPhone: e.target.value })}
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="desc">Service Description *</Label>
              <Input
                id="desc"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                required
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="amount">Subtotal Amount (CAD) *</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  min="1"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  required
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="due">Payment Due Date</Label>
                <Input
                  id="due"
                  type="date"
                  value={form.dueDate}
                  onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                  className="mt-1"
                />
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-100 p-2.5 rounded-lg text-xs text-blue-800">
              ⚡ Will generate a live QuickBooks invoice with online credit card / ACH payments enabled and email the customer directly.
            </div>

            <DialogFooter className="gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting} className="bg-blue-600 hover:bg-blue-700 text-white">
                {submitting ? 'Generating...' : 'Send Invoice'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
