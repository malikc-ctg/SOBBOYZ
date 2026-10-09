import React, { useState, useMemo } from 'react';
import {
  Phone,
  MoreVertical,
  ExternalLink,
  Search,
  AlertTriangle,
  User,
} from 'lucide-react';
import { toast } from 'sonner';
import { gmailComposeUrl, gmailSearchUrl } from '@/lib/sales/followups/compose';
import { renderEmail } from '@/lib/sales/followups/render';
import { resolveRepConfig } from '@/lib/sales/followups/config';
import { formatWhenFuture, formatTorontoShortDay, formatTorontoTime, isTaskOverdue, getDueBucket } from '@/lib/sales/followups/schedule';

export default function FollowupStrip({
  contact,
  followupData,
  repSettings,
  mailingAddressSet,
  authError,
  onOpenDossier,
  onStartCall,
  onRefresh,
  onOpenReplyModal,
  onOpenOutOfOfficeModal,
  onOpenVisitResultModal,
  onOpenJobResultModal,
  onOpenCallbackModal,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const enrs = followupData?.enrollments || [];
  const openEnr = enrs.find((e) => ['active', 'held', 'paused'].includes(e.status));
  const endedDrip = enrs.find((e) => e.sequence_key === 'no_answer_drip' && ['completed', 'cancelled'].includes(e.status));
  const flags = followupData?.flags || {};
  const nextTask = followupData?.nextTask || null;
  const otherCount = followupData?.otherPendingCount || 0;

  // Determine active rep for this lead card
  const effectiveRep = useMemo(() => {
    if (nextTask?.assigned_rep_id) return resolveRepConfig(nextTask.assigned_rep_id);
    if (openEnr?.owner_rep_id) return resolveRepConfig(openEnr.owner_rep_id);
    if (repSettings?.signature_name) return resolveRepConfig(repSettings.signature_name);
    return resolveRepConfig('malik');
  }, [nextTask?.assigned_rep_id, openEnr?.owner_rep_id, repSettings]);

  // Pre-render Gmail URL for email tasks
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
          signature_name: effectiveRep.name,
          signature_title: effectiveRep.title,
          signature_phone: effectiveRep.phone,
        },
        context: openEnr?.context || {},
        anchorAt: openEnr?.anchor_at,
        mailingAddressOverride: repSettings?.mailingAddress || undefined,
      });

      return {
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
      return null;
    }
  }, [nextTask, contact, effectiveRep, repSettings, mailingAddressSet, openEnr]);

  if (authError) {
    return (
      <div
        className="mt-2.5 pt-2 border-t border-slate-800/80 text-[11px] text-slate-500 flex items-center justify-between"
        onClick={(e) => e.stopPropagation()}
      >
        <span>Sign in to use follow-ups</span>
        <a href="/sobadmin/login" className="text-blue-400 hover:underline">
          Sign in
        </a>
      </div>
    );
  }

  // DNC badge hides follow-up actions completely
  if (flags.do_not_contact_at) {
    return (
      <div
        className="mt-2.5 pt-2 border-t border-slate-800/80 text-[11px] flex items-center justify-between"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="px-1.5 py-0.5 rounded bg-red-950/80 text-red-300 font-bold border border-red-800/80 text-[10px]">
          Do not contact
        </span>
      </div>
    );
  }

  async function handleTaskAction(action, payload = {}) {
    if (!nextTask || actionLoading) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/sales/followups/tasks/${nextTask.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...payload }),
      });
      if (res.status === 409) {
        toast('Already handled.');
        if (onRefresh) onRefresh();
        return;
      }
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed action');
      }

      if (action === 'sent' || action === 'skip' || action === 'done') {
        const title = action === 'sent' ? 'Marked sent.' : action === 'skip' ? 'Skipped.' : 'Marked done.';
        toast(title, {
          action: {
            label: 'Undo',
            onClick: () => handleUndo(nextTask.id),
          },
        });
      }

      if (onRefresh) onRefresh();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleUndo(taskId) {
    try {
      const res = await fetch(`/api/sales/followups/tasks/${taskId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'undo' }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || 'Cannot undo');
        return;
      }
      toast.success('Action undone');
      if (onRefresh) onRefresh();
    } catch {
      toast.error('Undo failed');
    }
  }

  async function handleLeadSignal(signal, payload = {}) {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/sales/followups/lead/${contact.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: signal, ...payload }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed signal');
      }
      if (onRefresh) onRefresh();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setActionLoading(false);
      setMenuOpen(false);
    }
  }

  function handleOpenGmailClick() {
    if (!nextTask) return;
    // Fire open action without awaiting (never await before opening a popup or navigation)
    fetch(`/api/sales/followups/tasks/${nextTask.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'open' }),
    }).then(() => {
      if (onRefresh) onRefresh();
    });

    if (composeInfo?.compose?.clipboardBody) {
      try {
        navigator.clipboard.writeText(composeInfo.compose.clipboardBody);
        toast('Body copied. Paste it into the email.');
      } catch {}
    }
  }

  // Sequence label formatter (D.1)
  function getSequenceLabel() {
    if (!openEnr) {
      if (endedDrip) {
        if (endedDrip.status === 'completed') return 'Drip finished';
        return `Drip stopped: ${endedDrip.end_reason || 'ended'}`;
      }
      return null;
    }
    const k = openEnr.sequence_key;
    if (k === 'no_answer_drip') {
      const num = nextTask?.step_key ? nextTask.step_key.replace('drip_email_', '') : '1';
      return `No-answer drip ${num}/4`;
    }
    if (k === 'pickup_followup') return 'Pick-up follow-up';
    if (k === 'info_sent_followup') return 'Info sent follow-up';
    if (k === 'walkthrough') {
      const wtAt = openEnr.context?.walkthroughAt;
      return wtAt ? `Walkthrough ${formatTorontoShortDay(wtAt)}, ${formatTorontoTime(wtAt)}` : 'Walkthrough';
    }
    if (k === 'quote_followup') {
      const num = nextTask?.step_key ? (nextTask.step_key === 'quote_day2' ? '1' : nextTask.step_key === 'quote_day5' ? '2' : '3') : '1';
      return `Quote follow-up ${num}/3`;
    }
    if (k === 'callback') {
      const cbAt = openEnr.context?.callbackAt;
      return cbAt ? `Callback ${formatWhenFuture(cbAt)}` : 'Callback';
    }
    if (k === 'job_won') return 'Customer';
    if (k === 'recheck') {
      const due = nextTask?.due_at ? formatTorontoShortDay(nextTask.due_at) : '';
      return `Recheck ${due}`;
    }
    if (k === 'referral_intro') return 'Referral intro';
    if (k === 'reply_call' || k === 'reply_info') return 'Reply';
    return 'Follow-up';
  }

  // Due Chip formatter
  function getDueChip() {
    if (!nextTask) return null;
    if (isTaskOverdue(nextTask)) {
      return <span className="px-1.5 py-0.5 rounded bg-red-950 text-red-300 font-bold border border-red-800 text-[10px]">Overdue</span>;
    }
    const bucket = getDueBucket(nextTask);
    if (bucket === 'due_today') {
      return <span className="px-1.5 py-0.5 rounded bg-amber-950 text-amber-300 font-bold border border-amber-800 text-[10px]">Due today</span>;
    }
    return (
      <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] font-medium">
        {formatTorontoShortDay(nextTask.due_at)}
      </span>
    );
  }

  // Reason why email button is disabled
  function getEmailDisabledReason() {
    if (!contact.email) return 'No email on file';
    if (flags.bounced_email) return 'Email bounced';
    if (flags.email_opt_out_at) return 'Unsubscribed';
    if (flags.do_not_contact_at) return 'Do not contact';
    if (!mailingAddressSet) return 'Add the company mailing address in follow-up settings';
    return null;
  }

  const seqLabel = getSequenceLabel();

  // If there's no open enrollment and no task
  if (!openEnr && !nextTask) {
    if (flags.needs_email_since && !flags.email_opt_out_at) {
      return (
        <div className="mt-2.5 pt-2 border-t border-slate-800/80 text-[11px] space-y-1" onClick={(e) => e.stopPropagation()}>
          <div className="text-slate-400">No email on file</div>
          <button
            type="button"
            onClick={onOpenDossier}
            className="text-blue-400 hover:text-blue-300 font-semibold underline text-[11px]"
          >
            Add email
          </button>
        </div>
      );
    }
    if (endedDrip) {
      return (
        <div className="mt-2.5 pt-2 border-t border-slate-800/80 text-[11px] text-slate-500" onClick={(e) => e.stopPropagation()}>
          {seqLabel}
        </div>
      );
    }
    return null;
  }

  // Held state
  if (openEnr?.status === 'held') {
    const isCompany = openEnr.hold_reason === 'company_active';
    const heldMsg = isCompany
      ? `Held: ${openEnr.context?.heldOtherLead || 'another contact'} at this company is already in follow-up.`
      : 'Held: another lead uses this email.';

    return (
      <div className="mt-2.5 pt-2 border-t border-slate-800/80 text-[11px] space-y-1.5" onClick={(e) => e.stopPropagation()}>
        <div className="text-amber-300 flex items-start gap-1">
          <AlertTriangle size={12} className="shrink-0 mt-0.5" />
          <span>{heldMsg}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleLeadSignal('start_held', { enrollmentId: openEnr.id })}
            className="px-2 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white font-semibold text-[10px]"
          >
            Start anyway
          </button>
          <button
            type="button"
            onClick={() => handleLeadSignal('skip_held', { enrollmentId: openEnr.id })}
            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px]"
          >
            Skip
          </button>
        </div>
      </div>
    );
  }

  // Paused state
  if (openEnr?.status === 'paused') {
    const untilStr = openEnr.paused_until ? formatTorontoShortDay(openEnr.paused_until) : 'resumed';
    return (
      <div className="mt-2.5 pt-2 border-t border-slate-800/80 text-[11px] flex items-center justify-between" onClick={(e) => e.stopPropagation()}>
        <span className="text-slate-400">Paused until {untilStr}</span>
        <button
          type="button"
          onClick={() => handleLeadSignal('resume', { enrollmentId: openEnr.id })}
          className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-[10px]"
        >
          Resume
        </button>
      </div>
    );
  }

  const emailDisabledReason = getEmailDisabledReason();

  return (
    <div
      className="mt-2.5 pt-2 border-t border-slate-800/80 text-[11px] space-y-1.5"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Line 1: Sequence label & Due chip */}
      <div className="flex items-center justify-between gap-1 text-slate-300">
        <div className="flex items-center gap-1.5 truncate">
          <span className="font-semibold truncate">{seqLabel}</span>
          {otherCount > 0 && <span className="text-slate-500 text-[10px]">+{otherCount} more</span>}
          {flags.email_opt_out_at && (
            <span className="px-1.5 py-0.2 rounded bg-amber-950 text-amber-300 text-[9px] font-bold border border-amber-800">
              Unsubscribed
            </span>
          )}
        </div>
        <div>{getDueChip()}</div>
      </div>

      {/* Line 2: Task title */}
      {nextTask && (
        <div className="text-slate-400 text-[11px] truncate flex items-center justify-between">
          <span className="truncate">{nextTask.title}</span>
          {nextTask.assigned_rep_id && nextTask.assigned_rep_id !== repSettings?.rep_id && (
            <span className="text-slate-500 text-[9px] flex items-center gap-0.5">
              <User size={9} /> Other rep
            </span>
          )}
        </div>
      )}

      {/* Line 3: Action Buttons */}
      <div className="flex items-center justify-between gap-2 pt-1">
        <div className="flex items-center gap-2 flex-wrap">
          {nextTask?.kind === 'email' && (
            <>
              {composeInfo?.search && nextTask.step_key !== 'drip_email_1' && (
                <a
                  href={composeInfo.search}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] text-blue-400 hover:underline flex items-center gap-1"
                >
                  <Search size={10} /> Check inbox for reply
                </a>
              )}
              {emailDisabledReason ? (
                <button
                  type="button"
                  disabled
                  title={emailDisabledReason}
                  className="px-2.5 py-1 rounded bg-slate-800/50 text-slate-500 text-[11px] font-medium cursor-not-allowed border border-slate-800"
                >
                  Open in Gmail
                </button>
              ) : (
                <a
                  href={composeInfo?.compose?.url || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={handleOpenGmailClick}
                  className="px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white font-semibold text-[11px] inline-flex items-center gap-1 shadow-sm transition"
                >
                  <span>Open in Gmail</span>
                  <ExternalLink size={10} />
                </a>
              )}

              {nextTask.opened_at && (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      handleTaskAction('sent', {
                        subject: composeInfo?.rendered?.subject,
                        body: composeInfo?.rendered?.body,
                        to: contact.email,
                      })
                    }
                    className="px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-[10px] transition"
                  >
                    Mark sent
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTaskAction('not_sent')}
                    className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] transition"
                  >
                    Not sent
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={() => handleTaskAction('skip')}
                className="px-2 py-1 rounded text-slate-400 hover:text-slate-200 text-[10px] transition"
              >
                Skip
              </button>
            </>
          )}

          {nextTask?.kind === 'call' && (
            <>
              <button
                type="button"
                onClick={() => onStartCall && onStartCall(contact)}
                className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-[11px] inline-flex items-center gap-1 shadow-sm transition"
              >
                <Phone size={10} />
                <span>Call</span>
              </button>
              {nextTask.step_key === 'cb_call' && onOpenCallbackModal && (
                <button
                  type="button"
                  onClick={() => onOpenCallbackModal(contact, true)}
                  className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] transition"
                >
                  Reschedule
                </button>
              )}
              <span className="text-[10px] text-slate-500">Log outcome after call</span>
            </>
          )}

          {nextTask?.kind === 'todo' && (
            <>
              {nextTask.step_key === 'wt_visit' ? (
                <button
                  type="button"
                  onClick={() => onOpenVisitResultModal && onOpenVisitResultModal(nextTask)}
                  className="px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white font-semibold text-[11px] transition"
                >
                  Visit Result
                </button>
              ) : nextTask.step_key === 'won_completion_check' ? (
                <button
                  type="button"
                  onClick={() => onOpenJobResultModal && onOpenJobResultModal(nextTask)}
                  className="px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white font-semibold text-[11px] transition"
                >
                  Job Result
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleTaskAction('done')}
                  className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-[11px] transition"
                >
                  Done
                </button>
              )}
            </>
          )}
        </div>

        {/* Overflow dropdown trigger */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition"
          >
            <MoreVertical size={13} />
          </button>

          {menuOpen && (
            <div
              className="absolute right-0 bottom-full mb-1 w-44 rounded-xl bg-slate-900 border border-slate-700 shadow-2xl p-1 z-50 text-[11px] space-y-0.5"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  if (onOpenReplyModal) onOpenReplyModal(contact);
                }}
                className="w-full text-left px-2 py-1 rounded hover:bg-slate-800 text-slate-200"
              >
                They replied
              </button>
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  if (onOpenOutOfOfficeModal) onOpenOutOfOfficeModal(contact);
                }}
                className="w-full text-left px-2 py-1 rounded hover:bg-slate-800 text-slate-200"
              >
                Out of office
              </button>
              <button
                type="button"
                onClick={() => handleLeadSignal('bounced')}
                className="w-full text-left px-2 py-1 rounded hover:bg-slate-800 text-slate-200"
              >
                Email bounced
              </button>
              <button
                type="button"
                onClick={() => handleLeadSignal('unsubscribe')}
                className="w-full text-left px-2 py-1 rounded hover:bg-slate-800 text-amber-300"
              >
                Unsubscribe
              </button>
              {openEnr && (
                <>
                  <button
                    type="button"
                    onClick={() => handleLeadSignal('pause', { enrollmentId: openEnr.id })}
                    className="w-full text-left px-2 py-1 rounded hover:bg-slate-800 text-slate-200"
                  >
                    Pause
                  </button>
                  <button
                    type="button"
                    onClick={() => handleLeadSignal('stop', { enrollmentId: openEnr.id })}
                    className="w-full text-left px-2 py-1 rounded hover:bg-slate-800 text-red-300"
                  >
                    Stop this follow-up
                  </button>
                </>
              )}
              {nextTask && (
                <button
                  type="button"
                  onClick={() => handleTaskAction('reassign')}
                  className="w-full text-left px-2 py-1 rounded hover:bg-slate-800 text-slate-200"
                >
                  Reassign to me
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  if (onOpenDossier) onOpenDossier();
                }}
                className="w-full text-left px-2 py-1 rounded hover:bg-slate-800 text-blue-400 font-semibold"
              >
                View all steps
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
