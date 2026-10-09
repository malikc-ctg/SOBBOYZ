import React, { useState, useEffect } from 'react';
import {
  X,
  Plus,
  Building2,
  User,
  Briefcase,
  Phone,
  Mail,
  MapPin,
  DollarSign,
  FileText,
  Layers,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { createNewPhoneLead } from '@/lib/sales/phoneService';
import { toast } from 'sonner';
import { SECTORS, STAGES } from './SalesKanbanBoard';

export default function AddLeadModal({
  isOpen,
  onClose,
  onSuccess,
  initialStage = 'new',
  initialSector = 'post_construction'
}) {
  const [formData, setFormData] = useState({
    companyName: '',
    contactName: '',
    contactTitle: '',
    phone: '',
    email: '',
    city: 'Toronto',
    sector: initialSector || 'post_construction',
    status: initialStage || 'new',
    quotedPrice: '2500',
    notes: ''
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Synchronize initial stage/sector when modal opens or props change
  useEffect(() => {
    if (isOpen) {
      setFormData(prev => ({
        ...prev,
        status: initialStage || 'new',
        sector: initialSector || prev.sector || 'post_construction'
      }));
      setErrorMsg('');
    }
  }, [isOpen, initialStage, initialSector]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen && !isSubmitting) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen) return null;

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errorMsg) setErrorMsg('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    const company = formData.companyName.trim();
    const contact = formData.contactName.trim();
    const phone = formData.phone.trim();
    const email = formData.email.trim();

    if (!company && !contact) {
      setErrorMsg('Please provide either a Company Name or Decision Maker Name.');
      return;
    }

    if (!phone && !email) {
      setErrorMsg('Please provide at least a Phone Number or Email to reach this lead.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const payload = {
        company_name: company || 'Commercial Prospect',
        customer_name: contact || 'Decision Maker',
        contact_title: formData.contactTitle.trim(),
        customer_phone: phone,
        customer_email: email,
        city: formData.city.trim() || 'GTA',
        service_type: formData.sector,
        sector: formData.sector,
        status: formData.status || 'new',
        quoted_price: formData.quotedPrice ? parseFloat(formData.quotedPrice) : 2500,
        notes: formData.notes.trim(),
        source: 'phone_sales_os'
      };

      const res = await createNewPhoneLead(payload);

      if (res?.success) {
        toast.success(`Lead "${company || contact}" added to pipeline!`);
        // Reset form
        setFormData({
          companyName: '',
          contactName: '',
          contactTitle: '',
          phone: '',
          email: '',
          city: 'Toronto',
          sector: 'post_construction',
          status: 'new',
          quotedPrice: '2500',
          notes: ''
        });
        if (onSuccess) {
          await onSuccess(res.lead || res);
        }
        onClose();
      } else {
        setErrorMsg(res?.error || 'Failed to create lead. Please check the details and try again.');
      }
    } catch (err) {
      console.error('[AddLeadModal] Exception creating lead:', err);
      setErrorMsg(err.message || 'An unexpected error occurred while saving the lead.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="phone-modal-overlay"
      style={{ zIndex: 2500 }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) onClose();
      }}
    >
      <div
        className="phone-modal-content"
        style={{
          maxWidth: 620,
          maxHeight: '92vh',
          overflowY: 'auto',
          backgroundColor: '#001429',
          borderColor: '#1e3a5f'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-950/80 border border-blue-800/80 flex items-center justify-center text-blue-400">
              <Plus size={18} />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white tracking-tight">
                Add Single Lead
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Add a decision maker or contractor directly to your outbound cold calling pipeline.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {errorMsg && (
          <div className="mt-3.5 p-3 rounded-xl bg-rose-950/50 border border-rose-800/80 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle size={15} className="shrink-0 text-rose-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Company Details */}
          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-3">
            <div className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Building2 size={13} className="text-blue-400" />
              <span>Company & Sector</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-400 block mb-1">
                  Company / Organization Name <span className="text-blue-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700/80 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
                  placeholder="e.g. EllisDon Construction"
                  value={formData.companyName}
                  onChange={e => handleChange('companyName', e.target.value)}
                  autoFocus
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-400 block mb-1">
                  City / Territory
                </label>
                <div className="relative">
                  <input
                    type="text"
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700/80 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
                    placeholder="Toronto / Mississauga / GTA"
                    value={formData.city}
                    onChange={e => handleChange('city', e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-400 block mb-1">
                  Industry / Sector
                </label>
                <select
                  value={formData.sector}
                  onChange={e => handleChange('sector', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700/80 text-white text-xs focus:outline-none focus:border-blue-500 transition cursor-pointer"
                >
                  {SECTORS.map(sec => (
                    <option key={sec.key} value={sec.key}>
                      {sec.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-400 block mb-1">
                  Initial Pipeline Stage
                </label>
                <select
                  value={formData.status}
                  onChange={e => handleChange('status', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700/80 text-white text-xs focus:outline-none focus:border-blue-500 transition cursor-pointer"
                >
                  {STAGES.map(st => (
                    <option key={st.key} value={st.key}>
                      {st.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Contact Details */}
          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-3">
            <div className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <User size={13} className="text-emerald-400" />
              <span>Decision Maker Details</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-400 block mb-1">
                  Decision Maker Name
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700/80 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
                  placeholder="e.g. Dan Miller"
                  value={formData.contactName}
                  onChange={e => handleChange('contactName', e.target.value)}
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-400 block mb-1">
                  Position / Role
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700/80 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
                  placeholder="Project Manager / Site Super / Owner"
                  value={formData.contactTitle}
                  onChange={e => handleChange('contactTitle', e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-400 block mb-1">
                  Direct Phone <span className="text-slate-500 font-normal">(or extension)</span>
                </label>
                <input
                  type="tel"
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700/80 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono transition"
                  placeholder="(416) 555-0199 or ext 204"
                  value={formData.phone}
                  onChange={e => handleChange('phone', e.target.value)}
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-400 block mb-1">
                  Direct Email
                </label>
                <input
                  type="email"
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700/80 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
                  placeholder="dmiller@company.com"
                  value={formData.email}
                  onChange={e => handleChange('email', e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Deal Value & Notes */}
          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-3">
            <div className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <DollarSign size={13} className="text-amber-400" />
              <span>Deal Target & Notes</span>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-400 block mb-1">
                Estimated Project / Contract Value ($)
              </label>
              <input
                type="number"
                min="0"
                step="50"
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700/80 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono transition"
                placeholder="2500"
                value={formData.quotedPrice}
                onChange={e => handleChange('quotedPrice', e.target.value)}
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-400 block mb-1">
                Notes & Intelligence
              </label>
              <textarea
                rows={3}
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700/80 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-blue-500 transition resize-none"
                placeholder="Job site location, gatekeeper instructions, direct extension, best time to call..."
                value={formData.notes}
                onChange={e => handleChange('notes', e.target.value)}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-slate-400 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-semibold transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1.5 transition shadow-lg shadow-blue-950/40 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  <span>Saving Lead...</span>
                </>
              ) : (
                <>
                  <Plus size={14} />
                  <span>Add Lead</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
