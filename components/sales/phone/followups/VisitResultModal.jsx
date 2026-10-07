import React, { useState } from 'react';
import { X, CheckCircle, UserX, Calendar, Ban } from 'lucide-react';

const VISIT_OPTIONS = [
  {
    id: 'completed',
    label: 'Completed',
    helper: 'The quote email is due within 24 hours.',
    icon: CheckCircle,
    color: 'text-emerald-400',
  },
  {
    id: 'no_show',
    label: 'No-show',
    helper: 'Sends a reschedule email.',
    icon: UserX,
    color: 'text-amber-400',
  },
  {
    id: 'rescheduled',
    label: 'Rescheduled',
    helper: 'Pick a new date and time for the walkthrough.',
    icon: Calendar,
    color: 'text-blue-400',
  },
  {
    id: 'cancelled',
    label: 'Cancelled by them',
    helper: 'Sets a call for the next business day.',
    icon: Ban,
    color: 'text-rose-400',
  },
];

export default function VisitResultModal({
  isOpen,
  contact,
  onClose,
  onSubmit, // (resultId) => void
  onReschedule, // () => void
}) {
  const [selected, setSelected] = useState('completed');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleContinue = async () => {
    if (selected === 'rescheduled') {
      onClose();
      if (onReschedule) onReschedule();
      return;
    }

    setLoading(true);
    try {
      await onSubmit(selected);
      onClose();
    } finally {
      setLoading(false);
    }
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
            <h2 className="text-base font-semibold text-white">How did the walkthrough go?</h2>
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

        <div className="space-y-2">
          {VISIT_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const isSelected = selected === opt.id;
            return (
              <div
                key={opt.id}
                onClick={() => setSelected(opt.id)}
                className={`p-3 rounded-lg border cursor-pointer transition flex items-start gap-3 ${
                  isSelected
                    ? 'bg-blue-600/15 border-blue-500'
                    : 'bg-slate-800/50 border-slate-800 hover:bg-slate-800/80'
                }`}
              >
                <input
                  type="radio"
                  name="visit_result"
                  value={opt.id}
                  checked={isSelected}
                  onChange={() => setSelected(opt.id)}
                  className="mt-1 w-4 h-4 text-blue-500 border-slate-700 bg-slate-900 focus:ring-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Icon className={`w-4 h-4 ${opt.color}`} />
                    <span className="text-sm font-medium text-white">{opt.label}</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">{opt.helper}</p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="pt-2 flex gap-2">
          <button
            type="button"
            onClick={handleContinue}
            disabled={loading}
            className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg text-sm transition shadow-sm disabled:opacity-50"
          >
            {loading ? 'Saving...' : 'Continue'}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-sm transition"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
