import React, { useState, useEffect } from 'react';
import { X, Settings, ShieldCheck, AlertCircle, Play, Check, Mail, Sparkles, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

export default function FollowupSettingsModal({
  isOpen,
  onClose,
  onSaved,
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [signatureName, setSignatureName] = useState('');
  const [signatureTitle, setSignatureTitle] = useState('');
  const [signaturePhone, setSignaturePhone] = useState('(289) 670-3357');
  const [gmailAddress, setGmailAddress] = useState('');
  const [mailingAddressSet, setMailingAddressSet] = useState(false);
  const [mailingAddress, setMailingAddress] = useState('');

  // Backfill launch tools state
  const [backfillLoading, setBackfillLoading] = useState(false);
  const [dryRunCount, setDryRunCount] = useState(null);
  const [runningBackfill, setRunningBackfill] = useState(false);
  const [repsGmail, setRepsGmail] = useState([]);
  const [runningAgentCycle, setRunningAgentCycle] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    Promise.all([
      fetch('/api/sales/followups/settings').then((res) => (res.ok ? res.json() : {})),
      fetch('/api/sales/followups/gmail/connect?status=1').then((res) => (res.ok ? res.json() : {})),
    ])
      .then(([data, gmailData]) => {
        const s = data.settings || {};
        setSignatureName(s.signature_name || 'Malik Campbell');
        setSignatureTitle(s.signature_title || 'Founder & CEO');
        setSignaturePhone(s.signature_phone || '(289) 670-3357');
        setGmailAddress(s.gmail_address || '');
        setMailingAddressSet(!!data.mailingAddressSet);
        setMailingAddress(data.mailingAddress || '');
        setRepsGmail(gmailData.reps || []);
      })
      .catch((err) => {
        toast.error(err?.message || 'Failed to load follow-up settings');
      })
      .finally(() => setLoading(false));
  }, [isOpen]);

  const handleRunAgentNow = async () => {
    setRunningAgentCycle(true);
    try {
      const res = await fetch('/api/sales/followups/cron/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'run_all', sendDigest: true }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Agent run failed');
      const sentCount = json.sendResult?.autoSent?.length || 0;
      const draftedCount = json.sendResult?.preDraftedWarm?.length || 0;
      const alertCount = json.inboxResult?.newAlertsCount || 0;
      toast.success(
        `Claude Sonnet 5.5 cycle complete: ${sentCount} auto-sent, ${draftedCount} pre-drafted, ${alertCount} new inbox replies found.`
      );
      if (onSaved) onSaved();
    } catch (err) {
      toast.error(err.message || 'Failed to run Claude agent cycle');
    } finally {
      setRunningAgentCycle(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/sales/followups/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signature_name: signatureName.trim() || undefined,
          signature_title: signatureTitle.trim() || undefined,
          signature_phone: signaturePhone.trim() || undefined,
          gmail_address: gmailAddress.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to save settings');
      }
      const data = await res.json();
      toast.success('Settings saved');
      if (onSaved) onSaved(data.settings);
      onClose();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDryRun = async () => {
    setBackfillLoading(true);
    try {
      const res = await fetch('/api/sales/followups/backfill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dryRun: true }),
      });
      if (!res.ok) throw new Error('Failed to query recent No Answer leads');
      const data = await res.json();
      setDryRunCount(data.count ?? 0);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBackfillLoading(false);
    }
  };

  const handleConfirmBackfill = async () => {
    setRunningBackfill(true);
    try {
      const res = await fetch('/api/sales/followups/backfill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dryRun: false }),
      });
      if (!res.ok) throw new Error('Backfill failed');
      const data = await res.json();
      toast.success(`Drip started for ${data.count || 0} leads`);
      setDryRunCount(null);
      if (onSaved) onSaved();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setRunningBackfill(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-6 text-slate-100 space-y-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-blue-400" />
            <h2 className="text-base font-semibold text-white">Follow-up settings</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="py-8 text-center text-sm text-slate-400">Loading settings...</div>
        ) : (
          <form onSubmit={handleSave} className="space-y-5">
            <div className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Name in signature
                </label>
                <input
                  type="text"
                  value={signatureName}
                  onChange={(e) => setSignatureName(e.target.value)}
                  placeholder="Malik Campbell"
                  required
                  className="w-full px-3 py-2 bg-slate-800/80 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Title
                </label>
                <input
                  type="text"
                  value={signatureTitle}
                  onChange={(e) => setSignatureTitle(e.target.value)}
                  placeholder="Founder & CEO"
                  className="w-full px-3 py-2 bg-slate-800/80 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Phone
                </label>
                <input
                  type="text"
                  value={signaturePhone}
                  onChange={(e) => setSignaturePhone(e.target.value)}
                  placeholder="(289) 670-3357"
                  className="w-full px-3 py-2 bg-slate-800/80 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Gmail address you send from
                </label>
                <input
                  type="email"
                  value={gmailAddress}
                  onChange={(e) => setGmailAddress(e.target.value)}
                  placeholder="malik@seaofblue.ca"
                  className="w-full px-3 py-2 bg-slate-800/80 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="p-3 bg-slate-800/40 rounded-lg border border-slate-800 text-xs text-slate-400">
                Turn off the automatic Gmail signature for new emails, or Gmail adds a second signature.
              </div>
            </div>

            {/* Mailing Address Status */}
            <div className="flex items-center gap-2 p-3 rounded-lg border text-xs bg-slate-800/40 border-slate-800">
              {mailingAddressSet ? (
                <>
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="text-emerald-300 font-medium">
                    Company mailing address: {mailingAddress || 'Set'}
                  </span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                  <span className="text-amber-300 font-medium">
                    Company mailing address: missing (sending is disabled)
                  </span>
                </>
              )}
            </div>

            {/* Signature Preview */}
            <div className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-lg">
              <span className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Signature preview
              </span>
              <div className="text-xs text-slate-300 font-mono space-y-1">
                <div>Best regards,</div>
                <div className="h-2" />
                <div className="font-semibold text-white">{signatureName || 'Your Name'}</div>
                {signatureTitle && <div>{signatureTitle}</div>}
                <div>Sea of Blue Inc.</div>
                <div>{signaturePhone || '(289) 670-3357'}</div>
                <div>seaofblue.ca</div>
              </div>
            </div>

            {/* Multi-Rep Gmail OAuth & Claude Sonnet 5.5 Agent Hub */}
            <div className="pt-2 border-t border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-semibold text-blue-400 uppercase tracking-wider">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Claude Sonnet 5.5 Gmail Auto-Drip & Inbox Scanner</span>
                </span>
                <button
                  type="button"
                  onClick={handleRunAgentNow}
                  disabled={runningAgentCycle}
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-500/40 text-indigo-200 rounded-lg text-[11px] font-semibold transition disabled:opacity-50"
                >
                  <RefreshCw className={`w-3 h-3 ${runningAgentCycle ? 'animate-spin' : ''}`} />
                  <span>{runningAgentCycle ? 'Running...' : 'Scan Inboxes & Auto-Send Now'}</span>
                </button>
              </div>

              <div className="p-3 bg-slate-950/90 border border-slate-800 rounded-lg space-y-2">
                <p className="text-[11px] text-slate-400">
                  Connect each rep&apos;s Google Workspace Gmail (`@seaofblue.app`) so Claude can auto-send No-Answer drips (after a 20m buffer) and scan inboxes for prospect replies & reminders.
                </p>
                <div className="space-y-1.5">
                  {repsGmail.map((rep) => (
                    <div
                      key={rep.key}
                      className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="font-semibold text-white flex items-center gap-1.5">
                          <span>{rep.name}</span>
                          <span className="text-[10px] text-slate-400 font-normal">({rep.title})</span>
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono truncate">{rep.email}</div>
                      </div>
                      {rep.connected ? (
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-700/50 text-emerald-300 text-[10px] font-semibold">
                            <Check className="w-3 h-3" /> Connected
                          </span>
                          <a
                            href={`/api/sales/followups/gmail/connect?rep=${rep.key}`}
                            className="text-[10px] text-slate-400 hover:text-white underline"
                          >
                            Reconnect
                          </a>
                        </div>
                      ) : (
                        <a
                          href={`/api/sales/followups/gmail/connect?rep=${rep.key}`}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-semibold transition shrink-0"
                        >
                          <Mail className="w-3 h-3" />
                          <span>Connect Gmail</span>
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Launch Tools Section */}
            <div className="pt-2 border-t border-slate-800">
              <span className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Launch tools
              </span>
              <div className="p-3 bg-slate-800/40 border border-slate-800 rounded-lg space-y-2">
                <p className="text-xs text-slate-300 font-medium">
                  Start the drip for recent no-answer leads
                </p>
                <p className="text-[11px] text-slate-400">
                  Enrolls leads with cold No Answer dials in the last 14 days who have an email on file.
                </p>
                {dryRunCount === null ? (
                  <button
                    type="button"
                    onClick={handleDryRun}
                    disabled={backfillLoading}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded text-xs font-medium transition disabled:opacity-50"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>{backfillLoading ? 'Checking...' : 'Check eligible leads'}</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-2 pt-1">
                    <span className="text-xs text-blue-300 font-medium">
                      {dryRunCount} eligible {dryRunCount === 1 ? 'lead' : 'leads'} found.
                    </span>
                    {dryRunCount > 0 && (
                      <button
                        type="button"
                        onClick={handleConfirmBackfill}
                        disabled={runningBackfill}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-medium transition disabled:opacity-50"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>{runningBackfill ? 'Starting...' : `Start for ${dryRunCount} leads`}</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="pt-2 flex gap-2">
              <button
                type="submit"
                disabled={saving}
                className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg text-sm transition shadow-sm disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save settings'}
              </button>
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-sm transition"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
