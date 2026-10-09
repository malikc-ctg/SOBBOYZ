import React, { useState, useMemo } from 'react';
import { X, DollarSign, Calendar, MapPin, Layers, FileText, Repeat } from 'lucide-react';
import { calculateMonthlyMRR } from '@/lib/recurring-utils';

const WEEKDAYS = [
  { id: 'monday', label: 'Mon' },
  { id: 'tuesday', label: 'Tue' },
  { id: 'wednesday', label: 'Wed' },
  { id: 'thursday', label: 'Thu' },
  { id: 'friday', label: 'Fri' },
  { id: 'saturday', label: 'Sat' },
  { id: 'sunday', label: 'Sun' },
];

export default function JobWonModal({
  isOpen,
  contact,
  onClose,
  onSubmit, // (saleDetails, skipDetails) => void
}) {
  const [isRecurring, setIsRecurring] = useState(false);
  const [frequency, setFrequency] = useState('weekly');
  const [daysOfWeek, setDaysOfWeek] = useState(['monday']);
  const [contractValue, setContractValue] = useState(
    contact?.estimated_value ? String(contact.estimated_value) : ''
  );
  const [scopePhase, setScopePhase] = useState('Final Turnover Clean');
  const [siteAddress, setSiteAddress] = useState(contact?.address || '');
  const [scheduledCleanDate, setScheduledCleanDate] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Live MRR calculation for recurring deals
  const numVal = parseFloat(contractValue.replace(/[^0-9.]/g, '')) || 0;
  const mrrPreview = useMemo(() => {
    if (!isRecurring || numVal <= 0) return 0;
    return calculateMonthlyMRR(numVal, frequency, frequency === 'weekly' ? daysOfWeek : []);
  }, [isRecurring, numVal, frequency, daysOfWeek]);

  if (!isOpen) return null;

  const toggleDay = (dayId) => {
    setDaysOfWeek((prev) =>
      prev.includes(dayId)
        ? prev.length > 1
          ? prev.filter((d) => d !== dayId)
          : prev
        : [...prev, dayId]
    );
  };

  const handleLogWithDetails = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        job_total: numVal > 0 ? numVal : undefined,
        price_per_visit: isRecurring && numVal > 0 ? numVal : undefined,
        service_type: scopePhase.trim() || 'Final Turnover Clean',
        site_address: siteAddress.trim() || undefined,
        scheduled_clean_date: scheduledCleanDate || undefined,
        note: note.trim() || undefined,
        is_recurring: isRecurring,
        frequency: isRecurring ? frequency : undefined,
        days_of_week: isRecurring && frequency === 'weekly' ? daysOfWeek : [],
        preferred_day_of_week:
          isRecurring && frequency === 'weekly' && daysOfWeek.length === 1
            ? daysOfWeek[0]
            : null,
      };
      await onSubmit(payload);
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogWithoutDetails = async () => {
    setSubmitting(true);
    try {
      await onSubmit(
        {
          service_type: 'Final Turnover Clean',
          is_recurring: false,
        },
        true
      );
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
        className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-6 text-slate-100 space-y-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h2 className="text-lg font-semibold text-white">Log Won Deal</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {contact?.name}{' '}
              {contact?.company && contact.company !== 'Commercial Prospect'
                ? `| ${contact.company}`
                : ''}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nature of Sale: One-Time vs Recurring Toggle */}
        <div className="grid grid-cols-2 gap-2 p-1 bg-slate-800/80 rounded-lg border border-slate-700">
          <button
            type="button"
            onClick={() => setIsRecurring(false)}
            className={`py-1.5 text-xs font-semibold rounded transition ${
              !isRecurring
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            One-Time Project
          </button>
          <button
            type="button"
            onClick={() => setIsRecurring(true)}
            className={`py-1.5 text-xs font-semibold rounded flex items-center justify-center gap-1.5 transition ${
              isRecurring
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Repeat className="w-3.5 h-3.5" />
            Recurring Service
          </button>
        </div>

        <form onSubmit={handleLogWithDetails} className="space-y-3.5">
          {/* Price Input & MRR Preview */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-medium text-slate-300">
                {isRecurring ? 'Price per clean ($)' : 'Contract value ($)'}
              </label>
              {isRecurring && mrrPreview > 0 && (
                <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2 py-0.5 rounded">
                  MRR: ${mrrPreview.toFixed(2)}/mo
                </span>
              )}
            </div>
            <div className="relative">
              <DollarSign className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                value={contractValue}
                onChange={(e) => setContractValue(e.target.value)}
                placeholder={isRecurring ? '180' : '4500'}
                className="w-full pl-9 pr-3 py-2 bg-slate-800/80 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Recurring Options */}
          {isRecurring && (
            <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700/80 space-y-3 animate-in fade-in duration-150">
              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-1">
                  Service Frequency
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { id: 'weekly', label: 'Weekly' },
                    { id: 'biweekly', label: 'Bi-Weekly' },
                    { id: 'monthly', label: 'Monthly' },
                  ].map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setFrequency(f.id)}
                      className={`py-1 text-xs rounded border transition ${
                        frequency === f.id
                          ? 'bg-blue-600/30 border-blue-500 text-blue-300 font-semibold'
                          : 'bg-slate-800/70 border-slate-700 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {frequency === 'weekly' && (
                <div>
                  <label className="block text-[11px] font-medium text-slate-300 mb-1">
                    Scheduled Days ({daysOfWeek.length}x/wk)
                  </label>
                  <div className="flex gap-1">
                    {WEEKDAYS.map((d) => (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => toggleDay(d.id)}
                        className={`flex-1 py-1 text-[11px] rounded font-medium transition ${
                          daysOfWeek.includes(d.id)
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700'
                        }`}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Scope or service type
            </label>
            <div className="relative">
              <Layers className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                value={scopePhase}
                onChange={(e) => setScopePhase(e.target.value)}
                placeholder={isRecurring ? 'Weekly Maintenance Clean' : 'Final Turnover Clean'}
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
              {isRecurring ? 'First clean / contract start date' : 'Scheduled clean date'}
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
              Notes or access instructions
            </label>
            <div className="relative">
              <FileText className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                placeholder="Key lockbox, loading dock, buzzer or client notes..."
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
              {submitting
                ? 'Provisioning...'
                : isRecurring
                ? 'Create Recurring Agreement & Schedule'
                : 'Confirm & Schedule Clean'}
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleLogWithoutDetails}
                disabled={submitting}
                className="flex-1 py-2 bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white rounded-lg text-xs font-medium transition border border-slate-700"
              >
                Log won without details
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
