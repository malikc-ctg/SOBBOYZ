'use client';

import { useState, useEffect } from 'react';
import { DollarSign, TrendingUp, TrendingDown, Target, Plus, RefreshCw, Layers, Calendar, MessageSquare, BarChart2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { AdSpendLog, AdSpendChannel, Zone } from '@/types';
import { AD_SPEND_CHANNEL_LABELS } from '@/types';

function formatCAD(val: number) {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 2 }).format(val);
}

const CHANNELS: Array<{ id: AdSpendChannel | 'all'; label: string }> = [
  { id: 'all', label: 'All Channels' },
  { id: 'lsa', label: 'Google Local Services Ads (LSA)' },
  { id: 'meta', label: 'Meta (FB & IG)' },
  { id: 'google_ads', label: 'Google Search Ads' },
  { id: 'tiktok', label: 'TikTok Ads' },
  { id: 'flyers', label: 'Flyers & Direct Mail' },
  { id: 'other', label: 'Other Marketing' },
];

export function AdSpendSuite() {
  const [logs, setLogs] = useState<AdSpendLog[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedChannel, setSelectedChannel] = useState<AdSpendChannel | 'all'>('all');
  const [selectedZone, setSelectedZone] = useState<string>('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // New Log Form State
  const [formChannel, setFormChannel] = useState<AdSpendChannel>('lsa');
  const [formZoneId, setFormZoneId] = useState<string>('');
  const [formWeekStart, setFormWeekStart] = useState<string>('');
  const [formWeekEnd, setFormWeekEnd] = useState<string>('');
  const [formAmount, setFormAmount] = useState<string>('');
  const [formConversions, setFormConversions] = useState<string>('');
  const [formNotes, setFormNotes] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedChannel !== 'all') params.append('channel', selectedChannel);
      if (selectedZone) params.append('zone_id', selectedZone);

      const res = await fetch(`/api/finance/ad-spend${params.toString() ? `?${params.toString()}` : ''}`);
      const data = await res.json();
      if (data?.data) {
        setLogs(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch ad spend logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetch('/api/zones').then(r => r.json()).then(d => setZones(Array.isArray(d) ? d : []));
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [selectedChannel, selectedZone]);

  // Calculations
  const filteredLogs = logs.filter(l => {
    if (selectedChannel !== 'all' && l.channel !== selectedChannel) return false;
    if (selectedZone && l.zone_id && l.zone_id !== selectedZone) return false;
    return true;
  });

  const totalSpend = filteredLogs.reduce((sum, r) => sum + (r.amount || 0), 0);
  const totalLeads = filteredLogs.reduce((sum, r) => sum + (r.conversions || 0), 0);
  const avgWeeklySpend = filteredLogs.length > 0 ? totalSpend / filteredLogs.length : 0;
  const costPerLead = totalLeads > 0 ? totalSpend / totalLeads : 0;

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formWeekStart || !formWeekEnd || !formAmount) {
      setFormError('Please enter start date, end date, and spend amount.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/finance/ad-spend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: formChannel,
          zone_id: formZoneId || null,
          week_start_date: formWeekStart,
          week_end_date: formWeekEnd,
          amount: parseFloat(formAmount),
          conversions: formConversions ? parseInt(formConversions, 10) : 0,
          notes: formNotes || null,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData?.error || 'Failed to record ad spend');
      }

      setShowAddModal(false);
      // Reset form
      setFormAmount('');
      setFormConversions('');
      setFormNotes('');
      fetchLogs();
    } catch (err: any) {
      setFormError(err.message || 'An error occurred while saving.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Controls Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-card p-4 rounded-xl border border-border">
        <div>
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Weekly Ad Spend &amp; Marketing P&amp;L
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Track weekly ad spend across channels (LSA, Meta, Google) and evaluate net profitability &amp; CPL
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <select
            className="text-xs border border-border rounded-lg px-3 py-2 bg-background font-medium"
            value={selectedChannel}
            onChange={(e) => setSelectedChannel(e.target.value as any)}
          >
            {CHANNELS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>

          <select
            className="text-xs border border-border rounded-lg px-3 py-2 bg-background font-medium"
            value={selectedZone}
            onChange={(e) => setSelectedZone(e.target.value)}
          >
            <option value="">All zones</option>
            {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
          </select>

          <button
            onClick={() => fetchLogs()}
            className="p-2 border border-border rounded-lg hover:bg-muted transition-colors text-muted-foreground"
            title="Refresh logs"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-lg hover:bg-primary/90 transition-colors shadow-sm"
          >
            <Plus className="h-4 w-4" />
            Log Weekly Spend
          </button>
        </div>
      </div>

      {/* Metric Cards Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-xl p-5">
          <p className="text-xs font-medium text-muted-foreground mb-1">Total All-Time Spend</p>
          <p className="text-2xl font-bold text-foreground">{formatCAD(totalSpend)}</p>
          <p className="text-xs text-muted-foreground mt-1">{filteredLogs.length} weekly entries logged</p>
        </div>

        <div className="bg-card border border-border rounded-xl p-5">
          <p className="text-xs font-medium text-muted-foreground mb-1">Leads Acquired</p>
          <p className="text-2xl font-bold text-blue-600">{totalLeads} leads</p>
          <p className="text-xs text-muted-foreground mt-1">From recorded ad campaigns</p>
        </div>

        <div className="bg-card border border-border rounded-xl p-5">
          <p className="text-xs font-medium text-muted-foreground mb-1">Blended Cost Per Lead (CPL)</p>
          <p className="text-2xl font-bold text-emerald-600">{formatCAD(costPerLead)}</p>
          <p className="text-xs text-muted-foreground mt-1">Avg cost per generated lead</p>
        </div>

        <div className="bg-card border border-border rounded-xl p-5">
          <p className="text-xs font-medium text-muted-foreground mb-1">Avg Weekly Spend</p>
          <p className="text-2xl font-bold text-foreground">{formatCAD(avgWeeklySpend)}</p>
          <p className="text-xs text-muted-foreground mt-1">Across active weekly cycles</p>
        </div>
      </div>

      {/* LSA All-Time Report Banner */}
      <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-blue-950">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg shrink-0">
            <BarChart2 className="h-5 w-5 text-blue-700" />
          </div>
          <div>
            <h4 className="text-sm font-bold">Google Local Services Ads (LSA) — All-Time Verified Ledger</h4>
            <p className="text-xs text-blue-800 mt-0.5">
              Billing Report (June 7 - August 31, 2026): <strong>CA$5,641.75 total spend</strong> generating <strong>218 qualified leads</strong>.
            </p>
          </div>
        </div>
        <Badge className="bg-blue-600 text-white hover:bg-blue-700 self-start sm:self-center shrink-0">
          Verified LSA Data
        </Badge>
      </div>

      {/* Weekly Ad Spend Table Card */}
      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-semibold text-sm">Weekly Ad Spend Log History</h3>
          </div>
          <span className="text-xs text-muted-foreground">
            Showing {filteredLogs.length} weeks
          </span>
        </div>

        {loading && filteredLogs.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground text-sm flex flex-col items-center justify-center gap-2">
            <RefreshCw className="h-5 w-5 animate-spin text-primary" />
            Loading weekly ad spend records…
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground text-sm">
            No weekly ad spend entries found matching the filter criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-6 py-3 text-xs font-medium text-muted-foreground">Week Range</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Channel</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Zone</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Spend (CAD)</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Leads / Conv.</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Cost per Lead</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-muted-foreground">Notes / Adjustments</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log, idx) => {
                  const cpl = log.conversions && log.conversions > 0 ? log.amount / log.conversions : 0;
                  return (
                    <tr key={log.id || idx} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                      <td className="px-6 py-3.5 font-medium font-mono text-xs">
                        {log.week_start_date} → {log.week_end_date}
                      </td>
                      <td className="px-4 py-3.5">
                        <Badge variant="outline" className={`text-xs ${
                          log.channel === 'lsa' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                          log.channel === 'meta' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                          log.channel === 'google_ads' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                          'bg-gray-50 text-gray-700 border-gray-200'
                        }`}>
                          {AD_SPEND_CHANNEL_LABELS[log.channel] || log.channel.toUpperCase()}
                        </Badge>
                      </td>
                      <td className="px-4 py-3.5 text-xs text-muted-foreground">
                        {log.zone?.name || (log.zone_id ? log.zone_id.slice(0, 8) : 'All Zones (Global)')}
                      </td>
                      <td className="px-4 py-3.5 text-right font-bold text-foreground">
                        {formatCAD(log.amount)}
                      </td>
                      <td className="px-4 py-3.5 text-right font-medium text-blue-600">
                        {log.conversions ? `${log.conversions} leads` : '—'}
                      </td>
                      <td className="px-4 py-3.5 text-right font-medium text-muted-foreground">
                        {cpl > 0 ? formatCAD(cpl) : '—'}
                      </td>
                      <td className="px-6 py-3.5 text-xs text-muted-foreground max-w-xs truncate" title={log.notes || undefined}>
                        {log.notes || '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal for adding ad spend entry */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-card border border-border rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="font-bold text-base text-foreground">Record Weekly Ad Spend</h3>
              <button onClick={() => setShowAddModal(false)} className="text-muted-foreground hover:text-foreground text-sm font-semibold">✕</button>
            </div>

            {formError && (
              <div className="bg-red-50 text-red-700 text-xs p-3 rounded-lg border border-red-200">
                {formError}
              </div>
            )}

            <form onSubmit={handleAddSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-muted-foreground mb-1 font-medium">Marketing Channel</label>
                <select
                  value={formChannel}
                  onChange={(e) => setFormChannel(e.target.value as AdSpendChannel)}
                  className="w-full border border-border rounded-lg px-3 py-2 bg-background font-medium"
                >
                  <option value="lsa">Google Local Services Ads (LSA)</option>
                  <option value="meta">Meta (Facebook &amp; Instagram)</option>
                  <option value="google_ads">Google Search Ads</option>
                  <option value="tiktok">TikTok Ads</option>
                  <option value="flyers">Flyers &amp; Direct Mail</option>
                  <option value="other">Other Marketing</option>
                </select>
              </div>

              <div>
                <label className="block text-muted-foreground mb-1 font-medium">Zone Allocation (Optional)</label>
                <select
                  value={formZoneId}
                  onChange={(e) => setFormZoneId(e.target.value)}
                  className="w-full border border-border rounded-lg px-3 py-2 bg-background font-medium"
                >
                  <option value="">All Zones (Global Campaign)</option>
                  {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-muted-foreground mb-1 font-medium">Week Start Date</label>
                  <input
                    type="date"
                    required
                    value={formWeekStart}
                    onChange={(e) => setFormWeekStart(e.target.value)}
                    className="w-full border border-border rounded-lg px-3 py-2 bg-background font-medium"
                  />
                </div>
                <div>
                  <label className="block text-muted-foreground mb-1 font-medium">Week End Date</label>
                  <input
                    type="date"
                    required
                    value={formWeekEnd}
                    onChange={(e) => setFormWeekEnd(e.target.value)}
                    className="w-full border border-border rounded-lg px-3 py-2 bg-background font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-muted-foreground mb-1 font-medium">Amount Spent (CAD $)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="e.g. 500.00"
                    value={formAmount}
                    onChange={(e) => setFormAmount(e.target.value)}
                    className="w-full border border-border rounded-lg px-3 py-2 bg-background font-medium"
                  />
                </div>
                <div>
                  <label className="block text-muted-foreground mb-1 font-medium">Leads / Conversions</label>
                  <input
                    type="number"
                    placeholder="e.g. 12"
                    value={formConversions}
                    onChange={(e) => setFormConversions(e.target.value)}
                    className="w-full border border-border rounded-lg px-3 py-2 bg-background font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-muted-foreground mb-1 font-medium">Notes / Campaign Details</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Summer promotion code credit applied..."
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full border border-border rounded-lg px-3 py-2 bg-background font-medium resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-border rounded-lg text-muted-foreground hover:bg-muted font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary/90 transition-colors shadow-xs"
                >
                  {isSubmitting ? 'Saving…' : 'Save Ad Spend Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
