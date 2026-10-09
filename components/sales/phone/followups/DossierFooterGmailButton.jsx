import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Mail,
  ExternalLink,
  ChevronDown,
  Check,
  Copy,
  Search,
  FastForward,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { gmailComposeUrl, gmailSearchUrl } from '@/lib/sales/followups/compose';
import { renderEmail } from '@/lib/sales/followups/render';
import { resolveRepConfig } from '@/lib/sales/followups/config';

const POPULAR_TEMPLATES = [
  { key: 'drip_1', label: 'No-Answer Drip: Day 1', subject: 'Closeout clean for projects' },
  { key: 'drip_2', label: 'No-Answer Drip: Day 3', subject: 'Dust after your last trades' },
  { key: 'drip_3', label: 'No-Answer Drip: Day 7', subject: 'Quote for final clean' },
  { key: 'drip_4', label: 'No-Answer Drip: Day 14', subject: 'Wrong person?' },
  { key: 'pickup_recap', label: 'Call Recap', subject: 'Following up on our call' },
  { key: 'wt_confirm', label: 'Walkthrough Confirmation', subject: 'Walkthrough confirmed' },
  { key: 'quote_day2', label: 'Quote Follow-up', subject: 'Questions on the quote?' },
  { key: 'info_day2', label: 'Info Sent Follow-up', subject: 'The info I sent' },
  { key: 'cb_confirm', label: 'Callback Confirmation', subject: 'Talk soon' },
  { key: 'won_thanks', label: 'Job Won: Thank You', subject: 'Thanks for choosing Sea of Blue' },
];

