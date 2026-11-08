'use client';

import { useState, useEffect } from 'react';
import { MapPin, Sparkles, TrendingUp, DollarSign, Layers, RefreshCw, BarChart2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

function formatCAD(val: number) {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(val);
}

export function UnitEconomicsSuite() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  async function loadEconomics() {
    setLoading(true);
    try {
      const res = await fetch('/api/finance/unit-economics');
      if (!res.ok) throw new Error('Failed to load unit economics');
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      toast.error(err.message || 'Error loading unit economics');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadEconomics();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Zone Unit Economics & Route Density</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Territory margins, labor efficiency index, and profitability by service line
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadEconomics} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Company Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Total Revenue Tracked
            </CardTitle>
            <DollarSign className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCAD(data?.summary?.totalRevenue || 0)}</div>
            <p className="text-xs text-muted-foreground mt-1">{data?.summary?.totalJobs || 0} completed service calls</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Cleaner Labor Cost (65%)
            </CardTitle>
            <Layers className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{formatCAD(data?.summary?.totalLaborCost || 0)}</div>
            <p className="text-xs text-muted-foreground mt-1">Direct cleaner payouts</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Company Gross Profit
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-700">{formatCAD(data?.summary?.grossProfit || 0)}</div>
            <p className="text-xs text-muted-foreground mt-1">Retained operating margin</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Avg Gross Margin
            </CardTitle>
            <BarChart2 className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-700">{data?.summary?.companyMargin || 35}%</div>
            <p className="text-xs text-muted-foreground mt-1">Target healthy benchmark: 30–40%</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Territory & Zone Breakdown Table */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <MapPin className="h-4 w-4 text-blue-600" />
              Zone Profitability Breakdown
            </CardTitle>
            <p className="text-xs text-muted-foreground">Margins ranked by territory performance</p>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            {loading ? (
              <div className="p-4 space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex items-center justify-between gap-3">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-12" />
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-5 w-14 rounded" />
                  </div>
                ))}
              </div>
            ) : (data?.zones || []).length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-xs">No zone jobs completed yet.</div>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Territory</th>
                    <th className="text-right px-3 py-2.5 font-medium text-muted-foreground">Jobs</th>
                    <th className="text-right px-3 py-2.5 font-medium text-muted-foreground">Revenue</th>
                    <th className="text-right px-3 py-2.5 font-medium text-muted-foreground">Gross Profit</th>
                    <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Margin</th>
                  </tr>
                </thead>
                <tbody>
                  {data.zones.map((zone: any) => (
                    <tr key={zone.zoneId} className="border-b border-border/50 hover:bg-muted/20">
                      <td className="px-4 py-2.5 font-medium">
                        <div>{zone.zoneName}</div>
                        <div className="text-[10px] text-muted-foreground">{zone.city}</div>
                      </td>
                      <td className="px-3 py-2.5 text-right text-muted-foreground">{zone.totalJobs}</td>
                      <td className="px-3 py-2.5 text-right font-medium">{formatCAD(zone.revenue)}</td>
                      <td className="px-3 py-2.5 text-right font-semibold text-emerald-700">{formatCAD(zone.grossProfit)}</td>
                      <td className="px-4 py-2.5 text-right">
                        <span className={`inline-flex px-1.5 py-0.5 rounded font-bold ${
                          zone.grossMargin >= 35 ? 'bg-green-100 text-green-700' :
                          zone.grossMargin >= 25 ? 'bg-amber-100 text-amber-700' :
                          'bg-muted text-muted-foreground'
                        }`}>
                          {zone.grossMargin}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        {/* Profitability by Service Line */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-emerald-600" />
              Service Line Economics
            </CardTitle>
            <p className="text-xs text-muted-foreground">Which cleaning types generate the highest return</p>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            {loading ? (
              <div className="p-4 space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex items-center justify-between gap-3">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-12" />
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-5 w-14 rounded" />
                  </div>
                ))}
              </div>
            ) : (data?.services || []).length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-xs">No service data available.</div>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Service Type</th>
                    <th className="text-right px-3 py-2.5 font-medium text-muted-foreground">Volume</th>
                    <th className="text-right px-3 py-2.5 font-medium text-muted-foreground">Avg Ticket</th>
                    <th className="text-right px-3 py-2.5 font-medium text-muted-foreground">Total Revenue</th>
                    <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Margin</th>
                  </tr>
                </thead>
                <tbody>
                  {data.services.map((srv: any) => (
                    <tr key={srv.serviceType} className="border-b border-border/50 hover:bg-muted/20">
                      <td className="px-4 py-2.5 font-medium capitalize">
                        {srv.serviceType?.replace(/_/g, ' ')}
                      </td>
                      <td className="px-3 py-2.5 text-right text-muted-foreground">{srv.jobCount}</td>
                      <td className="px-3 py-2.5 text-right font-medium">{formatCAD(srv.avgTicket)}</td>
                      <td className="px-3 py-2.5 text-right font-semibold">{formatCAD(srv.totalRevenue)}</td>
                      <td className="px-4 py-2.5 text-right">
                        <span className="font-bold text-emerald-700">{srv.avgMargin}%</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
