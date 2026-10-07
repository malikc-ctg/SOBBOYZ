import React from 'react';
import { PhoneCall, Calendar, X } from 'lucide-react';

export default function ContactedChoiceModal({
  isOpen,
  contact,
  onClose,
  onChoosePickup,
  onChooseCallback,
}) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-5 text-slate-100 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
          <div>
            <h2 className="text-sm font-semibold text-white">Moved to Contacted</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {contact?.name} {contact?.company ? `• ${contact.company}` : ''}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-slate-400">
          How did the contact go?
        </p>

        <div className="space-y-2">
          <button
            type="button"
            onClick={() => {
              onClose();
              onChoosePickup();
            }}
            className="w-full p-3 rounded-lg bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 hover:border-blue-500 text-left transition flex items-center gap-3 group"
          >
            <div className="p-2 rounded-md bg-blue-600/20 text-blue-400 group-hover:bg-blue-600 group-hover:text-white transition">
              <PhoneCall className="w-4 h-4" />
            </div>
            <div>
              <div className="text-sm font-medium text-white">Pick Up / Connected</div>
              <div className="text-xs text-slate-400">Log call notes and start follow-up</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              onClose();
              onChooseCallback();
            }}
            className="w-full p-3 rounded-lg bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 hover:border-blue-500 text-left transition flex items-center gap-3 group"
          >
            <div className="p-2 rounded-md bg-amber-600/20 text-amber-400 group-hover:bg-amber-600 group-hover:text-white transition">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <div className="text-sm font-medium text-white">Schedule Callback</div>
              <div className="text-xs text-slate-400">Pick a future date and time to call back</div>
            </div>
          </button>
        </div>

        <div className="pt-1">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-1.5 text-xs text-slate-400 hover:text-slate-200 transition text-center"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
