'use client';

import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, DollarSign, Briefcase, BarChart3, RefreshCw } from 'lucide-react';
import type { ZoneMonthlyPnl, Zone, ZoneExpansionScore } from '@/types';
import { format } from 'date-fns';
import { DatePickerWithRange } from '@/components/ui/date-range-picker';
import { DateRange } from 'react-day-picker';
import { Badge } from '@/components/ui/badge';
import { PayrollSuite } from '@/components/admin/finance/PayrollSuite';
import { InvoicingSuite } from '@/components/admin/finance/InvoicingSuite';
import { SubscriptionSuite } from '@/components/admin/finance/SubscriptionSuite';
import { UnitEconomicsSuite } from '@/components/admin/finance/UnitEconomicsSuite';
import { ComplianceSuite } from '@/components/admin/finance/ComplianceSuite';
import { AdSpendSuite } from '@/components/admin/finance/AdSpendSuite';

const FINANCE_TABS = [
  { id: 'overview', label: 'Overview & QBO' },
  { id: 'ad_spend', label: 'Weekly Ad Spend & P&L' },
  { id: 'payroll', label: 'Cleaner Payroll' },
  { id: 'invoicing', label: 'Invoicing & A/R' },
  { id: 'subscriptions', label: 'MRR & Subscriptions' },
  { id: 'unit_economics', label: 'Unit Economics' },
  { id: 'compliance', label: 'CRA & WSIB Vault' },
  { id: 'forecast', label: 'Expansion Forecast' },
] as const;

type FinanceTabId = typeof FINANCE_TABS[number]['id'];

function formatCAD(val: number) {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(val);
}

function StatCard({ label, value, sub, trend }: { label: string; value: string; sub?: string; trend?: number }) {
  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className="text-2xl font-bold text-foreground">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      {trend !== undefined && (
        <div className={`flex items-center gap-1 mt-1.5 text-xs font-medium ${trend >= 0 ? 'text-green-600' : 'text-red-500'}`}>
          {trend >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          {Math.abs(trend).toFixed(1)}% MoM
        </div>
      )}
    </div>
  );
}

