import React, { useState } from 'react';
import { X, DollarSign, Calendar, MapPin, Layers, FileText } from 'lucide-react';

export default function JobWonModal({
  isOpen,
  contact,
  onClose,
  onSubmit, // (saleDetails, skipDetails) => void
}) {
  const [contractValue, setContractValue] = useState(
    contact?.estimated_value ? String(contact.estimated_value) : ''
  );
  const [scopePhase, setScopePhase] = useState('Final Turnover Clean');
  const [siteAddress, setSiteAddress] = useState(contact?.address || '');
  const [scheduledCleanDate, setScheduledCleanDate] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleLogWithDetails = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const numVal = parseFloat(contractValue.replace(/[^0-9.]/g, '')) || 0;
      await onSubmit({
        job_total: numVal > 0 ? numVal : undefined,
        service_type: scopePhase.trim() || 'Final Turnover Clean',
        site_address: siteAddress.trim() || undefined,
        scheduled_clean_date: scheduledCleanDate || undefined,
        note: note.trim() || undefined,
      });
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogWithoutDetails = async () => {
    setSubmitting(true);
    try {
      await onSubmit({
        service_type: 'Final Turnover Clean',
      }, true);
      onClose();
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
        className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-6 text-slate-100 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h2 className="text-lg font-semibold text-white">Job Won</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {contact?.name} {contact?.company && contact.company !== 'Commercial Prospect' ? `• ${contact.company}` : ''}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleLogWithDetails} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Contract value ($)
            </label>
            <div className="relative">
              <DollarSign className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                value={contractValue}
                onChange={(e) => setContractValue(e.target.value)}
                placeholder="4500"
                className="w-full pl-9 pr-3 py-2 bg-slate-800/80 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Scope or phase
            </label>
            <div className="relative">
              <Layers className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                value={scopePhase}
                onChange={(e) => setScopePhase(e.target.value)}
                placeholder="Final Turnover Clean"
                className="w-full pl-9 pr-3 py-2 bg-slate-800/80 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Site address
            </label>
            <div className="relative">
              <MapPin className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                value={siteAddress}
                onChange={(e) => setSiteAddress(e.target.value)}
                placeholder="123 King St W, Toronto"
                className="w-full pl-9 pr-3 py-2 bg-slate-800/80 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Scheduled clean date
            </label>
            <div className="relative">
              <Calendar className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="date"
                value={scheduledCleanDate}
                onChange={(e) => setScheduledCleanDate(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-800/80 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Note
            </label>
            <div className="relative">
              <FileText className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                placeholder="Any special access, loading dock or site contacts..."
                className="w-full pl-9 pr-3 py-2 bg-slate-800/80 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="pt-2 flex flex-col gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg text-sm transition shadow-sm disabled:opacity-50"
            >
              {submitting ? 'Saving...' : 'Log Job Won'}
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleLogWithoutDetails}
                disabled={submitting}
                className="flex-1 py-2 bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white rounded-lg text-xs font-medium transition border border-slate-700"
              >
                Log without details
              </button>
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="flex-1 py-2 bg-transparent hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-lg text-xs font-medium transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
