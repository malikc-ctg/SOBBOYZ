import React, { useState, useMemo } from 'react';
import {
  Phone,
  Mail,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Search,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  User,
  Building2,
  Calendar,
  Check,
  Copy,
  Flame,
  Settings,
} from 'lucide-react';
import { toast } from 'sonner';
import { gmailComposeUrl, gmailSearchUrl } from '@/lib/sales/followups/compose';
import { renderEmail } from '@/lib/sales/followups/render';
import { resolveRepConfig } from '@/lib/sales/followups/config';
import {
  isTaskOverdue,
  getDueBucket,
  formatTorontoShortDay,
  formatTorontoTime,
} from '@/lib/sales/followups/schedule';

export default function TouchCentreView({
  contacts = [],
  followupsByLeadId = {},
  followupMeta,
  user,
  onStartCall,
  onOpenDossier,
  onRefreshFollowups,
  onOpenFollowupSettings,
  onOpenCallbackModal,
  onOpenVisitResultModal,
}) {
  const [repFilter, setRepFilter] = useState('mine'); // 'mine' | 'all'
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'overdue' | 'due_today' | 'upcoming' | 'needs_attention'
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  const repSettings = followupMeta?.repSettings;
  const mailingAddressSet = followupMeta?.mailingAddressSet;

  const handleRefresh = async () => {
    setRefreshing(true);
    if (onRefreshFollowups) await onRefreshFollowups();
    setTimeout(() => setRefreshing(false), 400);
  };

  const handleCopy = (text, id) => {
    if (!text) return;
    navigator.clipboard?.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  // Build the complete list of actionable leads with their next pending task
  const allTouchItems = useMemo(() => {
    const items = [];
    const now = new Date();

    contacts.forEach((contact) => {
      const fu = followupsByLeadId[contact.id];
      if (!fu) return;

      const enrs = fu.enrollments || [];
      const openEnr = enrs.find((e) => ['active', 'held', 'paused'].includes(e.status));
      const nextTask = fu.nextTask;
      const flags = fu.flags || {};

      // If there is no open enrollment and no pending task, skip unless flagged
      if (!openEnr && !nextTask) return;

      // Determine assigned rep
      const effectiveRep = resolveRepConfig(
        user?.id ||
        nextTask?.assigned_rep_id ||
        openEnr?.owner_rep_id ||
        repSettings?.rep_id ||
        repSettings?.signature_name
      );

      const isMine = Boolean(
        user?.id &&
        (nextTask?.assigned_rep_id === user.id ||
          (!nextTask && openEnr?.owner_rep_id === user.id) ||
          effectiveRep.auth_user_id === user.id)
      );

      // Check needs_attention state:
      const isHeld = openEnr?.status === 'held';
      const isPaused = openEnr?.status === 'paused';
      const isBounced = Boolean(flags.bounced_email);
      const isNeedsEmail = Boolean(flags.needs_email_since && !flags.email_opt_out_at);
      const isOpenedUnsent = nextTask?.kind === 'email' && Boolean(nextTask.opened_at);
      const needsAttention = isHeld || isPaused || isBounced || isNeedsEmail || isOpenedUnsent;

      let dueBucket = 'later';
      let overdue = false;

      if (nextTask) {
        dueBucket = getDueBucket(nextTask, now);
        overdue = isTaskOverdue(nextTask, now);
      } else if (needsAttention) {
        dueBucket = 'needs_attention';
      }

      // Pre-compute Gmail Compose URL if email task
      let composeInfo = null;
      if (nextTask?.kind === 'email' && nextTask?.template_key && contact.email && mailingAddressSet) {
        try {
          const rendered = renderEmail({
            templateKey: nextTask.template_key,
            lead: {
              customer_name: contact.name,
              company_name: contact.company,
              city: contact.city,
              sector: contact.sector,
            },
            rep: {
              signature_name: effectiveRep.name,
              signature_title: effectiveRep.title,
              signature_phone: effectiveRep.phone,
            },
            context: openEnr?.context || {},
            anchorAt: openEnr?.anchor_at,
            mailingAddressOverride: repSettings?.mailingAddress || undefined,
          });

          composeInfo = {
            rendered,
            compose: gmailComposeUrl({
              from: effectiveRep.gmail_address || undefined,
              to: contact.email,
              subject: rendered.subject,
              body: rendered.body,
            }),
            search: gmailSearchUrl({
              from: effectiveRep.gmail_address || undefined,
              leadEmail: contact.email,
            }),
          };
        } catch {
          composeInfo = null;
        }
      }

      items.push({
        contact,
        fu,
        openEnr,
        nextTask,
        flags,
        effectiveRep,
        isMine,
        dueBucket,
        overdue,
        needsAttention,
        isHeld,
        isPaused,
        isBounced,
        isNeedsEmail,
        isOpenedUnsent,
        composeInfo,
        dueSortValue: nextTask ? new Date(nextTask.due_at).getTime() : 9999999999999,
      });
    });

    // Sort priority: Overdue first, then Due Today (by due time), then Upcoming, then Needs Attention
    return items.sort((a, b) => {
      const rank = (item) => {
        if (item.overdue || item.dueBucket === 'overdue') return 1;
        if (item.dueBucket === 'due_today') return 2;
        if (item.dueBucket === 'upcoming') return 3;
        if (item.needsAttention) return 4;
        return 5;
      };
      const rA = rank(a);
      const rB = rank(b);
      if (rA !== rB) return rA - rB;
      return a.dueSortValue - b.dueSortValue;
    });
  }, [contacts, followupsByLeadId, user?.id, repSettings, mailingAddressSet]);

  // Counts for KPIs
  const counts = useMemo(() => {
    const list = repFilter === 'mine' ? allTouchItems.filter((i) => i.isMine) : allTouchItems;
    let overdue = 0;
    let dueToday = 0;
    let upcoming = 0;
    let needsAttention = 0;

    list.forEach((i) => {
      if (i.overdue || i.dueBucket === 'overdue') overdue++;
      else if (i.dueBucket === 'due_today') dueToday++;
      else if (i.dueBucket === 'upcoming') upcoming++;
      else if (i.needsAttention) needsAttention++;
    });

    const mineTotal = allTouchItems.filter((i) => i.isMine).length;
    const allTotal = allTouchItems.length;

    return { overdue, dueToday, upcoming, needsAttention, mineTotal, allTotal, total: list.length };
  }, [allTouchItems, repFilter]);

  // Filtered touch items
  const filteredItems = useMemo(() => {
    return allTouchItems.filter((item) => {
      // Rep filter
      if (repFilter === 'mine' && !item.isMine) return false;

      // Status bucket filter
      if (statusFilter === 'overdue' && !item.overdue && item.dueBucket !== 'overdue') return false;
      if (statusFilter === 'due_today' && item.dueBucket !== 'due_today') return false;
      if (statusFilter === 'upcoming' && item.dueBucket !== 'upcoming') return false;
      if (statusFilter === 'needs_attention' && !item.needsAttention) return false;

      // Search matching
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const nameMatch = (item.contact.name || '').toLowerCase().includes(q);
        const compMatch = (item.contact.company || '').toLowerCase().includes(q);
        const phoneMatch = (item.contact.phone || '').includes(q);
        const titleMatch = (item.nextTask?.title || '').toLowerCase().includes(q);
        const repMatch = (item.effectiveRep.name || '').toLowerCase().includes(q);
        if (!nameMatch && !compMatch && !phoneMatch && !titleMatch && !repMatch) {
          return false;
        }
      }

      return true;
    });
  }, [allTouchItems, repFilter, statusFilter, searchQuery]);

  // Task actions handlers
  const handleOpenEmail = async (item) => {
    if (!item.nextTask) return;
    try {
      fetch(`/api/sales/followups/tasks/${item.nextTask.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'open' }),
      }).catch(() => {});
    } catch {}
  };

  const handleMarkSent = async (item) => {
    if (!item.nextTask) return;
    setActionLoadingId(item.nextTask.id);
    try {
      const res = await fetch(`/api/sales/followups/tasks/${item.nextTask.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'sent',
          subject: item.composeInfo?.rendered?.subject || item.nextTask.title,
          body: item.composeInfo?.rendered?.body || '',
          to: item.contact.email,
        }),
      });
      if (!res.ok) throw new Error('Failed to mark sent');
      toast.success(`Follow-up sent for ${item.contact.name}!`, {
        description: 'Next sequence step scheduled.',
      });
      if (onRefreshFollowups) onRefreshFollowups();
    } catch (err) {
      toast.error(err?.message || 'Error marking sent');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleSkip = async (item) => {
    if (!item.nextTask) return;
    setActionLoadingId(item.nextTask.id);
    try {
      const res = await fetch(`/api/sales/followups/tasks/${item.nextTask.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'skip' }),
      });
      if (!res.ok) throw new Error('Failed to skip step');
      toast.info(`Skipped step for ${item.contact.name}`);
      if (onRefreshFollowups) onRefreshFollowups();
    } catch (err) {
      toast.error(err?.message || 'Error skipping step');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDone = async (item) => {
    if (!item.nextTask) return;
    setActionLoadingId(item.nextTask.id);
    try {
      const res = await fetch(`/api/sales/followups/tasks/${item.nextTask.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'done' }),
      });
      if (!res.ok) throw new Error('Failed to complete task');
      toast.success(`Completed task for ${item.contact.name}`);
      if (onRefreshFollowups) onRefreshFollowups();
    } catch (err) {
      toast.error(err?.message || 'Error completing task');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleStartHeld = async (item) => {
    if (!item.openEnr) return;
    try {
      const res = await fetch(`/api/sales/followups/lead/${item.contact.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start_held', enrollmentId: item.openEnr.id }),
      });
      if (!res.ok) throw new Error('Failed to start held follow-up');
      toast.success('Follow-up activated');
      if (onRefreshFollowups) onRefreshFollowups();
    } catch (err) {
      toast.error(err?.message || 'Failed');
    }
  };

  const handleResume = async (item) => {
    try {
      const res = await fetch(`/api/sales/followups/lead/${item.contact.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'resume' }),
      });
      if (!res.ok) throw new Error('Failed to resume');
      toast.success('Follow-up resumed');
      if (onRefreshFollowups) onRefreshFollowups();
    } catch (err) {
      toast.error(err?.message || 'Failed');
    }
  };

  const handleStop = async (item) => {
    if (!item.openEnr) return;
    try {
      const res = await fetch(`/api/sales/followups/lead/${item.contact.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'stop', enrollmentId: item.openEnr.id }),
      });
      if (!res.ok) throw new Error('Failed to stop follow-up');
      toast.info('Follow-up stopped');
      if (onRefreshFollowups) onRefreshFollowups();
    } catch (err) {
      toast.error(err?.message || 'Failed');
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-2 sm:p-4 font-sans text-slate-100">
      {/* Top Banner & Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-[#01162b] to-[#04284d] border border-blue-900/60 shadow-lg">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400 shrink-0 shadow-inner">
            <Flame className="w-6 h-6 text-amber-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                Touch Centre
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 uppercase tracking-wider">
                Follow-up Command
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              Daily high-velocity touch queue. Execute stage-accurate emails, scheduled callbacks, and confirmations.
            </p>
          </div>
        </div>

        {/* Rep Selector & Action Controls */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Mine vs All Reps Toggle */}
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 shadow-inner">
            <button
              type="button"
              onClick={() => setRepFilter('mine')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                repFilter === 'mine'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>My Touches</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-blue-950/80 text-blue-200 border border-blue-800">
                {counts.mineTotal}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setRepFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                repFilter === 'all'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>All Reps</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-slate-900 text-slate-300 border border-slate-800">
                {counts.allTotal}
              </span>
            </button>
          </div>

          {/* Refresh button */}
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition cursor-pointer"
            title="Refresh touch queue"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin text-blue-400' : ''} />
          </button>

          {/* Follow-up settings */}
          {onOpenFollowupSettings && (
            <button
              type="button"
              onClick={onOpenFollowupSettings}
              className="p-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition cursor-pointer"
              title="Touch Centre settings & signature"
            >
              <Settings size={14} />
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards: Overdue, Due Today, Upcoming, Needs Attention */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Overdue */}
        <button
          type="button"
          onClick={() => setStatusFilter(statusFilter === 'overdue' ? 'all' : 'overdue')}
          className={`p-4 rounded-2xl text-left transition border cursor-pointer ${
            statusFilter === 'overdue'
              ? 'bg-rose-950/40 border-rose-500 shadow-md shadow-rose-950/50'
              : 'bg-[#01162b] border-rose-900/40 hover:border-rose-700/60'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-rose-400 uppercase tracking-wider">
              Overdue
            </span>
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-rose-200 mt-1">
            {counts.overdue}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            Needs immediate outreach
          </div>
        </button>

        {/* Due Today */}
        <button
          type="button"
          onClick={() => setStatusFilter(statusFilter === 'due_today' ? 'all' : 'due_today')}
          className={`p-4 rounded-2xl text-left transition border cursor-pointer ${
            statusFilter === 'due_today'
              ? 'bg-amber-950/40 border-amber-500 shadow-md shadow-amber-950/50'
              : 'bg-[#01162b] border-amber-900/40 hover:border-amber-700/60'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
              Due Today
            </span>
            <Clock size={13} className="text-amber-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-amber-200 mt-1">
            {counts.dueToday}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            Today&apos;s action punch-list
          </div>
        </button>

        {/* Upcoming */}
        <button
          type="button"
          onClick={() => setStatusFilter(statusFilter === 'upcoming' ? 'all' : 'upcoming')}
          className={`p-4 rounded-2xl text-left transition border cursor-pointer ${
            statusFilter === 'upcoming'
              ? 'bg-blue-950/40 border-blue-500 shadow-md shadow-blue-950/50'
              : 'bg-[#01162b] border-blue-900/40 hover:border-blue-700/60'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">
              Upcoming
            </span>
            <Calendar size={13} className="text-blue-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-blue-200 mt-1">
            {counts.upcoming}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            Next 2 to 7 days
          </div>
        </button>

        {/* Needs Attention */}
        <button
          type="button"
          onClick={() => setStatusFilter(statusFilter === 'needs_attention' ? 'all' : 'needs_attention')}
          className={`p-4 rounded-2xl text-left transition border cursor-pointer ${
            statusFilter === 'needs_attention'
              ? 'bg-purple-950/40 border-purple-500 shadow-md shadow-purple-950/50'
              : 'bg-[#01162b] border-purple-900/40 hover:border-purple-700/60'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-purple-400 uppercase tracking-wider">
              Needs Attention
            </span>
            <AlertTriangle size={13} className="text-purple-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-purple-200 mt-1">
            {counts.needsAttention}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            Bounced, held, missing email
          </div>
        </button>
      </div>

      {/* Filter Chips Bar & Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 rounded-2xl bg-[#01162b] border border-slate-800">
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              statusFilter === 'all'
                ? 'bg-slate-800 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            All Touches ({counts.total})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('overdue')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              statusFilter === 'overdue'
                ? 'bg-rose-950 text-rose-200 border border-rose-800'
                : 'text-rose-400 hover:text-rose-300'
            }`}
          >
            <span>Overdue</span>
            <span className="px-1.5 py-0.2 rounded font-mono text-[10px] bg-rose-900/60">
              {counts.overdue}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('due_today')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              statusFilter === 'due_today'
                ? 'bg-amber-950 text-amber-200 border border-amber-800'
                : 'text-amber-400 hover:text-amber-300'
            }`}
          >
            <span>Due Today</span>
            <span className="px-1.5 py-0.2 rounded font-mono text-[10px] bg-amber-900/60">
              {counts.dueToday}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('upcoming')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              statusFilter === 'upcoming'
                ? 'bg-blue-950 text-blue-200 border border-blue-800'
                : 'text-blue-400 hover:text-blue-300'
            }`}
          >
            <span>Upcoming</span>
            <span className="px-1.5 py-0.2 rounded font-mono text-[10px] bg-blue-900/60">
              {counts.upcoming}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('needs_attention')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              statusFilter === 'needs_attention'
                ? 'bg-purple-950 text-purple-200 border border-purple-800'
                : 'text-purple-400 hover:text-purple-300'
            }`}
          >
            <span>Needs Attention</span>
            <span className="px-1.5 py-0.2 rounded font-mono text-[10px] bg-purple-900/60">
              {counts.needsAttention}
            </span>
          </button>
        </div>

        {/* Search Input */}
        <div className="relative min-w-[240px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search contact, company, phone..."
            className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-600 transition"
          />
        </div>
      </div>

      {/* Touch Queue List */}
      <div className="space-y-3">
        {filteredItems.length === 0 ? (
          <div className="p-12 text-center rounded-2xl bg-[#01162b] border border-dashed border-slate-800 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-950/60 border border-emerald-800/80 mx-auto flex items-center justify-center text-emerald-400">
              <CheckCircle2 size={24} />
            </div>
            <div className="max-w-md mx-auto">
              <h3 className="font-bold text-white text-base">Touch Queue Clear</h3>
              <p className="text-xs text-slate-400 mt-1">
                {statusFilter === 'all'
                  ? "You're completely caught up! No pending follow-ups or touches in this view."
                  : `No touches currently matching the "${statusFilter.replace('_', ' ')}" filter.`}
              </p>
            </div>
          </div>
        ) : (
          filteredItems.map((item) => {
            const { contact, nextTask, openEnr, effectiveRep, dueBucket, overdue, composeInfo } = item;
            const isEmail = nextTask?.kind === 'email';
            const isCall = nextTask?.kind === 'call';
            const isTodo = nextTask?.kind === 'todo';
            const taskLoading = actionLoadingId === nextTask?.id;

            // Compute due badge label
            let dueBadgeText = 'Due soon';
            let dueBadgeClass = 'bg-blue-950/80 text-blue-300 border-blue-800/80';

            if (overdue || dueBucket === 'overdue') {
              dueBadgeText = 'Overdue';
              dueBadgeClass = 'bg-rose-950/90 text-rose-300 border-rose-800/90 font-bold';
            } else if (dueBucket === 'due_today') {
              dueBadgeText = nextTask?.kind === 'call'
                ? `Today ${formatTorontoTime(nextTask.due_at)}`
                : 'Due today';
              dueBadgeClass = 'bg-amber-950/90 text-amber-300 border-amber-800/90 font-bold';
            } else if (nextTask?.due_at) {
              dueBadgeText = formatTorontoShortDay(nextTask.due_at);
            }

            return (
              <div
                key={contact.id}
                onDoubleClick={() => onOpenDossier && onOpenDossier(contact)}
                className="p-4 sm:p-5 rounded-2xl bg-[#01162b] border border-blue-950/80 hover:border-blue-700/60 shadow-sm transition-all duration-150 space-y-4 group"
              >
                {/* Header Row: Due Status, Sequence Name, Step Title, Assigned Rep */}
                <div className="flex flex-wrap items-center justify-between gap-2.5 pb-3 border-b border-slate-800/80">
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Urgency Due Badge */}
                    <span className={`px-2.5 py-1 rounded-lg text-xs font-mono border ${dueBadgeClass}`}>
                      {dueBadgeText}
                    </span>

                    {/* Sequence Badge */}
                    <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-900 text-slate-300 border border-slate-800 flex items-center gap-1.5">
                      {isEmail && <Mail size={12} className="text-blue-400" />}
                      {isCall && <Phone size={12} className="text-emerald-400" />}
                      {isTodo && <CheckCircle2 size={12} className="text-purple-400" />}
                      <span>{nextTask?.title || (openEnr ? `${openEnr.sequence_key.replace(/_/g, ' ')}` : 'Follow-up')}</span>
                    </span>

                    {/* Stage status override */}
                    {contact.status && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider bg-blue-950 text-blue-300 border border-blue-900/60">
                        {contact.status.replace(/_/g, ' ')}
                      </span>
                    )}
                  </div>

                  {/* Assigned Rep Identity */}
                  <div className="flex items-center gap-1.5 text-xs text-slate-400">
                    <User size={12} className="text-slate-500" />
                    <span>Rep:</span>
                    <strong className="text-slate-200">{effectiveRep.name}</strong>
                    <span className="text-[10px] font-mono text-blue-400">({effectiveRep.title})</span>
                  </div>
                </div>

                {/* Main Content Grid: Left Contact Info, Right Execution Action Station */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                  {/* Left Column: Contact & Company (7 cols) */}
                  <div className="md:col-span-7 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        {/* Name with 1-click copy */}
                        <div
                          onClick={() => handleCopy(contact.name, `name-${contact.id}`)}
                          className="inline-flex items-center gap-1.5 cursor-pointer group/name"
                          title="Click to copy name"
                        >
                          <h2 className="text-base font-bold text-white group-hover/name:text-blue-300 transition tracking-tight">
                            {contact.name || 'Unnamed Contact'}
                          </h2>
                          {copiedId === `name-${contact.id}` ? (
                            <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950 px-1.5 py-0.5 rounded border border-emerald-800">
                              Copied!
                            </span>
                          ) : (
                            <Copy size={11} className="opacity-0 group-hover/name:opacity-100 text-slate-400" />
                          )}
                        </div>

                        {/* Title & Company */}
                        <div className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                          <span className="font-semibold text-slate-300">{contact.position || 'Project Lead'}</span>
                          <span>•</span>
                          <span className="text-slate-300 flex items-center gap-1">
                            <Building2 size={12} className="text-slate-500" />
                            {contact.company || 'Commercial Prospect'}
                          </span>
                          {contact.city && (
                            <>
                              <span>•</span>
                              <span className="text-slate-400 font-mono text-[11px]">{contact.city}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Contact Channels (Phone & Email) */}
                    <div className="flex items-center gap-2 flex-wrap text-xs pt-1">
                      {/* Phone box */}
                      {contact.phone ? (
                        <div
                          onClick={() => handleCopy(contact.phone, `phone-${contact.id}`)}
                          className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 hover:border-blue-600/50 cursor-pointer flex items-center gap-1.5 font-mono text-slate-300 transition"
                          title="Click to copy phone"
                        >
                          <Phone size={11} className="text-blue-400" />
                          <span>{contact.phone}</span>
                          {copiedId === `phone-${contact.id}` ? (
                            <Check size={11} className="text-emerald-400" />
                          ) : (
                            <Copy size={11} className="text-slate-500" />
                          )}
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-500 font-mono">No phone</span>
                      )}

                      {/* Email box */}
                      {contact.email ? (
                        <div
                          onClick={() => handleCopy(contact.email, `email-${contact.id}`)}
                          className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 hover:border-blue-600/50 cursor-pointer flex items-center gap-1.5 font-mono text-slate-300 transition"
                          title="Click to copy email"
                        >
                          <Mail size={11} className="text-sky-400" />
                          <span>{contact.email}</span>
                          {copiedId === `email-${contact.id}` ? (
                            <Check size={11} className="text-emerald-400" />
                          ) : (
                            <Copy size={11} className="text-slate-500" />
                          )}
                        </div>
                      ) : (
                        <span className="text-[11px] text-amber-400/90 font-mono flex items-center gap-1">
                          <AlertTriangle size={11} /> No email on file
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right Column: High-Velocity Action Station (5 cols) */}
                  <div className="md:col-span-5 flex flex-col items-start md:items-end justify-center gap-2">
                    {/* Execution Actions based on kind */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* EMAIL TASK: Primary "Open in Gmail" */}
                      {isEmail && composeInfo && (
                        <>
                          <a
                            href={composeInfo.compose?.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => handleOpenEmail(item)}
                            className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-blue-950/50 transition cursor-pointer"
                            title={`Open draft in Gmail as ${effectiveRep.name}`}
                          >
                            <Mail size={13} />
                            <span>Open in Gmail</span>
                            <ExternalLink size={11} className="opacity-70" />
                          </a>

                          {/* Mark Sent button */}
                          <button
                            type="button"
                            disabled={taskLoading}
                            onClick={() => handleMarkSent(item)}
                            className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1 shadow-md shadow-emerald-950/40 transition disabled:opacity-50 cursor-pointer"
                            title="Mark sent & advance to next follow-up step"
                          >
                            <Check size={13} />
                            <span>Mark sent</span>
                          </button>

                          {/* Skip button */}
                          <button
                            type="button"
                            disabled={taskLoading}
                            onClick={() => handleSkip(item)}
                            className="px-2.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white text-xs font-medium border border-slate-800 transition cursor-pointer"
                            title="Skip this follow-up step"
                          >
                            Skip
                          </button>
                        </>
                      )}

                      {/* CALL TASK: Primary "Call Now" */}
                      {isCall && (
                        <>
                          <button
                            type="button"
                            onClick={() => onStartCall && onStartCall(contact, contact.phone)}
                            className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-emerald-950/50 transition cursor-pointer"
                            title={`Dial ${contact.name}`}
                          >
                            <Phone size={13} />
                            <span>Call Now</span>
                          </button>

                          {onOpenCallbackModal && (
                            <button
                              type="button"
                              onClick={() => onOpenCallbackModal(contact)}
                              className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-semibold border border-slate-800 transition cursor-pointer"
                            >
                              Reschedule
                            </button>
                          )}
                        </>
                      )}

                      {/* TODO / WALKTHROUGH VISIT TASK */}
                      {isTodo && (
                        <>
                          {nextTask?.step_key?.includes('wt_visit') && onOpenVisitResultModal ? (
                            <button
                              type="button"
                              onClick={() => onOpenVisitResultModal(contact, nextTask)}
                              className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                            >
                              <CheckCircle2 size={13} />
                              <span>Log Visit Outcome</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={taskLoading}
                              onClick={() => handleDone(item)}
                              className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                            >
                              <Check size={13} />
                              <span>Mark Done</span>
                            </button>
                          )}
                        </>
                      )}

                      {/* HELD / PAUSED SPECIAL STATE */}
                      {item.isHeld && (
                        <button
                          type="button"
                          onClick={() => handleStartHeld(item)}
                          className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition cursor-pointer"
                        >
                          Start anyway
                        </button>
                      )}

                      {item.isPaused && (
                        <button
                          type="button"
                          onClick={() => handleResume(item)}
                          className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition cursor-pointer"
                        >
                          Resume
                        </button>
                      )}

                      {/* Dossier quick launch */}
                      <button
                        type="button"
                        onClick={() => onOpenDossier && onOpenDossier(contact)}
                        className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition cursor-pointer"
                        title="Open full lead dossier"
                      >
                        <ChevronRight size={14} />
                      </button>
                    </div>

                    {/* Secondary helpers: Check inbox for reply & Stop follow-up */}
                    <div className="flex items-center gap-3 text-[11px] text-slate-400">
                      {composeInfo?.search && (
                        <a
                          href={composeInfo.search}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-400 hover:underline flex items-center gap-1"
                        >
                          <span>Check Gmail for replies</span>
                          <ExternalLink size={10} />
                        </a>
                      )}
                      {openEnr && (
                        <button
                          type="button"
                          onClick={() => handleStop(item)}
                          className="text-slate-500 hover:text-rose-400 transition cursor-pointer"
                        >
                          Stop sequence
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
