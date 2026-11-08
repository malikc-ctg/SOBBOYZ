'use client';

import { useState, useEffect } from 'react';
import { ShieldCheck, FileCheck, Download, AlertCircle, RefreshCw, Calculator, Landmark } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

function formatCAD(val: number) {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(val);
}

export function ComplianceSuite() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  async function loadCompliance() {
    setLoading(true);
    try {
      const res = await fetch('/api/finance/compliance');
      if (!res.ok) throw new Error('Failed to load compliance data');
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      toast.error(err.message || 'Error loading compliance');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCompliance();
  }, []);

  function handleExportCsv() {
    if (!data?.subcontractorT4a?.contractors || data.subcontractorT4a.contractors.length === 0) {
      toast.info('No contractor earnings data to export.');
      return;
    }

    const headers = ['Contractor Name', 'Email', 'Phone', 'Gross Earnings (CAD)', 'Job Count', 'Requires T4A/T5018 Slip'];
    const rows = data.subcontractorT4a.contractors.map((c: any) => [
      `"${c.cleanerName}"`,
      `"${c.cleanerEmail || ''}"`,
      `"${c.cleanerPhone || ''}"`,
      c.grossEarnings.toFixed(2),
      c.jobCount,
      c.requiresT4aSlip ? 'YES' : 'NO',
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r: any) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `SeaOfBlue_Subcontractor_T4A_${new Date().getFullYear()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Subcontractor compliance CSV downloaded!');
  }

  if (loading && !data) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-7 w-64" />
            <Skeleton className="h-4 w-96 max-w-full" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-9 w-24 rounded-lg" />
            <Skeleton className="h-9 w-40 rounded-lg" />
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-72 w-full rounded-xl" />
          <Skeleton className="h-72 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  const netfile = data?.craNetfile;
  const wsib = data?.wsib;
  const t4a = data?.subcontractorT4a;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Ontario CRA Tax &amp; WSIB Compliance Vault</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            CRA GST/HST Netfile worksheet, WSIB quarterly premium forecasting, and subcontractor T4A/T5018 reporting
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadCompliance} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button size="sm" variant="outline" onClick={handleExportCsv}>
            <Download className="h-4 w-4 mr-1.5" />
            Export T4A Summary (CSV)
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* CRA GST/HST Netfile Worksheet */}
        <Card className="border-blue-200">
          <CardHeader className="border-b border-border/60 pb-3 bg-blue-50/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Landmark className="h-4 w-4 text-blue-700" />
                <CardTitle className="text-sm font-semibold">CRA GST/HST Netfile Return</CardTitle>
              </div>
              <Badge variant="outline" className="text-xs bg-blue-100 text-blue-800 border-blue-300">
                Business #{netfile?.businessNumber || '774623375RT0001'}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Ready-to-file values for your official Canada Revenue Agency return
            </p>
          </CardHeader>
          <CardContent className="p-5 space-y-4">
            <div className="space-y-3 font-mono text-sm">
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40">
                <div>
                  <span className="text-xs font-bold text-muted-foreground block">LINE 101</span>
                  <span className="text-xs text-foreground">Total Sales &amp; Other Revenue</span>
                </div>
                <span className="text-base font-bold text-foreground">{formatCAD(netfile?.line101_sales || 0)}</span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-lg bg-red-50/40 border border-red-100">
                <div>
                  <span className="text-xs font-bold text-red-700 block">LINE 105</span>
                  <span className="text-xs text-foreground">Total GST/HST Collected on Sales</span>
                </div>
                <span className="text-base font-bold text-red-600">{formatCAD(netfile?.line105_collected || 0)}</span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-lg bg-green-50/40 border border-green-100">
                <div>
                  <span className="text-xs font-bold text-green-700 block">LINE 108</span>
                  <span className="text-xs text-foreground">Input Tax Credits (ITCs Claimed)</span>
                </div>
                <span className="text-base font-bold text-green-700">{formatCAD(netfile?.line108_itcs || 0)}</span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg bg-card border-2 border-primary/40 shadow-sm">
                <div>
                  <span className="text-xs font-bold text-primary block">LINE 109</span>
                  <span className="text-xs font-semibold text-foreground">Net Tax to Remit (Line 105 - Line 108)</span>
                </div>
                <span className="text-xl font-black text-primary">{formatCAD(netfile?.line109_netTax || 0)}</span>
              </div>
            </div>

            <div className="text-[11px] text-muted-foreground bg-muted/30 p-2.5 rounded-md space-y-1">
              <p>• Ontario Harmonized Sales Tax rate is <strong>13%</strong>.</p>
              <p>• Line 109 represents your true liability payable to the Receiver General of Canada.</p>
            </div>
          </CardContent>
        </Card>

        {/* WSIB Ontario Estimator */}
        <Card>
          <CardHeader className="border-b border-border/60 pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                <CardTitle className="text-sm font-semibold">Ontario WSIB Premium Estimator</CardTitle>
              </div>
              <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700 border-emerald-200">
                Class G1: Building Cleaning
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Quarterly workplace safety coverage accrual based on cleaner payroll
            </p>
          </CardHeader>
          <CardContent className="p-5 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-muted/40 rounded-lg">
                <p className="text-xs text-muted-foreground">Total Insurable Earnings</p>
                <p className="text-lg font-bold text-foreground">{formatCAD(wsib?.totalInsurableEarnings || 0)}</p>
                <p className="text-[10px] text-muted-foreground">Cleaner wages YTD</p>
              </div>

              <div className="p-3 bg-muted/40 rounded-lg">
                <p className="text-xs text-muted-foreground">WSIB Rate Benchmark</p>
                <p className="text-lg font-bold text-foreground">${wsib?.wsibRatePer100 || 2.35}</p>
                <p className="text-[10px] text-muted-foreground">Per $100 gross payroll</p>
              </div>
            </div>

            <div className="p-3.5 rounded-lg border border-emerald-200 bg-emerald-50/30 space-y-1">
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground">Estimated Quarterly Remittance</span>
                <span className="text-base font-bold text-emerald-800">{formatCAD(wsib?.estimatedWsibQuarterlyPremium || 0)}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground">Full Year Projected Premium</span>
                <span className="font-semibold text-emerald-700">{formatCAD(wsib?.estimatedWsibAnnualPremium || 0)}</span>
              </div>
            </div>

            <div className="text-[11px] text-muted-foreground bg-muted/30 p-2.5 rounded-md space-y-1">
              <p>• In Ontario, cleaning companies must remit quarterly premiums through WSIB e-Services.</p>
              <p>• Keeping reserve funds set aside ensures compliance without cash flow surprises.</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Subcontractor T4A / T5018 Slip Compliance Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-sm font-semibold">Subcontractor T4A / T5018 Earnings Compliance</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              CRA requires information slips for any contractor earning over $500 CAD in a calendar year
            </p>
          </div>
          <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">
            {t4a?.contractorsRequiringSlip || 0} Cleaners Require Slips
          </Badge>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {(t4a?.contractors || []).length === 0 ? (
            <div className="p-10 text-center text-muted-foreground text-xs">
              No contractor earnings recorded above the $500 threshold.
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-5 py-2.5 font-medium text-muted-foreground">Contractor Name</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Contact Info</th>
                  <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Completed Jobs</th>
                  <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Total Gross Paid (CAD)</th>
                  <th className="text-right px-5 py-2.5 font-medium text-muted-foreground">CRA Slip Requirement</th>
                </tr>
              </thead>
              <tbody>
                {t4a.contractors.map((cleaner: any, i: number) => (
                  <tr key={i} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                    <td className="px-5 py-2.5 font-semibold text-foreground">{cleaner.cleanerName}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {cleaner.cleanerPhone || cleaner.cleanerEmail || '—'}
                    </td>
                    <td className="px-4 py-2.5 text-right text-muted-foreground font-mono">{cleaner.jobCount}</td>
                    <td className="px-4 py-2.5 text-right font-bold text-foreground">{formatCAD(cleaner.grossEarnings)}</td>
                    <td className="px-5 py-2.5 text-right">
                      {cleaner.requiresT4aSlip ? (
                        <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 text-[10px]">
                          T4A Slip Required
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-muted text-muted-foreground text-[10px]">
                          Under $500 Limit
                        </Badge>
                      )}
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