export default function DossierFooterGmailButton({
  contact,
  user,
  activeRepName,
  repSettings: incomingRepSettings,
  onTriggerRefresh,
}) {
  const [data, setData] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [selectedTemplateOverride, setSelectedTemplateOverride] = useState(null);
  const [wasOpened, setWasOpened] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchData = useCallback(async () => {
    if (!contact?.id) return;
    try {
      const res = await fetch(`/api/sales/followups/lead/${contact.id}`);
      if (!res.ok) return;
      const json = await res.json();
      setData(json);
    } catch {
      // ignore
    }
  }, [contact?.id]);

  useEffect(() => {
    fetchData();
    setSelectedTemplateOverride(null);
    setWasOpened(false);
  }, [fetchData]);

  const enrollments = data?.enrollments || [];
  const tasks = data?.tasks || [];
  const repSettings = incomingRepSettings || data?.meta?.repSettings || {};
  const mailingAddress = data?.meta?.mailingAddress || '';

  const activeEnr = useMemo(
    () => enrollments.find((e) => ['active', 'held', 'paused'].includes(e.status)) || null,
    [enrollments]
  );

  // Find next pending email task
  const nextEmailTask = useMemo(() => {
    const pending = tasks.filter((t) => t.status === 'pending');
    if (!pending.length) return null;
    const emailTask = pending.find((t) => t.kind === 'email');
    return emailTask || null;
  }, [tasks]);

  // Determine active rep (Malik, Raahim, or Ayaan — automatically detected by auth UUID, excluding Joshwa)
  const effectiveRep = useMemo(() => {
    if (user?.id) return resolveRepConfig(user.id);
    if (repSettings?.rep_id) return resolveRepConfig(repSettings.rep_id);
    if (nextEmailTask?.assigned_rep_id) return resolveRepConfig(nextEmailTask.assigned_rep_id);
    if (repSettings?.signature_name) return resolveRepConfig(repSettings.signature_name);
    if (activeRepName) return resolveRepConfig(activeRepName);
    return resolveRepConfig('malik');
  }, [user?.id, nextEmailTask, repSettings, activeRepName]);

  // Determine active template key
  const activeTemplateKey = useMemo(() => {
    if (selectedTemplateOverride) return selectedTemplateOverride;
    if (nextEmailTask?.template_key) return nextEmailTask.template_key;
    if (contact?.status === 'walkthrough_booked') return 'wt_confirm';
    if (contact?.status === 'quoted') return 'quote_day2';
    if (contact?.status === 'won' || contact?.status === 'job_won') return 'won_thanks';
    if (contact?.status === 'contacted' || contact?.status === 'convo') return 'pickup_recap';
    return 'drip_1';
  }, [selectedTemplateOverride, nextEmailTask, contact?.status]);

  // Pre-render Gmail URL
  const composeInfo = useMemo(() => {
    if (!contact?.email) return null;

    try {
      const rendered = renderEmail({
        templateKey: activeTemplateKey,
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
        context: activeEnr?.context || {},
        anchorAt: activeEnr?.anchor_at,
        mailingAddressOverride: mailingAddress || undefined,
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
        effectiveRep,
      };
    } catch (err) {
      console.warn('[DossierFooterGmailButton] renderEmail failed:', err);
      return null;
    }
  }, [contact, activeTemplateKey, effectiveRep, activeEnr, mailingAddress]);

  // Click handler for Open in Gmail
  const handleOpenGmailClick = async () => {
    setWasOpened(true);
    setMenuOpen(false);

    if (nextEmailTask && !selectedTemplateOverride) {
      try {
        await fetch(`/api/sales/followups/tasks/${nextEmailTask.id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'open' }),
        });
      } catch {
        // ignore
      }
    }
  };

  // Mark task as sent
  const handleMarkSent = async () => {
    if (!nextEmailTask || actionLoading) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/sales/followups/tasks/${nextEmailTask.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'sent',
          to: contact.email,
          subject: composeInfo?.rendered?.subject,
          body: composeInfo?.rendered?.body,
        }),
      });
      if (!res.ok) throw new Error('Failed to mark sent');
      toast.success('Marked sent: sequence advanced');
      setWasOpened(false);
      await fetchData();
      if (onTriggerRefresh) onTriggerRefresh();
    } catch (err) {
      toast.error(err.message || 'Error marking sent');
    } finally {
      setActionLoading(false);
    }
  };

  // Skip task
  const handleSkip = async () => {
    if (!nextEmailTask || actionLoading) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/sales/followups/tasks/${nextEmailTask.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'skip' }),
      });
      if (!res.ok) throw new Error('Failed to skip');
      toast.success('Task skipped');
      setMenuOpen(false);
      await fetchData();
      if (onTriggerRefresh) onTriggerRefresh();
    } catch (err) {
      toast.error(err.message || 'Error skipping');
    } finally {
      setActionLoading(false);
    }
  };

  // Copy email text
  const handleCopyBody = () => {
    if (!composeInfo?.rendered?.body) return;
    navigator.clipboard.writeText(composeInfo.rendered.body);
    toast.success('Email draft copied to clipboard');
    setMenuOpen(false);
  };

  if (!contact?.email) {
    return (
      <button
        type="button"
        disabled
        title="No email on file. Add an email to enable Gmail compose."
        className="px-3.5 py-2 rounded-xl bg-slate-800/60 text-slate-500 text-xs font-semibold flex items-center gap-1.5 border border-slate-800 cursor-not-allowed"
      >
        <Mail size={13} className="text-slate-600" />
        <span>No email on file</span>
      </button>
    );
  }

  const isSentReady = (wasOpened || nextEmailTask?.opened_at) && Boolean(nextEmailTask) && !selectedTemplateOverride;
  const currentTemplateObj = POPULAR_TEMPLATES.find((t) => t.key === activeTemplateKey);
  const activeLabel = currentTemplateObj?.label || nextEmailTask?.title || 'Open in Gmail';

  return (
    <div className="relative flex items-center gap-1.5">
      {/* Primary Open in Gmail Button Group */}
      <div className="inline-flex rounded-xl shadow-md shadow-blue-950/40 overflow-hidden border border-blue-500/40">
        <a
          href={composeInfo?.compose?.url || '#'}
          target="_blank"
          rel="noopener noreferrer"
          onClick={handleOpenGmailClick}
          className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5 transition active:scale-[0.98]"
          title={
            composeInfo?.rendered?.subject
              ? `Sending as ${effectiveRep.name} (${effectiveRep.title})\nSubject: ${composeInfo.rendered.subject}`
              : `Open pre-filled Gmail compose (as ${effectiveRep.name})`
          }
        >
          <Mail size={13} />
          <span>Open in Gmail</span>
          <span className="text-[10px] text-blue-200 font-medium">({effectiveRep.name.split(' ')[0]})</span>
          <ExternalLink size={11} className="opacity-70" />
        </a>

        {/* Dropdown Options Trigger */}
        <button
          type="button"
          onClick={() => {
            setMenuOpen(!menuOpen);
            setTemplatePickerOpen(false);
          }}
          className="px-2 py-2 bg-blue-700 hover:bg-blue-600 text-white text-xs font-bold border-l border-blue-500/30 transition flex items-center justify-center"
          title="Email Options and Templates"
        >
          <ChevronDown size={13} className={`transition-transform duration-200 ${menuOpen ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Mark Sent Quick Action (visible when task was opened) */}
      {isSentReady && (
        <button
          type="button"
          disabled={actionLoading}
          onClick={handleMarkSent}
          className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-emerald-950/40 transition disabled:opacity-50 animate-in fade-in"
          title="Mark as sent to record event and advance to next follow-up"
        >
          <Check size={13} />
          <span>Mark sent</span>
        </button>
      )}

      {/* Dropdown Menu */}
      {menuOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
          <div
            className="absolute right-0 bottom-full mb-2 w-80 rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl p-2 z-50 space-y-1.5 text-xs animate-in fade-in slide-in-from-bottom-1 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header info */}
            <div className="p-2 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-300">
                <span className="flex items-center gap-1.5 text-blue-400">
                  <Sparkles size={12} />
                  <span>{activeLabel}</span>
                </span>
                {nextEmailTask && (
                  <span className="px-1.5 py-0.5 rounded bg-blue-950 text-blue-300 text-[10px] border border-blue-800">
                    Active task
                  </span>
                )}
              </div>
              <div className="text-[11px] text-slate-400 truncate">
                <strong className="text-slate-300">Subject: </strong>
                {composeInfo?.rendered?.subject || 'Ready to send'}
              </div>
            </div>

            {/* Sender identity badge */}
            <div className="p-2 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between text-xs">
              <span className="text-[11px] text-slate-400">
                Signing as <strong className="text-white">{effectiveRep.name}</strong>
              </span>
              <span className="text-[10px] font-mono text-blue-400 bg-blue-950/60 px-2 py-0.5 rounded border border-blue-900/50">
                {effectiveRep.title}
              </span>
            </div>

            {/* Template Picker Toggle / Submenu */}
            {templatePickerOpen ? (
              <div className="space-y-1 pt-1 border-t border-slate-800">
                <div className="text-[10px] font-bold text-slate-400 px-2 uppercase tracking-wider flex items-center justify-between">
                  <span>Select Template</span>
                  <button
                    type="button"
                    onClick={() => setTemplatePickerOpen(false)}
                    className="text-blue-400 hover:underline text-[10px]"
                  >
                    Back
                  </button>
                </div>
                <div className="max-h-48 overflow-y-auto space-y-0.5 pr-0.5">
                  {POPULAR_TEMPLATES.map((tmpl) => (
                    <button
                      key={tmpl.key}
                      type="button"
                      onClick={() => {
                        setSelectedTemplateOverride(tmpl.key);
                        setTemplatePickerOpen(false);
                      }}
                      className={`w-full text-left px-2.5 py-2 rounded-xl text-xs font-semibold flex items-center justify-between transition ${
                        activeTemplateKey === tmpl.key
                          ? 'bg-blue-600/30 text-blue-200 border border-blue-500/40'
                          : 'hover:bg-slate-800 text-slate-300'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="font-bold text-white text-[11px] truncate">{tmpl.label}</div>
                        <div className="text-[10px] text-slate-400 truncate">{tmpl.subject}</div>
                      </div>
                      {activeTemplateKey === tmpl.key && <Check size={12} className="text-blue-400 shrink-0 ml-1" />}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-0.5 pt-1 border-t border-slate-800">
                {/* Switch Template */}
                <button
                  type="button"
                  onClick={() => setTemplatePickerOpen(true)}
                  className="w-full text-left px-2.5 py-2 rounded-xl text-xs font-medium text-slate-200 hover:bg-slate-800 transition flex items-center justify-between"
                >
                  <span className="flex items-center gap-2">
                    <Sparkles size={13} className="text-amber-400" />
                    <span>Choose another template</span>
                  </span>
                  <ChevronDown size={12} className="-rotate-90 text-slate-500" />
                </button>

                {/* Copy Draft */}
                <button
                  type="button"
                  onClick={handleCopyBody}
                  className="w-full text-left px-2.5 py-2 rounded-xl text-xs font-medium text-slate-200 hover:bg-slate-800 transition flex items-center gap-2"
                >
                  <Copy size={13} className="text-slate-400" />
                  <span>Copy email draft text</span>
                </button>

                {/* Search Inbox for Replies */}
                {composeInfo?.search && (
                  <a
                    href={composeInfo.search}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setMenuOpen(false)}
                    className="w-full text-left px-2.5 py-2 rounded-xl text-xs font-medium text-slate-200 hover:bg-slate-800 transition flex items-center gap-2"
                  >
                    <Search size={13} className="text-blue-400" />
                    <span>Check Gmail for replies</span>
                  </a>
                )}

                {/* Mark Sent if task present */}
                {nextEmailTask && !selectedTemplateOverride && (
                  <button
                    type="button"
                    onClick={handleMarkSent}
                    className="w-full text-left px-2.5 py-2 rounded-xl text-xs font-medium text-emerald-300 hover:bg-emerald-950/40 transition flex items-center gap-2"
                  >
                    <Check size={13} className="text-emerald-400" />
                    <span>Mark sent in follow-up sequence</span>
                  </button>
                )}

                {/* Skip if task present */}
                {nextEmailTask && !selectedTemplateOverride && (
                  <button
                    type="button"
                    onClick={handleSkip}
                    className="w-full text-left px-2.5 py-2 rounded-xl text-xs font-medium text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition flex items-center gap-2"
                  >
                    <FastForward size={13} className="text-slate-500" />
                    <span>Skip this follow-up email</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
