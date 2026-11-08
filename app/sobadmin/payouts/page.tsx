'use client';

import { useEffect, useState } from 'react';
import { DollarSign, Users, TrendingUp, RefreshCw, Download } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

interface VendorPayout {
  vendorName: string;
  totalPaid: number;
  lastPaymentDate: string | null;
  transactions: Array<{
    date: string;
    amount: number;
    memo: string;
  }>;
}

function formatCAD(val: number) {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 2 }).format(val);
}

export default function PayoutsPage() {
  const [payouts, setPayouts] = useState<VendorPayout[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedVendor, setExpandedVendor] = useState<string | null>(null);

  async function loadPayouts() {
    setLoading(true);
    setError(null);
    const now = new Date();
    const startOfYear = `${now.getFullYear()}-01-01`;
    const today = now.toISOString().split('T')[0];
    try {
      const res = await fetch(`/api/integrations/quickbooks/expenses?start_date=${startOfYear}&end_date=${today}&group_by=vendor`);
      if (!res.ok) throw new Error('Failed to load payout data');
      const data = await res.json();
      setPayouts(data.vendors || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadPayouts(); }, []);

  const totalPaidOut = payouts.reduce((sum, p) => sum + p.totalPaid, 0);
  const activeVendors = payouts.filter(p => p.totalPaid > 0).length;
  const avgPayout = activeVendors > 0 ? totalPaidOut / activeVendors : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Payouts & Contractor Earnings</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Year-to-date contractor payments from QuickBooks</p>
        </div>
        <Button variant="outline" size="sm" onClick={loadPayouts} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Total Paid Out (YTD)</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCAD(totalPaidOut)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Active Contractors</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeVendors}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Avg Payout / Contractor</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCAD(avgPayout)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-800 text-sm">
          <strong>Error:</strong> {error}
          <p className="text-xs mt-1">Make sure QuickBooks is connected in Settings.</p>
        </div>
      )}

      {/* Vendor Payouts Cards (< md) */}
      <div className="md:hidden space-y-2.5">
        {loading ? (
          <div className="space-y-2.5">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardContent className="p-3.5 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1.5">
                      <Skeleton className="h-4 w-36" />
                      <Skeleton className="h-3 w-28" />
                    </div>
                    <div className="space-y-1 text-right">
                      <Skeleton className="h-4 w-20 ml-auto" />
                      <Skeleton className="h-3 w-16 ml-auto" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : payouts.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm bg-card border rounded-xl">
            <DollarSign className="h-8 w-8 mx-auto mb-2 text-muted-foreground/60" />
            <p className="font-medium text-foreground">No payout data found</p>
            <p className="text-xs mt-1">Vendor payments will appear here once recorded in QuickBooks.</p>
          </div>
        ) : (
          payouts.map((vendor) => {
            const isExpanded = expandedVendor === vendor.vendorName;
            return (
              <Card key={vendor.vendorName} className="shadow-xs border-border/80">
                <CardContent className="p-3.5 space-y-2.5">
                  <div
                    className="flex items-start justify-between gap-2 cursor-pointer"
                    onClick={() => setExpandedVendor(isExpanded ? null : vendor.vendorName)}
                  >
                    <div className="min-w-0">
                      <p className="font-bold text-sm text-foreground truncate">{vendor.vendorName}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Last Paid: {vendor.lastPaymentDate ? new Date(vendor.lastPaymentDate).toLocaleDateString('en-CA') : '—'}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="font-extrabold text-sm text-emerald-600 block">{formatCAD(vendor.totalPaid)}</span>
                      <span className="text-[10px] text-muted-foreground">{vendor.transactions.length} payouts {isExpanded ? '▲' : '▼'}</span>
                    </div>
                  </div>

                  {isExpanded && vendor.transactions.length > 0 && (
                    <div className="pt-2 border-t border-border/60 space-y-1.5 text-xs">
                      {vendor.transactions.map((txn, i) => (
                        <div key={i} className="flex items-center justify-between p-1.5 bg-muted/40 rounded">
                          <span className="text-muted-foreground">{new Date(txn.date).toLocaleDateString('en-CA')}</span>
                          <span className="font-medium text-foreground">{formatCAD(txn.amount)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Desktop Vendor Payouts Table (>= md) */}
      <Card className="hidden md:block">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Contractor Payouts — Year to Date</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {loading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center justify-between gap-4">
                  <Skeleton className="h-4 w-44" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-4 w-16" />
                </div>
              ))}
            </div>
          ) : payouts.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground text-sm">
              <DollarSign className="h-8 w-8 mx-auto mb-2 text-muted-foreground/60" />
              <p className="font-medium text-foreground">No payout data found</p>
              <p className="text-xs mt-1">Vendor payments will appear here once recorded in QuickBooks.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-6 py-3 text-xs font-medium text-muted-foreground">Contractor / Vendor</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">YTD Total Paid</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Last Payment</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Transactions</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {payouts.map((vendor) => (
                  <>
                    <tr key={vendor.vendorName} className="border-b border-border/50 hover:bg-muted/20 transition-colors cursor-pointer" onClick={() => setExpandedVendor(expandedVendor === vendor.vendorName ? null : vendor.vendorName)}>
                      <td className="px-6 py-3.5 font-medium">{vendor.vendorName}</td>
                      <td className="px-4 py-3.5 text-right font-semibold text-emerald-700">{formatCAD(vendor.totalPaid)}</td>
                      <td className="px-4 py-3.5 text-muted-foreground text-xs">
                        {vendor.lastPaymentDate ? new Date(vendor.lastPaymentDate).toLocaleDateString('en-CA') : '—'}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <Badge variant="outline" className="text-xs">{vendor.transactions.length}</Badge>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <span className="text-xs text-muted-foreground">{expandedVendor === vendor.vendorName ? '▲' : '▼'}</span>
                      </td>
                    </tr>
                    {expandedVendor === vendor.vendorName && vendor.transactions.length > 0 && (
                      <tr key={`${vendor.vendorName}-detail`}>
                        <td colSpan={5} className="px-6 py-2 bg-muted/10">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-muted-foreground">
                                <th className="text-left py-1 px-2">Date</th>
                                <th className="text-right py-1 px-2">Amount</th>
                                <th className="text-left py-1 px-2">Memo</th>
                              </tr>
                            </thead>
                            <tbody>
                              {vendor.transactions.map((txn, i) => (
                                <tr key={i} className="border-t border-border/30">
                                  <td className="py-1.5 px-2 text-muted-foreground">{new Date(txn.date).toLocaleDateString('en-CA')}</td>
                                  <td className="py-1.5 px-2 text-right font-medium">{formatCAD(txn.amount)}</td>
                                  <td className="py-1.5 px-2 text-muted-foreground">{txn.memo || '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
                <tr className="bg-muted/30 font-semibold">
                  <td className="px-6 py-3">Total</td>
                  <td className="px-4 py-3 text-right text-emerald-700">{formatCAD(totalPaidOut)}</td>
                  <td colSpan={3}></td>
                </tr>
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
