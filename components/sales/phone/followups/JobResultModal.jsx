import React, { useState } from 'react';
import { X, CheckCircle, AlertTriangle, Calendar, Ban } from 'lucide-react';

const JOB_OPTIONS = [
  {
    id: 'completed',
    label: 'Completed',
    helper: 'Schedules referral and next project emails.',
    icon: CheckCircle,
    color: 'text-emerald-400',
  },
  {
    id: 'completed_issues',
    label: 'Completed, client had issues',
    helper: 'Schedules a call immediately to resolve client issues.',
    icon: AlertTriangle,
    color: 'text-amber-400',
  },
  {
    id: 'rescheduled',
    label: 'Rescheduled',
    helper: 'Pick a new scheduled clean date.',
    icon: Calendar,
    color: 'text-blue-400',
  },
  {
    id: 'cancelled',
    label: 'Cancelled',
    helper: 'Stops customer follow-ups.',
    icon: Ban,
    color: 'text-rose-400',
  },
];

export default function JobResultModal({
  isOpen,
  contact,
  onClose,
  onSubmit, // ({ result, rescheduledDate }) => Promise<void>
}) {
  const [selected, setSelected] = useState('completed');
  const [rescheduledDate, setRescheduledDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (selected === 'rescheduled' && !rescheduledDate) {
      setError('Please select a new date for the clean.');
      return;
    }

    setError('');
    setLoading(true);
    try {
      await onSubmit({
        result: selected,
        rescheduledDate: selected === 'rescheduled' ? rescheduledDate : undefined,
      });
      onClose();
    } catch (err) {
      setError(err?.message || 'Failed to record job result');
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
            <h2 className="text-base font-semibold text-white">Was the job completed?</h2>
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

        {error && (
          <div className="text-xs text-red-400 bg-red-950/50 border border-red-800 p-2.5 rounded-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-2">
            {JOB_OPTIONS.map((opt) => {
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
                    name="job_result"
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

          {selected === 'rescheduled' && (
            <div className="pt-2">
              <label className="block text-xs font-medium text-slate-300 mb-1">
                New clean date <span className="text-red-400">*</span>
              </label>
              <input
                type="date"
                value={rescheduledDate}
                onChange={(e) => setRescheduledDate(e.target.value)}
                required
                className="w-full px-3 py-2 bg-slate-800/80 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-blue-500"
              />
            </div>
          )}

          <div className="pt-2 flex gap-2">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg text-sm transition shadow-sm disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Submit'}
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
        </form>
      </div>
    </div>
  );
}
