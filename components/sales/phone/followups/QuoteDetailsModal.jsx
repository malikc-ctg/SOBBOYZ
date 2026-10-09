import React, { useState, useMemo } from 'react';
import { X, ExternalLink, Paperclip } from 'lucide-react';
import { gmailComposeUrl } from '@/lib/sales/followups/compose';
import { renderEmail } from '@/lib/sales/followups/render';
import { resolveRepConfig } from '@/lib/sales/followups/config';

export default function QuoteDetailsModal({
  isOpen,
  contact,
  task,
  enrollment,
  repSettings,
  mailingAddressSet,
  onClose,
  onSubmitDetails, // ({ quote_amount, scope_phase }) => Promise<void>
  onOpenFired, // () => void
}) {
  const [quoteAmount, setQuoteAmount] = useState(
    enrollment?.context?.quoteAmount || ''
  );
  const [scopePhase, setScopePhase] = useState(
    enrollment?.context?.scopePhase || 'Final Turnover Clean'
  );

  const effectiveRep = useMemo(() => {
    if (task?.assigned_rep_id) return resolveRepConfig(task.assigned_rep_id);
    if (enrollment?.owner_rep_id) return resolveRepConfig(enrollment.owner_rep_id);
    if (repSettings?.signature_name) return resolveRepConfig(repSettings.signature_name);
    return resolveRepConfig('malik');
  }, [task?.assigned_rep_id, enrollment?.owner_rep_id, repSettings]);

  const composeUrl = useMemo(() => {
    if (!task || !contact?.email || !mailingAddressSet) return '#';
    try {
      const rendered = renderEmail({
        templateKey: 'wt_quote',
        lead: {
          customer_name: contact.name,
          company_name: contact.company,
        },
        rep: {
          signature_name: effectiveRep.name,
          signature_title: effectiveRep.title,
          signature_phone: effectiveRep.phone,
        },
        context: {
          ...(enrollment?.context || {}),
          quoteAmount: quoteAmount.trim() || undefined,
          scopePhase: scopePhase.trim() || undefined,
        },
        anchorAt: enrollment?.anchor_at,
        mailingAddressOverride: repSettings?.mailingAddress || undefined,
      });

      const { url } = gmailComposeUrl({
        from: effectiveRep.gmail_address || undefined,
        to: contact.email,
        subject: rendered.subject,
        body: rendered.body,
      });
      return url;
    } catch {
      return '#';
    }
  }, [task, contact, mailingAddressSet, quoteAmount, scopePhase, effectiveRep, repSettings, enrollment]);

  if (!isOpen) return null;

  const handleContinueClick = () => {
    // Save details and fire open without awaiting
    onSubmitDetails({
      quote_amount: quoteAmount.trim() || undefined,
      scope_phase: scopePhase.trim() || undefined,
    }).catch(() => {});
    if (onOpenFired) onOpenFired();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-6 text-slate-100 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h2 className="text-base font-semibold text-white">Quote details</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {contact?.name} {contact?.company ? `• ${contact.company}` : ''}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Quote amount, written the way it should appear
            </label>
            <input
              type="text"
              value={quoteAmount}
              onChange={(e) => setQuoteAmount(e.target.value)}
              placeholder="$3,200 plus HST"
              className="w-full px-3 py-2 bg-slate-800/80 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Scope or phase
            </label>
            <input
              type="text"
              value={scopePhase}
              onChange={(e) => setScopePhase(e.target.value)}
              placeholder="Final Turnover Clean"
              className="w-full px-3 py-2 bg-slate-800/80 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex items-start gap-2.5 p-3 rounded-lg bg-amber-950/40 border border-amber-800/60 text-amber-300 text-xs">
            <Paperclip className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <span>Attach your quote PDF in Gmail before you send.</span>
          </div>
        </div>

        <div className="pt-2 flex gap-2">
          {composeUrl !== '#' ? (
            <a
              href={composeUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleContinueClick}
              className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg text-sm transition shadow-sm text-center flex items-center justify-center gap-1.5"
            >
              <span>Continue to Gmail</span>
              <ExternalLink className="w-4 h-4" />
            </a>
          ) : (
            <button
              disabled
              className="flex-1 py-2 bg-slate-800 text-slate-500 font-medium rounded-lg text-sm cursor-not-allowed text-center"
            >
              Continue to Gmail
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-sm transition"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
