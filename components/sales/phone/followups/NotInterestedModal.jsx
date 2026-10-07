import React, { useState } from 'react';
import { X } from 'lucide-react';

export default function NotInterestedModal({
  isOpen,
  lead,
  contact,
  defaultChoice = 'no_projects',
  onClose,
  onSubmit, // ({ choice, note }) => void
}) {
  const targetLead = lead || contact;
  const [choice, setChoice] = useState(defaultChoice);
  const [note, setNote] = useState('');

  if (!isOpen || !targetLead) return null;

  function handleSubmit(e) {
    e.preventDefault();
    onSubmit({ choice, note: note.trim() });
  }

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-5 text-white">
        <div className="flex items-start justify-between border-b border-slate-800 pb-3">
          <div>
            <h2 className="text-lg font-bold text-white">Not Interested</h2>
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
          <div className="space-y-2.5">
            <label className="block font-semibold text-slate-200">What did they say?</label>

            <div
              onClick={() => setChoice('no_projects')}
              className={`p-3 rounded-xl border cursor-pointer transition flex items-start gap-3 ${
                choice === 'no_projects'
                  ? 'bg-blue-950/40 border-blue-600 text-white'
                  : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
              }`}
            >
              <input
                type="radio"
                name="not_interested_choice"
                checked={choice === 'no_projects'}
                onChange={() => setChoice('no_projects')}
                className="mt-0.5"
              />
              <div>
                <div className="font-semibold text-xs">No projects right now</div>
                <div className="text-[11px] text-slate-400">
                  A recheck call is set for 90 days from today.
                </div>
              </div>
            </div>

            <div
              onClick={() => setChoice('not_interested')}
              className={`p-3 rounded-xl border cursor-pointer transition flex items-start gap-3 ${
                choice === 'not_interested'
                  ? 'bg-blue-950/40 border-blue-600 text-white'
                  : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
              }`}
            >
              <input
                type="radio"
                name="not_interested_choice"
                checked={choice === 'not_interested'}
                onChange={() => setChoice('not_interested')}
                className="mt-0.5"
              />
              <div>
                <div className="font-semibold text-xs">Not interested</div>
                <div className="text-[11px] text-slate-400">All follow-ups stop.</div>
              </div>
            </div>

            <div
              onClick={() => setChoice('do_not_contact')}
              className={`p-3 rounded-xl border cursor-pointer transition flex items-start gap-3 ${
                choice === 'do_not_contact'
                  ? 'bg-red-950/40 border-red-600 text-red-200'
                  : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
              }`}
            >
              <input
                type="radio"
                name="not_interested_choice"
                checked={choice === 'do_not_contact'}
                onChange={() => setChoice('do_not_contact')}
                className="mt-0.5"
              />
              <div>
                <div className="font-semibold text-xs text-red-400">Do not contact</div>
                <div className="text-[11px] text-slate-400">
                  No calls or emails, ever. Use this only when they ask.
                </div>
              </div>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-200 mb-1">Note (optional)</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. In-house cleaning staff on salary"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
            />
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
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition shadow-sm"
            >
              Log Not Interested
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
