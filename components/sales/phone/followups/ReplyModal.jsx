import React, { useState } from 'react';
import { X, MessageSquare } from 'lucide-react';

const REPLY_OPTIONS = [
  { id: 'want_to_talk', label: 'They want to talk' },
  { id: 'asked_for_info', label: 'They asked for info' },
  { id: 'booked_walkthrough', label: 'They booked a walkthrough' },
  { id: 'gave_referral', label: 'Gave me another contact' },
  { id: 'not_right_now', label: 'Not right now' },
  { id: 'not_interested', label: 'Not interested' },
  { id: 'stop_emailing', label: 'Stop emailing me' },
  { id: 'out_of_office', label: 'Out of office' },
  { id: 'something_else', label: 'Something else' },
];

export default function ReplyModal({
  isOpen,
  contact,
  onClose,
  onSelectOption, // (optionId) => void
}) {
  const [selected, setSelected] = useState('want_to_talk');

  if (!isOpen) return null;

  const handleContinue = () => {
    onSelectOption(selected);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-6 text-slate-100 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-blue-400" />
            <div>
              <h2 className="text-base font-semibold text-white">They replied</h2>
              <p className="text-xs text-slate-400">
                {contact?.name} {contact?.company ? `• ${contact.company}` : ''}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
            What did they say?
          </label>
          <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
            {REPLY_OPTIONS.map((opt) => (
              <label
                key={opt.id}
                className={`flex items-center px-3 py-2.5 rounded-lg border text-sm cursor-pointer transition ${
                  selected === opt.id
                    ? 'bg-blue-600/20 border-blue-500 text-white font-medium'
                    : 'bg-slate-800/60 border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <input
                  type="radio"
                  name="reply_choice"
                  value={opt.id}
                  checked={selected === opt.id}
                  onChange={() => setSelected(opt.id)}
                  className="w-4 h-4 text-blue-500 border-slate-700 bg-slate-900 focus:ring-0 mr-3"
                />
                <span>{opt.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="pt-2 flex gap-2">
          <button
            type="button"
            onClick={handleContinue}
            className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg text-sm transition shadow-sm"
          >
            Continue
          </button>
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
