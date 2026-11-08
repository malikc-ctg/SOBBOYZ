'use client';

import { useState, useEffect } from 'react';
import { Repeat, TrendingUp, Users, DollarSign, Calendar, RefreshCw, Sparkles, ShieldCheck } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

function formatCAD(val: number) {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(val);
}

export function SubscriptionSuite() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  async function loadMrr() {
    setLoading(true);
    try {
      const res = await fetch('/api/finance/mrr');
      if (!res.ok) throw new Error('Failed to load subscription metrics');
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      toast.error(err.message || 'Error loading MRR data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMrr();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Subscription & MRR Waterfall</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Recurring contract economics, subscription retention, and customer lifetime value
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadMrr} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Top MRR Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-blue-200 bg-blue-50/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Monthly Recurring Revenue (MRR)
            </CardTitle>
            <Repeat className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-700">{formatCAD(data?.activeMrr || 0)}</div>
            <p className="text-xs text-muted-foreground mt-1">Normalized monthly contracted revenue</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Annual Run Rate (ARR)
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{formatCAD(data?.annualRunRate || 0)}</div>
            <p className="text-xs text-muted-foreground mt-1">Projected 12-month contracted value</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Active Subscribers
            </CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{data?.activeSubscriptions || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {data?.breakdown?.biweekly || 0} Bi-weekly • {data?.breakdown?.weekly || 0} Weekly • {data?.breakdown?.monthly || 0} Monthly
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Estimated Client LTV
            </CardTitle>
            <DollarSign className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{formatCAD(data?.estimatedLtv || 0)}</div>
            <p className="text-xs text-muted-foreground mt-1">Target CAC ceiling: {formatCAD(data?.targetCac || 0)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Subscription Breakdown & Contracts Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-sm font-semibold">Active Recurring Service Agreements</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">Recurring cleanings delivering automated predictable cash flow</p>
          </div>
          <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700 border-emerald-200">
            {data?.activeSubscriptions || 0} Active Contracts
          </Badge>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {loading ? (
            <div className="p-5 space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center justify-between gap-4">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-5 w-20 rounded-full" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-24" />
                </div>
              ))}
            </div>
          ) : (data?.subscriptions || []).length === 0 ? (
            <div className="p-12 text-center text-muted-foreground text-sm">
              <Calendar className="h-8 w-8 mx-auto mb-2 text-muted-foreground/60" />
              <p className="font-medium text-foreground">No recurring contracts found</p>
              <p className="text-xs mt-1">Enroll customers into weekly or bi-weekly cleans to build predictable MRR.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">Customer</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Service Type</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Cadence</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Price / Visit</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Monthly Value (MRR)</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Next Scheduled Run</th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.subscriptions.map((sub: any) => (
                  <tr key={sub.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="font-semibold text-foreground">{sub.customerName}</div>
                      {sub.customerEmail && <div className="text-xs text-muted-foreground">{sub.customerEmail}</div>}
                    </td>
                    <td className="px-4 py-3.5 capitalize text-xs">{sub.serviceType?.replace(/_/g, ' ')}</td>
                    <td className="px-4 py-3.5">
                      <Badge variant="outline" className="text-xs capitalize border-blue-200 text-blue-700 bg-blue-50/50">
                        {sub.frequency}
                      </Badge>
                    </td>
                    <td className="px-4 py-3.5 text-right font-medium">{formatCAD(sub.quotedPrice)}</td>
                    <td className="px-4 py-3.5 text-right font-bold text-emerald-700">{formatCAD(sub.monthlyValue)}</td>
                    <td className="px-4 py-3.5 text-xs text-muted-foreground">{sub.nextJobDate || 'Scheduled'}</td>
                    <td className="px-5 py-3.5 text-right">
                      <Badge variant="outline" className={sub.isActive ? 'bg-emerald-50 text-emerald-700 border-emerald-300 text-xs' : 'bg-muted text-muted-foreground text-xs'}>
                        {sub.isActive ? 'Active Contract' : 'Paused'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