function ExpansionBadge({ score }: { score: ZoneExpansionScore }) {
  const color = score.ready
    ? 'bg-green-500/10 text-green-500 border-green-500/20'
    : score.score >= 50
    ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
    : 'bg-red-500/10 text-red-500 border-red-500/20';

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${color}`}>
      {score.ready ? '✓ Ready' : `${score.score}/100`}
    </span>
  );
}

export default function FinancePage() {
  const [tab, setTab] = useState<FinanceTabId>('overview');
  const [qbData, setQbData] = useState<any>(null);
  const [qbLoading, setQbLoading] = useState(false);
  const [pnl, setPnl] = useState<ZoneMonthlyPnl[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [selectedZone, setSelectedZone] = useState<string>('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [forecast, setForecast] = useState<{
    forecast: Array<{ month: string; projected_revenue: number; projected_jobs: number; projected_profit: number }>;
    break_even_jobs: number | null;
    expansion_score: ZoneExpansionScore | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/zones').then(r => r.json()).then((data) => setZones(Array.isArray(data) ? data : []));
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (selectedZone) params.append('zone_id', selectedZone);
    if (dateRange?.from) params.append('start_date', format(dateRange.from, 'yyyy-MM-dd'));
    if (dateRange?.to) params.append('end_date', format(dateRange.to, 'yyyy-MM-dd'));
    const url = `/api/finance/pnl${params.toString() ? `?${params.toString()}` : ''}`;
    fetch(url)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data?.error ?? `HTTP ${r.status}`);
        return data;
      })
      .then((data) => { setPnl(Array.isArray(data) ? data : []); setLoading(false); })
      .catch((err) => { setError(err.message); setLoading(false); });
  }, [selectedZone, refreshKey, dateRange]);

  useEffect(() => {
    if (selectedZone && tab === 'forecast') {
      fetch(`/api/finance/forecast?zone_id=${selectedZone}`).then(r => r.json()).then(setForecast);
    }
  }, [selectedZone, tab]);

  useEffect(() => {
    setQbLoading(true);
    const now = new Date();
    const startOfYear = `${now.getFullYear()}-01-01`;
    const today = now.toISOString().split('T')[0];
    Promise.all([
      fetch(`/api/integrations/quickbooks/reports?type=pnl&start_date=${startOfYear}&end_date=${today}`).then(r => r.json()),
      fetch(`/api/integrations/quickbooks/reports?type=invoices`).then(r => r.json()),
      fetch(`/api/integrations/quickbooks/reports?type=aged_receivables`).then(r => r.json()),
      fetch(`/api/integrations/quickbooks/reports?type=tax_summary&start_date=${startOfYear}&end_date=${today}`).then(r => r.json()),
      fetch(`/api/integrations/quickbooks/reports?type=accounts`).then(r => r.json()),
    ]).then(([pnl, invoices, receivables, tax, accounts]) => {
      setQbData({ pnl, invoices, receivables, tax, accounts });
      setQbLoading(false);
    }).catch((err) => {
      console.error('Failed to load QuickBooks data:', err);
      setQbLoading(false);
    });
  }, [refreshKey]);

  // Group by zone for overview table
  const zoneMap: Map<string, ZoneMonthlyPnl[]> = new Map();
  for (const row of pnl) {
    const arr = zoneMap.get(row.zone_id) ?? [];
    arr.push(row);
    zoneMap.set(row.zone_id, arr);
  }

  const latestByZone = Array.from(zoneMap.entries()).map(([, rows]) => rows[0]);
  const totalRevenue = latestByZone.reduce((s, r) => s + r.gross_revenue, 0);
  const totalProfit = latestByZone.reduce((s, r) => s + r.gross_profit, 0);
  const totalJobs = latestByZone.reduce((s, r) => s + r.jobs_completed, 0);
  const avgMargin = totalRevenue > 0 ? totalProfit / totalRevenue : 0;

  return (
    <div className="space-y-5 min-w-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-foreground">Finance</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Per-zone P&amp;L, forecasting, and expansion readiness</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <DatePickerWithRange date={dateRange} onDateChange={setDateRange} />
          <select
            className="text-sm border border-border rounded-lg px-3 py-2 bg-background"
            value={selectedZone}
            onChange={(e) => setSelectedZone(e.target.value)}
          >
            <option value="">All zones</option>
            {zones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
          </select>
          <button
            onClick={() => setRefreshKey(k => k + 1)}
            className="p-2 border border-border rounded-lg hover:bg-muted transition-colors"
            title="Refresh P&L data"
          >
            <RefreshCw className={`h-4 w-4 text-muted-foreground ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Tabs — scrollable on mobile */}
      <div className="overflow-x-auto scrollbar-none -mx-1 px-1">
        <div className="flex gap-1 bg-muted/50 p-1 rounded-lg w-max min-w-full">
          {FINANCE_TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors shrink-0 ${
                tab === t.id ? 'bg-background text-foreground shadow-sm font-semibold' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'overview' && (
        <div className="space-y-6">
          {/* Error banner */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-800 text-sm">
              <strong>Could not load finance data:</strong> {error}
            </div>
          )}

          {/* Summary cards — 2 cols mobile, 4 cols desktop */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
            <StatCard label="Monthly Revenue" value={formatCAD(totalRevenue)} sub={dateRange?.from ? "Custom date range" : "This month across all zones"} />
            <StatCard label="Gross Profit" value={formatCAD(totalProfit)} sub={`${(avgMargin * 100).toFixed(0)}% margin`} />
            <StatCard label="Jobs Completed" value={totalJobs.toString()} sub={dateRange?.from ? "Custom date range" : "This month"} />
            <StatCard label="Avg Ticket" value={formatCAD(totalJobs > 0 ? totalRevenue / totalJobs : 0)} sub="Per completed job" />
          </div>

          {/* Zone P&L table */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-border flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              <h2 className="font-semibold text-foreground text-sm">Zone P&amp;L — {dateRange?.from ? "Custom Range" : "Current Month"}</h2>
              <span className="text-xs text-muted-foreground ml-auto">Refreshed nightly</span>
            </div>
            {loading ? (
              <div className="p-12 text-center text-muted-foreground text-sm">Loading P&amp;L data…</div>
            ) : error ? (
              <div className="p-12 text-center text-red-500 text-sm">Failed to load data. Click refresh to retry.</div>
            ) : latestByZone.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground text-sm">No data yet. The view refreshes nightly after jobs are completed.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="text-left px-6 py-3 text-xs font-medium text-muted-foreground">Zone</th>
                      <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Jobs</th>
                      <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Revenue</th>
                      <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Payouts</th>
                      <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Profit</th>
                      <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Margin</th>
                      <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Avg Ticket</th>
                      <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Recurring</th>
                    </tr>
                  </thead>
                  <tbody>
                    {latestByZone.map((row) => {
                      const margin = row.gross_revenue > 0 ? row.gross_profit / row.gross_revenue : 0;
                      const recurringPct = row.jobs_completed > 0 ? row.recurring_jobs / row.jobs_completed : 0;
                      return (
                        <tr key={row.zone_id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                          <td className="px-6 py-3.5 font-medium text-foreground">
                            {zones.find(z => z.id === row.zone_id)?.name ?? (row.zone as Zone | undefined)?.name ?? row.zone_id.slice(0, 8)}
                          </td>
                          <td className="px-4 py-3.5 text-right text-muted-foreground">{row.jobs_completed}</td>
                          <td className="px-4 py-3.5 text-right font-medium">{formatCAD(row.gross_revenue)}</td>
                          <td className="px-4 py-3.5 text-right text-muted-foreground">{formatCAD(row.total_employee_payouts)}</td>
                          <td className="px-4 py-3.5 text-right font-semibold text-green-700">{formatCAD(row.gross_profit)}</td>
                          <td className="px-4 py-3.5 text-right">
                            <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${margin >= 0.3 ? 'bg-green-100 text-green-700' : margin >= 0.2 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                              {(margin * 100).toFixed(0)}%
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-right text-muted-foreground">{formatCAD(row.avg_ticket)}</td>
                          <td className="px-4 py-3.5 text-right text-muted-foreground">{(recurringPct * 100).toFixed(0)}%</td>
                        </tr>
                      );
                    })}
                    {/* Totals row */}
                    <tr className="bg-muted/30 font-semibold">
                      <td className="px-6 py-3 text-foreground">Total</td>
                      <td className="px-4 py-3 text-right">{totalJobs}</td>
                      <td className="px-4 py-3 text-right">{formatCAD(totalRevenue)}</td>
                      <td className="px-4 py-3 text-right">{formatCAD(latestByZone.reduce((s, r) => s + r.total_employee_payouts, 0))}</td>
                      <td className="px-4 py-3 text-right text-green-700">{formatCAD(totalProfit)}</td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-green-100 text-green-700">
                          {(avgMargin * 100).toFixed(0)}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">{formatCAD(totalJobs > 0 ? totalRevenue / totalJobs : 0)}</td>
                      <td className="px-4 py-3 text-right">—</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Live QuickBooks Ledger & Invoices Block */}
          <div className="pt-4 border-t border-border/80 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-foreground">Live QuickBooks Ledger &amp; Invoices</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Real-time banking, aged receivables, and tax records</p>
              </div>
              <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs">
                QuickBooks Connected · Realm #9341457360216187
              </Badge>
            </div>

            {qbLoading && !qbData ? (
              <div className="p-12 text-center text-muted-foreground text-sm flex flex-col items-center justify-center gap-2">
                <RefreshCw className="h-5 w-5 animate-spin text-primary" />
                Loading QuickBooks data…
              </div>
            ) : !qbData ? (
              <div className="p-8 text-center text-muted-foreground text-sm">No QuickBooks data available</div>
            ) : (
              <>
                {/* Top row of 4 stat cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <StatCard label="Revenue (YTD)" value={formatCAD(qbData.pnl?.income || 0)} sub="Total Sales from P&amp;L" />
                  <StatCard label="Expenses (YTD)" value={formatCAD(qbData.pnl?.expenses || 0)} sub="Operating costs from P&amp;L" />
                  <StatCard label="Net Profit" value={formatCAD(qbData.pnl?.netIncome || 0)} sub={`${((qbData.pnl?.income > 0 ? (qbData.pnl?.netIncome / qbData.pnl?.income) * 100 : 0)).toFixed(1)}% Net Margin`} />
                  <StatCard label="Net HST Owed" value={formatCAD(qbData.tax?.netTaxOwed || 0)} sub="CRA #774623375RT0001" />
                </div>

                {/* Live QuickBooks Invoices Table */}
                <div className="bg-card border border-border rounded-xl overflow-hidden">
                  <div className="px-6 py-4 border-b border-border flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-emerald-500" />
                      <h3 className="font-semibold text-sm">QuickBooks Invoices</h3>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {(qbData.invoices || []).length} invoices retrieved
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-muted/30">
                          <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">Invoice #</th>
                          <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Customer</th>
                          <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Date</th>
                          <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Due Date</th>
                          <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Total</th>
                          <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Balance Due</th>
                          <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(qbData.invoices || []).length === 0 ? (
                          <tr>
                            <td colSpan={7} className="px-6 py-8 text-center text-muted-foreground text-sm">
                              No invoices found in QuickBooks.
                            </td>
                          </tr>
                        ) : (
                          (qbData.invoices || []).map((inv: any) => (
                            <tr key={inv.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                              <td className="px-5 py-3.5 font-mono text-xs font-medium">{inv.docNumber}</td>
                              <td className="px-4 py-3.5 font-medium text-foreground">{inv.customerName}</td>
                              <td className="px-4 py-3.5 text-xs text-muted-foreground">{inv.txnDate}</td>
                              <td className="px-4 py-3.5 text-xs text-muted-foreground">{inv.dueDate || '—'}</td>
                              <td className="px-4 py-3.5 text-right font-medium">{formatCAD(inv.totalAmt)}</td>
                              <td className="px-4 py-3.5 text-right font-semibold">
                                {inv.balance > 0 ? (
                                  <span className="text-amber-600">{formatCAD(inv.balance)}</span>
                                ) : (
                                  <span className="text-muted-foreground">$0.00</span>
                                )}
                              </td>
                              <td className="px-4 py-3.5">
                                {inv.status === 'paid' ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                                    Paid ✓
                                  </span>
                                ) : inv.status === 'overdue' ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                                    Overdue
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                                    Awaiting Payment
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Bank & Account Balances and Aged Receivables Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Bank & Account Balances */}
                  <div className="bg-card border border-border rounded-xl p-6">
                    <h3 className="font-semibold text-sm mb-4">Bank &amp; Credit Card Accounts</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border bg-muted/30">
                            <th className="text-left px-4 py-2 font-medium text-muted-foreground">Account Name</th>
                            <th className="text-left px-4 py-2 font-medium text-muted-foreground">Type</th>
                            <th className="text-right px-4 py-2 font-medium text-muted-foreground">Current Balance</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(Array.isArray(qbData.accounts) ? qbData.accounts : []).length === 0 ? (
                            <tr>
                              <td colSpan={3} className="px-4 py-6 text-center text-muted-foreground text-xs">
                                No bank or credit card accounts connected.
                              </td>
                            </tr>
                          ) : (
                            (qbData.accounts || []).map((account: any, i: number) => (
                              <tr key={i} className="border-b border-border/50">
                                <td className="px-4 py-2.5 font-medium">{account.name}</td>
                                <td className="px-4 py-2.5 text-xs text-muted-foreground">{account.type}</td>
                                <td className={`px-4 py-2.5 text-right font-semibold ${account.balance < 0 ? 'text-red-500' : 'text-foreground'}`}>
                                  {formatCAD(account.balance)}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Aged Receivables Card */}
                  <div className="bg-card border border-border rounded-xl p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold text-sm">Aged Receivables (Overdue)</h3>
                      <span className="text-xs font-semibold text-red-500">
                        Total Overdue: {formatCAD(qbData.receivables?.totalOverdue || 0)}
                      </span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border bg-muted/30">
                            <th className="text-left px-4 py-2 font-medium text-muted-foreground">Customer</th>
                            <th className="text-left px-4 py-2 font-medium text-muted-foreground">Inv #</th>
                            <th className="text-right px-4 py-2 font-medium text-muted-foreground">Open Balance</th>
                            <th className="text-right px-4 py-2 font-medium text-muted-foreground">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(qbData.receivables?.rows || []).length === 0 ? (
                            <tr>
                              <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground text-xs">
                                No overdue invoices. Accounts are in good standing!
                              </td>
                            </tr>
                          ) : (
                            (qbData.receivables?.rows || []).map((row: any, i: number) => (
                              <tr key={i} className="border-b border-border/50">
                                <td className="px-4 py-2.5 font-medium">{row.customerName}</td>
                                <td className="px-4 py-2.5 font-mono text-xs">{row.invoiceNumber}</td>
                                <td className="px-4 py-2.5 text-right font-semibold text-amber-600">
                                  {formatCAD(row.openBalance || row.amount)}
                                </td>
                                <td className="px-4 py-2.5 text-right text-xs">
                                  <span className="text-red-500 font-medium">
                                    {row.daysOverdue > 0 ? `${row.daysOverdue}d late` : row.status}
                                  </span>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* HST Tax Tracker card */}
                <div className="bg-card border border-border rounded-xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-semibold text-sm">Ontario HST Tax Tracker</h3>
                      <p className="text-xs text-muted-foreground">Canada Revenue Agency (CRA) • #774623375RT0001</p>
                    </div>
                    <span className="text-sm font-bold text-foreground">
                      Net HST: {formatCAD(qbData.tax?.netTaxOwed || 0)}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                    <div className="p-3 bg-muted/40 rounded-lg">
                      <p className="text-xs text-muted-foreground">HST Collected (Sales)</p>
                      <p className="text-lg font-bold text-red-500">{formatCAD(qbData.tax?.taxCollected || 0)}</p>
                    </div>
                    <div className="p-3 bg-muted/40 rounded-lg">
                      <p className="text-xs text-muted-foreground">Input Tax Credits (ITCs Paid)</p>
                      <p className="text-lg font-bold text-green-600">{formatCAD(qbData.tax?.taxPaid || 0)}</p>
                    </div>
                    <div className="p-3 bg-muted/40 rounded-lg">
                      <p className="text-xs text-muted-foreground">Net HST Owing to CRA</p>
                      <p className="text-lg font-bold text-foreground">{formatCAD(qbData.tax?.netTaxOwed || 0)}</p>
                    </div>
                  </div>
                  {/* Visual Bar */}
                  <div className="space-y-1">
                    <div className="h-3 bg-muted rounded-full overflow-hidden flex">
                      <div 
                        className="bg-red-500 h-full transition-all" 
                        style={{ 
                          width: `${Math.max(0, Math.min(100, ((qbData.tax?.taxCollected || 0) / Math.max(1, (qbData.tax?.taxCollected || 0) + (qbData.tax?.taxPaid || 0))) * 100))}%` 
                        }} 
                      />
                      <div 
                        className="bg-green-500 h-full transition-all" 
                        style={{ 
                          width: `${Math.max(0, Math.min(100, ((qbData.tax?.taxPaid || 0) / Math.max(1, (qbData.tax?.taxCollected || 0) + (qbData.tax?.taxPaid || 0))) * 100))}%` 
                        }} 
                      />
                    </div>
                    <div className="flex justify-between text-[11px] text-muted-foreground">
                      <span>Tax Collected (Sales)</span>
                      <span>Tax Paid (ITCs on Purchases)</span>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Weekly Ad Spend & Marketing P&L Suite */}
      {tab === 'ad_spend' && <AdSpendSuite />}

      {/* Cleaner Payroll Suite */}
      {tab === 'payroll' && <PayrollSuite />}

      {/* Invoicing & Collections Engine */}
      {tab === 'invoicing' && <InvoicingSuite />}

      {/* MRR & Subscriptions */}
      {tab === 'subscriptions' && <SubscriptionSuite />}

      {/* Zone Unit Economics */}
      {tab === 'unit_economics' && <UnitEconomicsSuite />}

      {/* Ontario CRA & WSIB Compliance Vault */}
      {tab === 'compliance' && <ComplianceSuite />}

      {/* Expansion Forecast */}
      {tab === 'forecast' && (
        <div className="space-y-6">
          {!selectedZone ? (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center text-amber-800 text-sm">
              Select a zone from the dropdown above to view forecasts and expansion readiness.
            </div>
          ) : !forecast ? (
            <div className="p-12 text-center text-muted-foreground text-sm">Loading forecast…</div>
          ) : (
            <>
              {/* 3-month projection */}
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-border">
                  <h2 className="font-semibold text-sm">3-Month Revenue Projection</h2>
                </div>
                <div className="grid grid-cols-3 divide-x divide-border">
                  {forecast.forecast.map((m) => (
                    <div key={m.month} className="p-6 text-center">
                      <p className="text-xs text-muted-foreground mb-1">{format(new Date(m.month + '-01'), 'MMMM yyyy')}</p>
                      <p className="text-2xl font-bold">{formatCAD(m.projected_revenue)}</p>
                      <p className="text-xs text-muted-foreground mt-1">{m.projected_jobs} jobs · {formatCAD(m.projected_profit)} profit</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Break-even and readiness */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-card border border-border rounded-xl p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                    <h3 className="font-semibold text-sm">Break-Even Calculator</h3>
                  </div>
                  <p className="text-3xl font-bold">{forecast.break_even_jobs ?? '—'}</p>
                  <p className="text-sm text-muted-foreground mt-1">jobs/month needed at current economics</p>
                  <p className="text-xs text-muted-foreground mt-3">Assumes $2,000/month zone operational costs</p>
                </div>

                {forecast.expansion_score && (
                  <div className="bg-card border border-border rounded-xl p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <Briefcase className="h-4 w-4 text-muted-foreground" />
                        <h3 className="font-semibold text-sm">Expansion Readiness</h3>
                      </div>
                      <ExpansionBadge score={forecast.expansion_score} />
                    </div>
                    <div className="space-y-2">
                      {[
                        { label: 'Jobs/month', value: forecast.expansion_score.jobs_per_month },
                        { label: 'Active employees', value: forecast.expansion_score.employee_count },
                        { label: 'Recurring rate', value: `${forecast.expansion_score.recurring_rate}%` },
                        { label: 'Avg ticket', value: formatCAD(forecast.expansion_score.avg_ticket) },
                        { label: 'Net margin', value: `${forecast.expansion_score.net_margin}%` },
                      ].map((row) => (
                        <div key={row.label} className="flex justify-between text-sm">
                          <span className="text-muted-foreground">{row.label}</span>
                          <span className="font-medium">{row.value}</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4">
                      <div className="flex justify-between text-xs text-muted-foreground mb-1">
                        <span>Readiness score</span>
                        <span>{forecast.expansion_score.score}/100</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            forecast.expansion_score.score >= 70 ? 'bg-green-500'
                            : forecast.expansion_score.score >= 40 ? 'bg-amber-500'
                            : 'bg-red-500'
                          }`}
                          style={{ width: `${forecast.expansion_score.score}%` }}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
