'use client';

import { useState, useEffect } from 'react';
import { DollarSign, UserCheck, CheckCircle2, ChevronDown, ChevronUp, FileText, RefreshCw, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';

function formatCAD(val: number) {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(val);
}

export function PayrollSuite() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [expandedCleaner, setExpandedCleaner] = useState<string | null>(null);
  const [selectedPaystub, setSelectedPaystub] = useState<any | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  async function loadPayroll() {
    setLoading(true);
    try {
      const res = await fetch('/api/finance/payroll');
      if (!res.ok) throw new Error('Failed to load payroll');
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      toast.error(err.message || 'Failed to fetch payroll');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPayroll();
  }, []);

  async function handleMarkPaid(cleanerItem: any) {
    const jobIds = cleanerItem.completedJobs
      .filter((j: any) => j.status !== 'paid_out')
      .map((j: any) => j.id);

    if (jobIds.length === 0) {
      toast.info('No pending jobs to pay out for this cleaner.');
      return;
    }

    setProcessingId(cleanerItem.employee.id);
    try {
      const res = await fetch('/api/finance/payroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: cleanerItem.employee.id,
          jobIds,
          action: 'mark_paid',
        }),
      });

      if (!res.ok) throw new Error('Failed to process payout');
      toast.success(`Marked ${jobIds.length} jobs as paid out for ${cleanerItem.employee.full_name}!`);
      loadPayroll();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update jobs');
    } finally {
      setProcessingId(null);
    }
  }

  if (loading && !data) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 w-full rounded-xl" />
          ))}
        </div>
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-amber-200 bg-amber-50/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Pending Cleaner Payouts
            </CardTitle>
            <DollarSign className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-700">{formatCAD(data?.totalPendingPayout || 0)}</div>
            <p className="text-xs text-muted-foreground mt-1">Ready for disbursement</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Total Paid Out (YTD)
            </CardTitle>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{formatCAD(data?.totalPaidOutYtd || 0)}</div>
            <p className="text-xs text-muted-foreground mt-1">Completed cleaner payouts</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Active Cleaners on Payroll
            </CardTitle>
            <UserCheck className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{data?.totalCleaners || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Staff with completed jobs</p>
          </CardContent>
        </Card>
      </div>

      {/* Cleaner Payroll Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-sm font-semibold">Cleaner Payout Roster</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">Automated commission splits and digital paystubs</p>
          </div>
          <Button variant="outline" size="sm" onClick={loadPayroll} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {(data?.cleaners || []).length === 0 ? (
            <div className="p-12 text-center text-muted-foreground text-sm">
              <AlertCircle className="h-8 w-8 mx-auto mb-2 text-muted-foreground/60" />
              <p className="font-medium text-foreground">No completed jobs ready for payroll</p>
              <p className="text-xs text-muted-foreground mt-1">When cleaners complete scheduled visits, their earnings will appear here.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">Cleaner</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Commission Rate</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Total Jobs</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Gross Revenue</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Pending Payout</th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.cleaners.map((item: any) => {
                  const isExpanded = expandedCleaner === item.employee.id;
                  const hasPending = item.netPayout > 0;
                  const ratePercent = Math.round((item.employee.payout_rate || 0.65) * 100);

                  return (
                    <>
                      <tr key={item.employee.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                        <td className="px-5 py-3.5">
                          <div className="font-semibold text-foreground">{item.employee.full_name}</div>
                          <div className="text-xs text-muted-foreground">{item.employee.phone || item.employee.email}</div>
                        </td>
                        <td className="px-4 py-3.5 text-xs font-mono">
                          <Badge variant="outline" className="text-blue-700 bg-blue-50 border-blue-200">
                            {ratePercent}% Commission
                          </Badge>
                        </td>
                        <td className="px-4 py-3.5 text-right font-medium text-muted-foreground">
                          {item.completedJobs.length} ({item.unpaidCount} unpaid)
                        </td>
                        <td className="px-4 py-3.5 text-right font-medium text-foreground">
                          {formatCAD(item.grossRevenue)}
                        </td>
                        <td className="px-4 py-3.5 text-right font-bold">
                          {hasPending ? (
                            <span className="text-amber-600">{formatCAD(item.netPayout)}</span>
                          ) : (
                            <span className="text-muted-foreground font-normal">All Settled ✓</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-right space-x-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 text-xs"
                            onClick={() => setExpandedCleaner(isExpanded ? null : item.employee.id)}
                          >
                            {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                            Details
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs"
                            onClick={() => setSelectedPaystub(item)}
                          >
                            <FileText className="h-3.5 w-3.5 mr-1" />
                            Pay Stub
                          </Button>
                          {hasPending && (
                            <Button
                              size="sm"
                              className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                              disabled={processingId === item.employee.id}
                              onClick={() => handleMarkPaid(item)}
                            >
                              Pay Out
                            </Button>
                          )}
                        </td>
                      </tr>
                      {/* Expandable Job Breakdown */}
                      {isExpanded && (
                        <tr key={`${item.employee.id}-detail`}>
                          <td colSpan={6} className="px-5 py-3 bg-muted/20">
                            <div className="text-xs font-semibold text-muted-foreground mb-2">Job Line Items</div>
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="text-muted-foreground border-b border-border/40">
                                  <th className="text-left py-1.5">Date</th>
                                  <th className="text-left py-1.5">Service</th>
                                  <th className="text-left py-1.5">Customer</th>
                                  <th className="text-right py-1.5">Job Total</th>
                                  <th className="text-right py-1.5">Cleaner Pay</th>
                                  <th className="text-right py-1.5">Status</th>
                                </tr>
                              </thead>
                              <tbody>
                                {item.completedJobs.map((j: any) => (
                                  <tr key={j.id} className="border-b border-border/20">
                                    <td className="py-1.5 text-muted-foreground">{j.scheduled_date}</td>
                                    <td className="py-1.5 capitalize">{j.service_type?.replace(/_/g, ' ')}</td>
                                    <td className="py-1.5">{j.customer?.full_name || 'Client'}</td>
                                    <td className="py-1.5 text-right font-medium">{formatCAD(j.final_price || j.quoted_price)}</td>
                                    <td className="py-1.5 text-right font-bold text-emerald-700">{formatCAD(j.cleanerEarned)}</td>
                                    <td className="py-1.5 text-right">
                                      <Badge variant="outline" className={j.status === 'paid_out' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-amber-50 text-amber-700 border-amber-200'}>
                                        {j.status === 'paid_out' ? 'Paid' : 'Pending'}
                                      </Badge>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Paystub Preview Dialog */}
      <Dialog open={!!selectedPaystub} onOpenChange={(open) => !open && setSelectedPaystub(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Cleaner Pay Statement</DialogTitle>
          </DialogHeader>
          {selectedPaystub && (
            <div className="space-y-4 pt-2 text-sm">
              <div className="border-b border-border pb-3">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Recipient</p>
                <p className="font-bold text-base">{selectedPaystub.employee.full_name}</p>
                <p className="text-xs text-muted-foreground">{selectedPaystub.employee.phone} • {selectedPaystub.employee.email}</p>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Commission Split</span>
                  <span className="font-mono">{Math.round((selectedPaystub.employee.payout_rate || 0.65) * 100)}%</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Completed Jobs</span>
                  <span className="font-mono">{selectedPaystub.completedJobs.length}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Gross Revenue Generated</span>
                  <span className="font-mono font-medium">{formatCAD(selectedPaystub.grossRevenue)}</span>
                </div>
                <div className="flex justify-between text-sm font-bold border-t border-border pt-2">
                  <span>Net Payout Amount</span>
                  <span className="text-emerald-700">{formatCAD(selectedPaystub.commissionEarnings)}</span>
                </div>
              </div>

              <div className="bg-muted p-3 rounded-lg text-xs space-y-1 text-muted-foreground">
                <p className="font-semibold text-foreground">Payment Method</p>
                <p>EFT / Direct Interac to {selectedPaystub.employee.email || selectedPaystub.employee.phone}</p>
                <p className="text-[10px] text-muted-foreground/80">Issued by Sea of Blue Operations (Ontario, Canada)</p>
              </div>

              <Button className="w-full" variant="outline" onClick={() => window.print()}>
                Print / Save Statement
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
