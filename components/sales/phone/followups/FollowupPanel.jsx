import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Mail,
  Phone,
  CheckCircle,
  Clock,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Search,
  MessageSquare,
  Calendar,
} from 'lucide-react';
import { toast } from 'sonner';
import { gmailComposeUrl, gmailSearchUrl } from '@/lib/sales/followups/compose';
import { renderEmail } from '@/lib/sales/followups/render';
import {
  formatWhenFuture,
  formatTorontoShortDay,
  isTaskOverdue,
} from '@/lib/sales/followups/schedule';

export default function FollowupPanel({
  leadId,
  contact,
  onOpenReplyModal,
  onOpenOutOfOfficeModal,
  onOpenVisitResultModal,
  onOpenJobResultModal,
  onOpenCallbackModal,
  onOpenQuoteDetailsModal,
  onTriggerRefresh,
}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchData = useCallback(async () => {
    if (!leadId) return;
    try {
      const res = await fetch(`/api/sales/followups/lead/${leadId}`);
      if (!res.ok) {
        if (res.status === 401) {
          setData({ authError: true });
          return;
        }
        throw new Error('Failed to load follow-up details');
      }
      const json = await res.json();
      setData(json);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const enrollments = data?.enrollments || [];
  const tasks = data?.tasks || [];
  const flags = data?.flags || {};
  const snapshots = data?.snapshots || [];
  const repSettings = data?.meta?.repSettings || {};
  const mailingAddressSet = !!data?.meta?.mailingAddressSet;

  const activeEnrs = enrollments.filter((e) => ['active', 'held', 'paused'].includes(e.status));
  const endedEnrs = enrollments.filter((e) => ['completed', 'cancelled'].includes(e.status));

  // Find next pending task
  const nextTask = useMemo(() => {
    const pending = tasks.filter((t) => t.status === 'pending');
    if (!pending.length) return null;
    return [...pending].sort((a, b) => new Date(a.due_at).getTime() - new Date(b.due_at).getTime())[0];
  }, [tasks]);

  const activeEnrForTask = useMemo(() => {
    if (!nextTask) return activeEnrs[0] || null;
    return activeEnrs.find((e) => e.id === nextTask.enrollment_id) || activeEnrs[0] || null;
  }, [nextTask, activeEnrs]);

  // Compose info for next email task
  const composeInfo = useMemo(() => {
    if (!nextTask || nextTask.kind !== 'email' || !nextTask.template_key) return null;
    if (!mailingAddressSet || !contact?.email) return null;

    try {
      const rendered = renderEmail({
        templateKey: nextTask.template_key,
        lead: {
          customer_name: contact?.name,
          company_name: contact?.company,
        },
        rep: {
          signature_name: repSettings?.signature_name || 'Malik Campbell',
          signature_title: repSettings?.signature_title,
          signature_phone: repSettings?.signature_phone,
        },
        context: activeEnrForTask?.context || {},
        anchorAt: activeEnrForTask?.anchor_at,
        mailingAddressOverride: repSettings?.mailingAddress || undefined,
      });

      return {
        rendered,
        compose: gmailComposeUrl({
          from: repSettings?.gmail_address || undefined,
          to: contact?.email,
          subject: rendered.subject,
          body: rendered.body,
        }),
      };
    } catch {
      return null;
    }
  }, [nextTask, contact, repSettings, activeEnrForTask, mailingAddressSet]);

  const searchUrl = useMemo(() => {
    if (!contact?.email) return null;
    return gmailSearchUrl(contact.email);
  }, [contact]);

  // Handle task actions
  const handleTaskAction = async (taskId, actionName) => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/sales/followups/tasks/${taskId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: actionName }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to update task');
      }
      toast.success(actionName === 'sent' ? 'Marked sent' : actionName === 'skip' ? 'Skipped' : 'Updated');
      await fetchData();
      if (onTriggerRefresh) onTriggerRefresh();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Handle flag toggles
  const handleToggleFlag = async (flagName, value) => {
    try {
      let action;
      if (flagName === 'do_not_contact') {
        action = value ? 'do_not_contact' : 'clear_flag';
      } else if (flagName === 'unsubscribe') {
        action = value ? 'unsubscribe' : 'clear_flag';
      } else if (flagName === 'bounced') {
        action = 'clear_flag';
      }

      const body = { action };
      if (action === 'clear_flag') {
        body.flag = flagName;
      }

      const res = await fetch(`/api/sales/followups/lead/${leadId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Failed to update flag');
      toast.success('Flags updated');
      await fetchData();
      if (onTriggerRefresh) onTriggerRefresh();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const mapEndReason = (reason, seqKey) => {
    if (!reason) return 'Finished';
    const isDrip = seqKey === 'no_answer_drip';
    if (reason === 'completed') return isDrip ? 'Drip finished' : 'Finished';
    if (reason === 'replied') return isDrip ? 'Drip stopped: they replied' : 'Stopped: they replied';
    if (reason.startsWith('superseded:')) return isDrip ? 'Drip stopped: new outcome logged' : 'Stopped: new outcome logged';
    if (reason === 'inbound_call' || reason === 'inbound_sms') return isDrip ? 'Drip stopped: they called or texted' : 'Stopped: they called or texted';
    if (reason === 'unsubscribed' || reason === 'opted_out') return isDrip ? 'Drip stopped: unsubscribed' : 'Stopped: unsubscribed';
    if (reason === 'do_not_contact') return isDrip ? 'Drip stopped: do not contact' : 'Stopped: do not contact';
    if (reason === 'manual_stop') return isDrip ? 'Drip stopped by a rep' : 'Stopped by a rep';
    if (reason === 'held_skipped') return isDrip ? 'Drip skipped' : 'Skipped';
    if (reason === 'callback_unreachable') return 'Ended: no answer after 3 attempts';
    if (reason === 'walkthrough_cancelled') return 'Ended: walkthrough cancelled';
    if (reason === 'job_cancelled') return 'Ended: job cancelled';
    if (reason === 'out_of_service') return 'Ended: number out of service';
    return `Stopped: ${reason}`;
  };

  if (loading) {
    return (
      <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl text-center text-xs text-slate-500">
        Loading follow-up engine...
      </div>
    );
  }

  if (data?.authError) {
    return (
      <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl text-xs text-slate-400 flex items-center justify-between">
        <span>Sign in to view follow-up engine details.</span>
        <a href="/sobadmin/login" className="text-blue-400 hover:underline">
          Sign in
        </a>
      </div>
    );
  }

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 space-y-6">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <h3 className="text-sm font-semibold text-white tracking-wide uppercase flex items-center gap-2">
          <Clock className="w-4 h-4 text-blue-400" />
          <span>Follow-Up Engine</span>
        </h3>
        <div className="flex items-center gap-2">
          {flags.do_not_contact_at && (
            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-red-950/80 text-red-300 border border-red-800">
              Do not contact
            </span>
          )}
          {flags.unsubscribed_at && (
            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-950/80 text-amber-300 border border-amber-800">
              Unsubscribed
            </span>
          )}
          {flags.bounced_at && (
            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-rose-950/80 text-rose-300 border border-rose-800">
              Bounced
            </span>
          )}
        </div>
      </div>

      {/* Active Enrollments */}
      {activeEnrs.length === 0 ? (
        <div className="text-xs text-slate-400 p-3 bg-slate-800/40 rounded-lg border border-slate-800">
          No active follow-up sequence running.
        </div>
      ) : (
        activeEnrs.map((enr) => {
          const enrTasks = tasks.filter((t) => t.enrollment_id === enr.id);
          return (
            <div key={enr.id} className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-blue-300 capitalize">
                  {enr.sequence_key.replace(/_/g, ' ')}
                </span>
                <span className="text-[11px] text-slate-400">
                  Status: <strong className="text-slate-200 capitalize">{enr.status}</strong>
                </span>
              </div>

              {/* Task list for enrollment */}
              <div className="space-y-1.5">
                {enrTasks.map((t) => {
                  const isOverdue = isTaskOverdue(t.due_at, t.overdue_at);
                  return (
                    <div
                      key={t.id}
                      className={`p-2.5 rounded-lg border text-xs flex items-center justify-between ${
                        t.status === 'completed'
                          ? 'bg-slate-900/40 border-slate-800/60 text-slate-500'
                          : t.status === 'skipped'
                          ? 'bg-slate-900/40 border-slate-800/60 text-slate-500 line-through'
                          : isOverdue
                          ? 'bg-rose-950/20 border-rose-900/60 text-rose-200'
                          : 'bg-slate-800/60 border-slate-700/60 text-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {t.kind === 'email' ? (
                          <Mail className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                        ) : t.kind === 'call' ? (
                          <Phone className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        ) : (
                          <CheckCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        )}
                        <span className="truncate font-medium">{t.title}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[11px] text-slate-400">
                          {t.status === 'completed'
                            ? `Done ${formatTorontoShortDay(t.completed_at)}`
                            : t.status === 'skipped'
                            ? 'Skipped'
                            : formatWhenFuture(t.due_at)}
                        </span>
                        {t.status === 'pending' && (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleTaskAction(t.id, 'skip')}
                              disabled={actionLoading}
                              className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-300 transition"
                            >
                              Skip
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })
      )}

      {/* Live Email Preview */}
      {nextTask && nextTask.kind === 'email' && composeInfo && (
        <div className="space-y-2 p-3.5 bg-slate-950/80 border border-slate-800 rounded-lg">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Live Preview: {nextTask.title}
            </span>
            {searchUrl && (
              <a
                href={searchUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-blue-400 hover:underline flex items-center gap-1"
              >
                <Search className="w-3 h-3" />
                <span>Check inbox</span>
              </a>
            )}
          </div>
          <div className="text-xs text-slate-200">
            <div className="font-semibold text-white mb-1">
              Subject: {composeInfo.rendered.subject}
            </div>
            <div className="whitespace-pre-wrap font-sans text-slate-300 text-[11px] leading-relaxed bg-slate-900/80 p-2.5 rounded border border-slate-800">
              {composeInfo.rendered.body}
            </div>
          </div>
          <div className="pt-2 flex items-center gap-2">
            {composeInfo.compose?.url && (
              <a
                href={composeInfo.compose.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => handleTaskAction(nextTask.id, 'open')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-medium transition"
              >
                <span>Open in Gmail</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
            <button
              type="button"
              onClick={() => handleTaskAction(nextTask.id, 'sent')}
              disabled={actionLoading}
              className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded text-xs font-medium transition"
            >
              Mark sent
            </button>
            <button
              type="button"
              onClick={() => handleTaskAction(nextTask.id, 'skip')}
              disabled={actionLoading}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs transition"
            >
              Skip
            </button>
          </div>
        </div>
      )}

      {/* Flags and Actions Toggles */}
      <div className="p-3.5 bg-slate-800/40 border border-slate-800 rounded-lg space-y-3">
        <span className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
          Flags & Controls
        </span>
        <div className="flex flex-wrap gap-2 text-xs">
          <button
            type="button"
            onClick={() => handleToggleFlag('do_not_contact', !flags.do_not_contact_at)}
            className={`px-3 py-1.5 rounded-lg border font-medium transition ${
              flags.do_not_contact_at
                ? 'bg-red-600 text-white border-red-500'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-750 hover:text-white'
            }`}
          >
            {flags.do_not_contact_at ? 'Remove Do Not Contact' : 'Mark Do Not Contact'}
          </button>
          <button
            type="button"
            onClick={() => handleToggleFlag('unsubscribe', !flags.unsubscribed_at)}
            className={`px-3 py-1.5 rounded-lg border font-medium transition ${
              flags.unsubscribed_at
                ? 'bg-amber-600 text-white border-amber-500'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-750 hover:text-white'
            }`}
          >
            {flags.unsubscribed_at ? 'Remove Unsubscribed' : 'Mark Unsubscribed'}
          </button>
          {flags.bounced_at && (
            <button
              type="button"
              onClick={() => handleToggleFlag('bounced', false)}
              className="px-3 py-1.5 rounded-lg border bg-rose-600 text-white border-rose-500 font-medium transition"
            >
              Clear Bounced Flag
            </button>
          )}
          {onOpenReplyModal && (
            <button
              type="button"
              onClick={() => onOpenReplyModal(contact)}
              className="px-3 py-1.5 rounded-lg border bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-750 hover:text-white font-medium transition flex items-center gap-1.5"
            >
              <MessageSquare className="w-3.5 h-3.5 text-blue-400" />
              <span>Record Reply</span>
            </button>
          )}
          {onOpenOutOfOfficeModal && (
            <button
              type="button"
              onClick={() => onOpenOutOfOfficeModal(contact)}
              className="px-3 py-1.5 rounded-lg border bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-750 hover:text-white font-medium transition flex items-center gap-1.5"
            >
              <span>Out of Office</span>
            </button>
          )}
          {onOpenCallbackModal && (
            <button
              type="button"
              onClick={() => onOpenCallbackModal(contact)}
              className="px-3 py-1.5 rounded-lg border bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-750 hover:text-white font-medium transition flex items-center gap-1.5"
            >
              <Calendar className="w-3.5 h-3.5 text-amber-400" />
              <span>Schedule Callback</span>
            </button>
          )}
          {nextTask?.step_key === 'wt_visit' && onOpenVisitResultModal && (
            <button
              type="button"
              onClick={() => onOpenVisitResultModal(contact, nextTask)}
              className="px-3 py-1.5 rounded-lg border bg-blue-600 text-white border-blue-500 font-medium transition"
            >
              Record Visit Result
            </button>
          )}
          {nextTask?.step_key === 'won_completion_check' && onOpenJobResultModal && (
            <button
              type="button"
              onClick={() => onOpenJobResultModal(contact, nextTask)}
              className="px-3 py-1.5 rounded-lg border bg-blue-600 text-white border-blue-500 font-medium transition"
            >
              Record Job Result
            </button>
          )}
          {nextTask?.step_key === 'wt_quote' && onOpenQuoteDetailsModal && (
            <button
              type="button"
              onClick={() => onOpenQuoteDetailsModal(contact, nextTask, activeEnrForTask)}
              className="px-3 py-1.5 rounded-lg border bg-blue-600 text-white border-blue-500 font-medium transition"
            >
              Quote Details
            </button>
          )}
        </div>
      </div>

      {/* Sent Email Snapshots */}
      {snapshots.length > 0 && (
        <div className="space-y-2">
          <span className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Emails Sent ({snapshots.length})
          </span>
          <div className="space-y-1.5">
            {snapshots.map((snap) => (
              <div
                key={snap.id}
                className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800 text-xs"
              >
                <div className="flex items-center justify-between text-slate-400 mb-1">
                  <span className="font-medium text-slate-200 truncate">{snap.subject}</span>
                  <span className="text-[10px] shrink-0">{formatTorontoShortDay(snap.sent_at)}</span>
                </div>
                <div className="text-[11px] text-slate-400 line-clamp-2">
                  {snap.body}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Collapsed Ended History */}
      {endedEnrs.length > 0 && (
        <div className="border-t border-slate-800 pt-3">
          <button
            type="button"
            onClick={() => setHistoryOpen(!historyOpen)}
            className="w-full flex items-center justify-between text-xs text-slate-400 hover:text-slate-200 transition"
          >
            <span className="font-medium">Ended Follow-Ups ({endedEnrs.length})</span>
            {historyOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
          {historyOpen && (
            <div className="mt-2.5 space-y-2">
              {endedEnrs.map((enr) => (
                <div
                  key={enr.id}
                  className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80 text-xs flex items-center justify-between"
                >
                  <div>
                    <div className="font-medium text-slate-300 capitalize">
                      {enr.sequence_key.replace(/_/g, ' ')}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Ended {formatTorontoShortDay(enr.ended_at)}
                    </div>
                  </div>
                  <span className="text-[11px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                    {mapEndReason(enr.end_reason, enr.sequence_key)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
