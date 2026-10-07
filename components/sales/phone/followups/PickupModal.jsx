import React, { useState, useMemo } from 'react';
import { X, Mail } from 'lucide-react';
import { renderEmail } from '@/lib/sales/followups/render';

export default function PickupModal({
  isOpen,
  lead,
  contact,
  openFollowupType, // 'info_sent_followup' | 'walkthrough' | 'quote_followup' | null
  repSettings,
  onClose,
  onSubmit, // (capture) => void
}) {
  const targetLead = lead || contact;
  const [callNote, setCallNote] = useState('');
  const [nextStep, setNextStep] = useState('');
  const [projectName, setProjectName] = useState('');
  const [email, setEmail] = useState(targetLead?.email || '');
  const [sendRecap, setSendRecap] = useState(true);
  const [hasReferral, setHasReferral] = useState(false);
  const [referredName, setReferredName] = useState('');
  const [referredTitle, setReferredTitle] = useState('');
  const [referredPhone, setReferredPhone] = useState('');
  const [referredEmail, setReferredEmail] = useState('');

  // Live preview of recap email
  const preview = useMemo(() => {
    if (!targetLead) return null;
    try {
      return renderEmail({
        templateKey: 'pickup_recap',
        lead: {
          customer_name: targetLead.name,
          company_name: targetLead.company,
        },
        rep: {
          signature_name: repSettings?.signature_name || 'Malik Campbell',
          signature_title: repSettings?.signature_title,
          signature_phone: repSettings?.signature_phone,
        },
        context: {
          callNote: callNote || 'our discussion',
          nextStep: nextStep || 'follow up with you',
        },
        mailingAddressOverride: repSettings?.mailingAddress || undefined,
      });
    } catch {
      return null;
    }
  }, [callNote, nextStep, targetLead, repSettings]);

  if (!isOpen || !targetLead) return null;

  const isCompanyPlaceholder =
    !targetLead.company || targetLead.company.toLowerCase() === 'commercial prospect';
  const subtitle = isCompanyPlaceholder
    ? targetLead.name
    : `${targetLead.name} at ${targetLead.company}`;

  const isNoteCase = Boolean(openFollowupType);
  const openSeqLabel =
    openFollowupType === 'info_sent_followup'
      ? 'Info sent'
      : openFollowupType === 'walkthrough'
      ? 'Walkthrough'
      : openFollowupType === 'quote_followup'
      ? 'Quote'
      : '';

  const isValid =
    callNote.trim().length >= 10 &&
    callNote.trim().length <= 300 &&
    nextStep.trim().length >= 5 &&
    nextStep.trim().length <= 200 &&
    (!hasReferral || referredName.trim().length > 0);

  function handleLogWithFollowup() {
    onSubmit({
      noFollowup: false,
      callNote: callNote.trim(),
      nextStep: nextStep.trim(),
      projectName: projectName.trim(),
      email: email.trim(),
      sendRecap,
      referral: hasReferral
        ? {
            name: referredName.trim(),
            title: referredTitle.trim(),
            phone: referredPhone.trim(),
            email: referredEmail.trim(),
          }
        : null,
    });
  }

  function handleLogWithoutFollowup() {
    onSubmit({
      noFollowup: true,
      callNote: callNote.trim(),
      nextStep: nextStep.trim(),
      projectName: projectName.trim(),
      email: email.trim(),
    });
  }

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl p-6 space-y-5 text-white">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-800 pb-3">
          <div>
            <h2 className="text-lg font-bold text-white">Pick Up / Connected</h2>
            <p className="text-xs text-slate-400">{subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        {/* Existing Follow-up Banner */}
        {isNoteCase && (
          <div className="rounded-xl bg-blue-950/60 border border-blue-800/80 p-3 text-xs text-blue-200 space-y-2">
            <p>
              This lead has an open {openSeqLabel} follow-up. Your note is saved to it and no new sequence starts.
            </p>
            <label className="flex items-center gap-2 cursor-pointer font-medium text-white">
              <input
                type="checkbox"
                checked={sendRecap}
                onChange={(e) => setSendRecap(e.target.checked)}
                className="rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-0"
              />
              Send a recap email
            </label>
          </div>
        )}

        {/* Form Fields */}
        <div className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-200 mb-1">
              What did they tell you? <span className="text-red-400">*</span>
            </label>
            <textarea
              rows={2}
              value={callNote}
              onChange={(e) => setCallNote(e.target.value)}
              placeholder="two fit-outs finishing in November, and their own crew does the final clean"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
            />
            <p className="text-[11px] text-slate-400 mt-0.5">
              This finishes the sentence &quot;You mentioned ...&quot; in the recap email. Example: two fit-outs finishing in November, and their own crew does the final clean. (10 to 300 characters)
            </p>
          </div>

          <div>
            <label className="block font-semibold text-slate-200 mb-1">
              Agreed next step <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={nextStep}
              onChange={(e) => setNextStep(e.target.value)}
              placeholder="you will send me the address and square footage for the Mississauga project"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
            />
            <p className="text-[11px] text-slate-400 mt-0.5">
              This finishes &quot;Next step: ...&quot;. Example: you will send me the address and square footage for the Mississauga project. (5 to 200 characters)
            </p>
          </div>

          <div>
            <label className="block font-semibold text-slate-200 mb-1">
              Project they mentioned (optional)
            </label>
            <input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="the Square One fit-out"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
            />
            <p className="text-[11px] text-slate-400 mt-0.5">
              Used in the Day 3 email. Example: the Square One fit-out.
            </p>
          </div>

          <div>
            <label className="block font-semibold text-slate-200 mb-1">
              Their email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="prospect@company.com"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
            />
            <p className="text-[11px] text-slate-400 mt-0.5">Saved to the lead.</p>
          </div>

          {/* Referral Section */}
          <div className="pt-2 border-t border-slate-800">
            <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-200">
              <input
                type="checkbox"
                checked={hasReferral}
                onChange={(e) => setHasReferral(e.target.checked)}
                className="rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-0"
              />
              They referred me to someone else
            </label>

            {hasReferral && (
              <div className="mt-3 p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Referred contact name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={referredName}
                    onChange={(e) => setReferredName(e.target.value)}
                    placeholder="Jane Cooper"
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white"
                  />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="text"
                    value={referredTitle}
                    onChange={(e) => setReferredTitle(e.target.value)}
                    placeholder="Title"
                    className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white"
                  />
                  <input
                    type="tel"
                    value={referredPhone}
                    onChange={(e) => setReferredPhone(e.target.value)}
                    placeholder="Phone"
                    className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white"
                  />
                  <input
                    type="email"
                    value={referredEmail}
                    onChange={(e) => setReferredEmail(e.target.value)}
                    placeholder="Email"
                    className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Live Preview */}
        {preview && (
          <div className="rounded-xl bg-slate-950 border border-slate-800 p-4 space-y-2">
            <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Mail size={12} className="text-blue-400" />
              Recap email preview
            </h4>
            <div className="text-xs text-slate-300 font-mono whitespace-pre-wrap leading-relaxed max-h-40 overflow-y-auto">
              <div className="font-semibold text-blue-300 mb-1">Subject: {preview.subject}</div>
              {preview.body}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between border-t border-slate-800 pt-4">
          <button
            type="button"
            onClick={handleLogWithoutFollowup}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition"
          >
            Log without follow-up
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-xl text-slate-400 hover:text-white text-xs transition"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!isValid}
              onClick={handleLogWithFollowup}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition shadow-sm ${
                isValid
                  ? 'bg-blue-600 hover:bg-blue-500 text-white'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              {isNoteCase ? 'Log and save note' : 'Log and start follow-up'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
