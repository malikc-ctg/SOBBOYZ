import React, { useState, useMemo } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { toTorontoDate } from '@/lib/sales/followups/schedule';
import { parseTorontoLocal } from '@/lib/sales/followups/tz';

export default function CallbackModal({
  isOpen,
  lead,
  contact,
  isReschedule = false,
  onClose,
  onSubmit, // ({ date, time, note, sendConfirmation }) => void
}) {
  const targetLead = lead || contact;
  const now = new Date();
  const nowTz = toTorontoDate(now);

  const defaultDateStr = `${nowTz.getFullYear()}-${String(nowTz.getMonth() + 1).padStart(2, '0')}-${String(nowTz.getDate()).padStart(2, '0')}`;
  const defaultTimeStr = `${String((nowTz.getHours() + 2) % 24).padStart(2, '0')}:00`;

  const [dateStr, setDateStr] = useState(defaultDateStr);
  const [timeStr, setTimeStr] = useState(defaultTimeStr);
  const [note, setNote] = useState('');
  const [userTickedConfirmation, setUserTickedConfirmation] = useState(true);

  // Calculate chosen datetime in Toronto timezone
  const chosenInstant = useMemo(() => {
    if (!dateStr || !timeStr) return null;
    return parseTorontoLocal(`${dateStr} ${timeStr}`);
  }, [dateStr, timeStr]);

  const isFuture = useMemo(() => {
    if (!chosenInstant) return false;
    return chosenInstant.getTime() > Date.now();
  }, [chosenInstant]);

  const isLessThan2Hours = useMemo(() => {
    if (!chosenInstant) return false;
    const diffMs = chosenInstant.getTime() - Date.now();
    return diffMs < 2 * 60 * 60 * 1000;
  }, [chosenInstant]);

  if (!isOpen || !targetLead) return null;

  const hasEmail = Boolean(targetLead.email && targetLead.email.includes('@'));
  const sendConfirmation = hasEmail && !isLessThan2Hours && userTickedConfirmation;

  function handleSubmit(e) {
    e.preventDefault();
    if (!isFuture || !chosenInstant) return;

    onSubmit({
      date: dateStr,
      time: timeStr,
      callbackAt: chosenInstant.toISOString(),
      sendConfirmation,
      note: note.trim(),
    });
  }

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-5 text-white">
        <div className="flex items-start justify-between border-b border-slate-800 pb-3">
          <div>
            <h2 className="text-lg font-bold text-white">
              {isReschedule ? 'Reschedule Callback' : 'Schedule Callback'}
            </h2>
            <p className="text-xs text-slate-400">{targetLead?.name}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-200 mb-1">
                Date <span className="text-red-400">*</span>
              </label>
              <input
                type="date"
                required
                min={defaultDateStr}
                value={dateStr}
                onChange={(e) => setDateStr(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-200 mb-1">
                Time <span className="text-red-400">*</span>
              </label>
              <input
                type="time"
                step="900"
                required
                value={timeStr}
                onChange={(e) => setTimeStr(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {!isFuture && (
            <p className="text-red-400 text-xs flex items-center gap-1 font-semibold">
              <AlertCircle size={13} />
              Pick a time in the future.
            </p>
          )}

          <div>
            <label className="block font-semibold text-slate-200 mb-1">Note (optional)</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Discuss site turnover schedule"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="pt-2 border-t border-slate-800 space-y-1">
            <label
              className={`flex items-center gap-2 font-medium ${
                !hasEmail || isLessThan2Hours
                  ? 'text-slate-500 cursor-not-allowed'
                  : 'text-slate-200 cursor-pointer'
              }`}
            >
              <input
                type="checkbox"
                disabled={!hasEmail || isLessThan2Hours}
                checked={sendConfirmation}
                onChange={(e) => setUserTickedConfirmation(e.target.checked)}
                className="rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-0"
              />
              Send a confirmation email
            </label>
            {!hasEmail && (
              <p className="text-[11px] text-amber-400 pl-6">No email on file</p>
            )}
            {hasEmail && isLessThan2Hours && (
              <p className="text-[11px] text-slate-400 pl-6">Less than 2 hours away</p>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-slate-800 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 rounded-xl text-slate-400 hover:text-white text-xs transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!isFuture}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition shadow-sm ${
                isFuture
                  ? 'bg-blue-600 hover:bg-blue-500 text-white'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              {isReschedule ? 'Reschedule callback' : 'Schedule callback'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
