import React, { useState } from 'react';
import { Calendar, Clock, MapPin, User, HardHat, FileText, CheckCircle2, X, DollarSign } from 'lucide-react';

export default function WalkthroughModal({ isOpen, onClose, contact, onConfirm }) {
  if (!isOpen || !contact) return null;

  // Tomorrow 10 AM default
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const defaultDate = tomorrow.toISOString().split('T')[0];

  const [walkDate, setWalkDate] = useState(defaultDate);
  const [walkTime, setWalkTime] = useState('10:00');
  const [siteAddress, setSiteAddress] = useState(contact.city ? `${contact.city} Job Site` : '');
  const [siteContactName, setSiteContactName] = useState(contact.name || '');
  const [siteContactPhone, setSiteContactPhone] = useState(contact.phone || '');
  const [scopePhase, setScopePhase] = useState(
    contact.service_type?.toLowerCase().includes('construction')
      ? 'Final Turnover & HEPA Dust Extraction'
      : 'Dumpster Pad & Exterior Plaza Assessment'
  );
  const [estimatedValue, setEstimatedValue] = useState(contact.estimated_value || '2500');
  const [siteNotes, setSiteNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onConfirm({
        walkthroughDate: `${walkDate} ${walkTime}`,
        siteAddress,
        siteContactName,
        siteContactPhone,
        scopePhase,
        estimatedValue,
        siteNotes
      });
      onClose();
    } catch (err) {
      console.error('[WalkthroughModal] Error booking walkthrough:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="phone-modal-overlay" style={{ zIndex: 2500 }}>
      <div className="phone-modal-content" style={{ maxWidth: 540 }}>
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-blue-900/40">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1 rounded-md bg-blue-500/10 text-blue-400">
                <HardHat className="w-5 h-5 text-blue-400" />
              </span>
              <h3 className="text-lg font-black text-white">Book Site Walkthrough Assessment</h3>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Target: <strong className="text-white">{contact.company || contact.name}</strong>
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800 transition"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
          {/* Date & Time Row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold text-slate-300 block mb-1 flex items-center gap-1.5">
                <Calendar size={13} className="text-blue-400" /> Walkthrough Date *
              </label>
              <input
                type="date"
                required
                className="phone-search-input"
                style={{ padding: '8px 12px', colorScheme: 'dark' }}
                value={walkDate}
                onChange={e => setWalkDate(e.target.value)}
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-300 block mb-1 flex items-center gap-1.5">
                <Clock size={13} className="text-blue-400" /> Time *
              </label>
              <input
                type="time"
                required
                className="phone-search-input"
                style={{ padding: '8px 12px', colorScheme: 'dark' }}
                value={walkTime}
                onChange={e => setWalkTime(e.target.value)}
              />
            </div>
          </div>

          {/* Job Site Address */}
          <div>
            <label className="text-[11px] font-bold text-slate-300 block mb-1 flex items-center gap-1.5">
              <MapPin size={13} className="text-emerald-400" /> Job Site / Property Address *
            </label>
            <input
              type="text"
              required
              className="phone-search-input"
              style={{ padding: '8px 12px' }}
              placeholder="e.g. 1450 Main St E, Suite 200, Milton"
              value={siteAddress}
              onChange={e => setSiteAddress(e.target.value)}
            />
          </div>

          {/* On-Site Contact Details */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold text-slate-300 block mb-1 flex items-center gap-1.5">
                <User size={13} className="text-amber-400" /> On-Site Contact / Super
              </label>
              <input
                type="text"
                className="phone-search-input"
                style={{ padding: '8px 12px' }}
                placeholder="e.g. Dave Miller (Superintendent)"
                value={siteContactName}
                onChange={e => setSiteContactName(e.target.value)}
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-300 block mb-1 flex items-center gap-1.5">
                <Clock size={13} className="text-amber-400" /> On-Site Direct Cell
              </label>
              <input
                type="tel"
                className="phone-search-input"
                style={{ padding: '8px 12px' }}
                placeholder="(416) 555-0188"
                value={siteContactPhone}
                onChange={e => setSiteContactPhone(e.target.value)}
              />
            </div>
          </div>

          {/* Scope Phase & Est Bid */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="text-[11px] font-bold text-slate-300 block mb-1 flex items-center gap-1.5">
                <FileText size={13} className="text-indigo-400" /> Scope / Cleaning Phase
              </label>
              <input
                type="text"
                className="phone-search-input"
                style={{ padding: '8px 12px' }}
                placeholder="e.g. Post-con rough + final clean, window razor scraping"
                value={scopePhase}
                onChange={e => setScopePhase(e.target.value)}
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-300 block mb-1 flex items-center gap-1.5">
                <DollarSign size={13} className="text-emerald-400" /> Est. Bid Value ($)
              </label>
              <input
                type="number"
                className="phone-search-input"
                style={{ padding: '8px 12px' }}
                placeholder="2500"
                value={estimatedValue}
                onChange={e => setEstimatedValue(e.target.value)}
              />
            </div>
          </div>

          {/* Special Instructions (PPE, Gate Code, etc.) */}
          <div>
            <label className="text-[11px] font-bold text-slate-300 block mb-1">
              Site Access & Safety Protocols (PPE, Trailer Code, Parking)
            </label>
            <textarea
              className="phone-search-input"
              style={{ minHeight: 60, padding: '8px 12px', fontSize: '11px' }}
              placeholder="e.g. Steel toes + hard hat mandatory on site. Meet in Site Trailer #2. Park on north side."
              value={siteNotes}
              onChange={e => setSiteNotes(e.target.value)}
            />
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-800">
            <button
              type="button"
              className="phone-text-btn"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="phone-call-btn"
              style={{ background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', padding: '9px 18px' }}
              disabled={isSubmitting}
            >
              <CheckCircle2 size={15} /> Confirm Walkthrough Booking
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
