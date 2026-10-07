import React, { useState } from 'react';
import { X, Calendar, PauseCircle } from 'lucide-react';

export default function OutOfOfficeModal({
  isOpen,
  contact,
  onClose,
  onSubmit, // (backOnDate) => Promise<void>
}) {
  // Default to 7 days from today
  const defaultDate = React.useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  }, []);

  const [backOn, setBackOn] = useState(defaultDate);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!backOn) {
      setError('Please select a return date.');
      return;
    }

    setError('');
    setSubmitting(true);
    try {
      await onSubmit(backOn);
      onClose();
    } catch (err) {
      setError(err?.message || 'Failed to pause follow-ups');
    } finally {
      setSubmitting(false);
    }
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
            <PauseCircle className="w-5 h-5 text-amber-400" />
            <h2 className="text-base font-semibold text-white">Out of office</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-slate-400 leading-relaxed">
          Pause all follow-up steps for {contact?.name} until they return.
        </p>

        {error && (
          <div className="text-xs text-red-400 bg-red-950/50 border border-red-800 p-2.5 rounded-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Back on
            </label>
            <div className="relative">
              <Calendar className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="date"
                value={backOn}
                onChange={(e) => setBackOn(e.target.value)}
                required
                className="w-full pl-9 pr-3 py-2 bg-slate-800/80 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="pt-2 flex gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-2 bg-amber-600 hover:bg-amber-500 text-white font-medium rounded-lg text-sm transition shadow-sm disabled:opacity-50"
            >
              {submitting ? 'Pausing...' : 'Pause follow-ups'}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
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
