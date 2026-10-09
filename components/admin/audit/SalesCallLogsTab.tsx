'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  PhoneCall,
  Search,
  RefreshCw,
  Clock,
  Sparkles,
  FileText,
  User,
  Building2,
  ChevronDown,
  ChevronUp,
  Headphones,
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface CallEvent {
  event_id?: string;
  id?: string;
  created_at?: string;
  timestamp?: string;
  rep_id?: string;
  rep_name?: string;
  contact_id?: string;
  contact_name?: string;
  company_name?: string;
  phone_number?: string;
  city?: string;
  call_type?: string;
  outcome_type?: string;
  duration_seconds?: number;
  notes?: string;
  ai_summary?: string | string[];
  transcript?: string;
  source?: string;
  recording_url?: string;
}

const OUTCOME_COLORS: Record<string, string> = {
  JOB_WON: 'bg-emerald-500/15 text-emerald-700 border-emerald-300 dark:text-emerald-400 dark:border-emerald-800',
  SALE: 'bg-emerald-500/15 text-emerald-700 border-emerald-300 dark:text-emerald-400 dark:border-emerald-800',
  INFO_SENT: 'bg-sky-500/15 text-sky-700 border-sky-300 dark:text-sky-400 dark:border-sky-800',
  SEND_QUOTE: 'bg-sky-500/15 text-sky-700 border-sky-300 dark:text-sky-400 dark:border-sky-800',
  WALKTHROUGH: 'bg-purple-500/15 text-purple-700 border-purple-300 dark:text-purple-400 dark:border-purple-800',
  CONVO: 'bg-blue-500/15 text-blue-700 border-blue-300 dark:text-blue-400 dark:border-blue-800',
  CALLBACK: 'bg-amber-500/15 text-amber-700 border-amber-300 dark:text-amber-400 dark:border-amber-800',
  NO_ANSWER: 'bg-slate-500/15 text-slate-700 border-slate-300 dark:text-slate-400 dark:border-slate-700',
  VOICEMAIL: 'bg-slate-500/15 text-slate-700 border-slate-300 dark:text-slate-400 dark:border-slate-700',
  NOT_INTERESTED: 'bg-rose-500/15 text-rose-700 border-rose-300 dark:text-rose-400 dark:border-rose-800',
};

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export function SalesCallLogsTab() {
  const [calls, setCalls] = useState<CallEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [outcomeFilter, setOutcomeFilter] = useState('ALL');
  const [repFilter, setRepFilter] = useState('ALL');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchCalls = useCallback(async () => {
    try {
      const res = await fetch('/api/sales/calls');
      if (!res.ok) throw new Error('Failed to fetch call logs');
      const data = await res.json();
      setCalls(data.calls || []);
    } catch (err: any) {
      toast.error(err?.message || 'Error loading call logs');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchCalls();
  }, [fetchCalls]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchCalls();
  };

  // Distinct reps
  const reps = useMemo(() => {
    const set = new Set<string>();
    calls.forEach((c) => {
      if (c.rep_name) set.add(c.rep_name.trim());
    });
    return Array.from(set).sort();
  }, [calls]);

  // Distinct outcomes
  const outcomes = useMemo(() => {
    const set = new Set<string>();
    calls.forEach((c) => {
      if (c.outcome_type) set.add(c.outcome_type.trim());
    });
    return Array.from(set).sort();
  }, [calls]);

  // Filtered calls
  const filteredCalls = useMemo(() => {
    return calls.filter((c) => {
      if (outcomeFilter !== 'ALL' && c.outcome_type !== outcomeFilter) return false;
      if (repFilter !== 'ALL' && c.rep_name !== repFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const contactMatch = (c.contact_name || '').toLowerCase().includes(q);
        const companyMatch = (c.company_name || '').toLowerCase().includes(q);
        const phoneMatch = (c.phone_number || '').includes(q);
        const notesMatch = (c.notes || '').toLowerCase().includes(q);
        const repMatch = (c.rep_name || '').toLowerCase().includes(q);
        if (!contactMatch && !companyMatch && !phoneMatch && !notesMatch && !repMatch) {
          return false;
        }
      }
      return true;
    });
  }, [calls, outcomeFilter, repFilter, search]);

  // High-level summary
  const summary = useMemo(() => {
    const dials = calls.length;
    let connects = 0;
    let infoSent = 0;
    let won = 0;
    let noAnswer = 0;

    calls.forEach((c) => {
      const out = (c.outcome_type || '').toUpperCase();
      if (['CONVO', 'INFO_SENT', 'WALKTHROUGH', 'CALLBACK', 'JOB_WON', 'SALE'].includes(out)) {
        connects++;
      }
      if (out === 'INFO_SENT' || out === 'SEND_QUOTE') infoSent++;
      if (out === 'JOB_WON' || out === 'SALE') won++;
      if (out === 'NO_ANSWER' || out === 'VOICEMAIL') noAnswer++;
    });

    return { dials, connects, infoSent, won, noAnswer };
  }, [calls]);

  return (
    <div className="space-y-6">
      {/* Metrics Header */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="bg-card border-border/70 shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Total Dials</p>
              <p className="text-2xl font-bold mt-0.5 text-foreground">{summary.dials}</p>
            </div>
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
              <PhoneCall className="w-4 h-4" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border/70 shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Connected</p>
              <p className="text-2xl font-bold mt-0.5 text-emerald-600 dark:text-emerald-400">{summary.connects}</p>
            </div>
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
              <Headphones className="w-4 h-4" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border/70 shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">No Answer</p>
              <p className="text-2xl font-bold mt-0.5 text-slate-500">{summary.noAnswer}</p>
            </div>
            <div className="w-9 h-9 rounded-xl bg-slate-500/10 text-slate-500 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border/70 shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Info / Quotes Sent</p>
              <p className="text-2xl font-bold mt-0.5 text-sky-600 dark:text-sky-400">{summary.infoSent}</p>
            </div>
            <div className="w-9 h-9 rounded-xl bg-sky-500/10 text-sky-600 flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border/70 shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Jobs Won</p>
              <p className="text-2xl font-bold mt-0.5 text-purple-600 dark:text-purple-400">{summary.won}</p>
            </div>
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter & Search Bar */}
      <Card className="bg-card border-border/70 shadow-xs">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
            <div className="flex-1 flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search contact, company, phone, notes..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 h-9 text-xs"
                />
              </div>

              {/* Outcome filter */}
              <Select value={outcomeFilter} onValueChange={setOutcomeFilter}>
                <SelectTrigger className="w-full sm:w-[170px] h-9 text-xs">
                  <SelectValue placeholder="Outcome" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Outcomes</SelectItem>
                  {outcomes.map((o) => (
                    <SelectItem key={o} value={o}>
                      {o}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Rep filter */}
              <Select value={repFilter} onValueChange={setRepFilter}>
                <SelectTrigger className="w-full sm:w-[170px] h-9 text-xs">
                  <SelectValue placeholder="Sales Rep" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Reps</SelectItem>
                  {reps.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing}
              className="h-9 gap-1.5 text-xs self-end md:self-auto"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Call History Table */}
      <Card className="bg-card border-border/70 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-border/70 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PhoneCall className="w-4 h-4 text-blue-600" />
            <h2 className="font-semibold text-sm text-foreground">Commercial Call History</h2>
            <Badge variant="secondary" className="font-mono text-xs">
              {filteredCalls.length} {filteredCalls.length === 1 ? 'call' : 'calls'}
            </Badge>
          </div>
        </div>

        {loading ? (
          <div className="py-16 text-center text-sm text-muted-foreground flex flex-col items-center justify-center gap-2">
            <RefreshCw className="w-5 h-5 animate-spin text-muted-foreground/60" />
            <span>Loading commercial call logs...</span>
          </div>
        ) : filteredCalls.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground border-dashed border-border/60">
            No call logs found matching your filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/50 border-b border-border/60 text-muted-foreground font-semibold">
                <tr>
                  <th className="py-3 px-4">Date &amp; Time</th>
                  <th className="py-3 px-4">Target Contact</th>
                  <th className="py-3 px-4">Rep / Source</th>
                  <th className="py-3 px-4">Outcome</th>
                  <th className="py-3 px-4">Duration</th>
                  <th className="py-3 px-4">Notes &amp; Audio / Transcripts</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {filteredCalls.map((call, idx) => {
                  const callKey = call.event_id || call.id || `call-${idx}`;
                  const isExpanded = expandedId === callKey;
                  const dateStr = call.created_at || call.timestamp;
                  const formattedDate = dateStr
                    ? format(new Date(dateStr), 'MMM d, yyyy h:mm a')
                    : 'Unknown time';

                  const outcomeStyle =
                    OUTCOME_COLORS[call.outcome_type || ''] ||
                    'bg-slate-500/10 text-slate-600 border-slate-300 dark:text-slate-400';

                  const hasAiSummary = Boolean(call.ai_summary);
                  const hasTranscript = Boolean(call.transcript);

                  return (
                    <tr
                      key={callKey}
                      className="hover:bg-muted/30 transition-colors group"
                    >
                      {/* Date & Time */}
                      <td className="py-3 px-4 whitespace-nowrap text-muted-foreground font-mono">
                        {formattedDate}
                      </td>

                      {/* Contact & Company */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-foreground flex items-center gap-1.5">
                          <span>{call.contact_name || 'Prospect'}</span>
                          {call.source === 'quo_webhook' && (
                            <Badge
                              variant="outline"
                              className="text-[9px] px-1.5 py-0 bg-emerald-500/10 text-emerald-600 border-emerald-300 dark:border-emerald-800 font-mono"
                            >
                              Quo VoIP
                            </Badge>
                          )}
                        </div>
                        {call.company_name && (
                          <div className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                            <Building2 className="w-3 h-3 text-muted-foreground/70" />
                            <span>{call.company_name}</span>
                          </div>
                        )}
                        <div className="text-[11px] text-muted-foreground font-mono mt-0.5">
                          {call.phone_number || 'No phone'}
                        </div>
                      </td>

                      {/* Rep */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-muted text-foreground font-medium text-[11px]">
                          <User className="w-3 h-3 text-muted-foreground" />
                          <span>{call.rep_name || 'Malik Campbell'}</span>
                        </div>
                      </td>

                      {/* Outcome Badge */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <Badge
                          variant="outline"
                          className={`font-mono text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 ${outcomeStyle}`}
                        >
                          {call.outcome_type || 'DIALED'}
                        </Badge>
                      </td>

                      {/* Duration */}
                      <td className="py-3 px-4 whitespace-nowrap font-mono text-muted-foreground">
                        {formatDuration(call.duration_seconds || 0)}
                      </td>

                      {/* Notes & Intelligence */}
                      <td className="py-3 px-4 max-w-md">
                        {call.notes && (
                          <p className="text-foreground/90 text-xs mb-1 line-clamp-2">
                            {call.notes}
                          </p>
                        )}

                        {/* Collapsible AI Summary & Transcript */}
                        {(hasAiSummary || hasTranscript) && (
                          <div className="mt-1 space-y-1.5">
                            <button
                              type="button"
                              onClick={() => setExpandedId(isExpanded ? null : callKey)}
                              className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                            >
                              <Sparkles className="w-3 h-3 text-amber-500" />
                              <span>
                                {isExpanded ? 'Hide AI Transcript & Summary' : 'View AI Summary & Transcript'}
                              </span>
                              {isExpanded ? (
                                <ChevronUp className="w-3 h-3" />
                              ) : (
                                <ChevronDown className="w-3 h-3" />
                              )}
                            </button>

                            {isExpanded && (
                              <div className="p-3 rounded-lg bg-muted/60 border border-border/80 text-xs space-y-2.5 animate-in fade-in duration-150">
                                {hasAiSummary && (
                                  <div className="space-y-1">
                                    <span className="font-bold text-blue-600 dark:text-blue-400 block uppercase text-[10px] tracking-wider">
                                      Sona AI Summary
                                    </span>
                                    {Array.isArray(call.ai_summary) ? (
                                      <ul className="list-disc pl-4 space-y-0.5 text-foreground/90">
                                        {call.ai_summary.map((b, i) => (
                                          <li key={i}>{b}</li>
                                        ))}
                                      </ul>
                                    ) : (
                                      <p className="text-foreground/90">{call.ai_summary}</p>
                                    )}
                                  </div>
                                )}

                                {hasTranscript && (
                                  <div className="space-y-1 pt-1.5 border-t border-border/60">
                                    <span className="font-bold text-muted-foreground block uppercase text-[10px] tracking-wider">
                                      Full Call Transcript
                                    </span>
                                    <div className="p-2 max-h-36 overflow-y-auto font-mono text-[10px] whitespace-pre-wrap text-foreground/80 bg-background/80 rounded border border-border/60">
                                      {call.transcript}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
