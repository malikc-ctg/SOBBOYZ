import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Building2,
  ClipboardCheck,
  FileSpreadsheet,
  ShieldCheck,
  Globe,
  Mail,
  Calendar,
  Users,
  Check,
  ArrowRight,
} from 'lucide-react';

const CHECKLIST_ITEMS = [
  { id: 'coi', label: 'COI ($2M–$5M Liability Insurance)', shortLabel: 'COI Insurance' },
  { id: 'wsib', label: 'WSIB Clearance Certificate', shortLabel: 'WSIB Clearance' },
  { id: 'profile', label: 'Company Profile / Capability One-Pager', shortLabel: 'One-Pager' },
  { id: 'references', label: 'Commercial Trade References', shortLabel: 'References' },
  { id: 'portal', label: 'Portal Registration (BuildingConnected / Procore)', shortLabel: 'Portal Reg' },
];

function normalizeCompanyKey(name) {
  if (!name) return '';
  return String(name)
    .toLowerCase()
    .replace(/\b(inc|incorporated|ltd|limited|corp|corporation|group|llc|gsc|co)\b/gi, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

export default function VendorListModal({
  isOpen,
  contact,
  allContacts = [],
  onClose,
  onSubmit,
}) {
  const [procurementMode, setProcurementMode] = useState('vendor_list'); // 'vendor_list' | 'bid_tender' | 'both'
  const [requiredItems, setRequiredItems] = useState(['coi', 'wsib', 'profile']);
  const [completedItems, setCompletedItems] = useState([]);
  const [approvalStatus, setApprovalStatus] = useState('pending_submission'); // 'pending_submission' | 'submitted' | 'approved'
  const [procurementEmail, setProcurementEmail] = useState('');
  const [portalUrl, setPortalUrl] = useState('');
  const [nextTenderDate, setNextTenderDate] = useState('');
  const [projectName, setProjectName] = useState('');
  const [bidDueDate, setBidDueDate] = useState('');
  const [quotedPrice, setQuotedPrice] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (contact && isOpen) {
      setProcurementEmail(contact.email || '');
      setPortalUrl('');
      setNotes('');
      setProjectName('');
      setBidDueDate('');
      setQuotedPrice('');
      setNextTenderDate('');
      setApprovalStatus('pending_submission');
      setProcurementMode('vendor_list');
      setRequiredItems(['coi', 'wsib', 'profile']);
      setCompletedItems([]);
    }
  }, [contact, isOpen]);

  const companyColleagues = useMemo(() => {
    if (!contact?.company) return [];
    const targetKey = normalizeCompanyKey(contact.company);
    if (!targetKey || targetKey === 'commercialprospect') return [];
    return (allContacts || []).filter(
      (c) => String(c.id) !== String(contact.id) && normalizeCompanyKey(c.company) === targetKey
    );
  }, [contact, allContacts]);

  if (!isOpen || !contact) return null;

  const toggleRequiredItem = (id) => {
    setRequiredItems((prev) => {
      if (prev.includes(id)) {
        setCompletedItems((comp) => comp.filter((item) => item !== id));
        return prev.filter((item) => item !== id);
      }
      return [...prev, id];
    });
  };

  const toggleCompletedItem = (id, e) => {
    e.stopPropagation();
    if (!requiredItems.includes(id)) {
      setRequiredItems((prev) => [...prev, id]);
    }
    setCompletedItems((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      await onSubmit({
        lead_id: contact.id,
        company_name: contact.company,
        procurement_mode: procurementMode,
        checklist: requiredItems,
        completed_items: completedItems,
        portal_url: portalUrl.trim(),
        procurement_email: procurementEmail.trim(),
        approval_status: approvalStatus,
        next_tender_date: nextTenderDate || bidDueDate || null,
        notes: notes.trim(),
        create_initial_tender: procurementMode === 'bid_tender' || procurementMode === 'both',
        project_name: projectName.trim(),
        bid_due_date: bidDueDate || null,
        quoted_price: quotedPrice || null,
      });
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const totalCompanyContacts = companyColleagues.length + 1;

  return (
    <div
      className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4 z-[100] animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-indigo-500/40 rounded-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto shadow-2xl p-6 space-y-5 text-white"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-800 pb-3.5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-300 shrink-0">
              <ClipboardCheck size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-extrabold text-white tracking-tight">
                  Vendor List / Bids & Tenders
                </h2>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  Inbound CRM Roll-Up
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {contact.name} • <span className="text-slate-200 font-semibold">{contact.company}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Whole-Company Roll-Up Banner */}
        <div className="rounded-xl bg-indigo-950/50 border border-indigo-500/30 p-3.5 text-xs text-indigo-200 flex items-start gap-3">
          <Users size={16} className="text-indigo-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-bold text-white">
              Whole-Company Roll-Up ({totalCompanyContacts}{' '}
              {totalCompanyContacts === 1 ? 'contact' : 'contacts'} at {contact.company})
            </div>
            <p className="text-[11px] text-indigo-200/90 leading-relaxed">
              Logging this outcome moves <strong className="text-white">{contact.company}</strong>{' '}
              {companyColleagues.length > 0
                ? `(including ${companyColleagues.length} other colleague${companyColleagues.length === 1 ? '' : 's'} at this company) `
                : ''}
              out of the Outbound cold-call board into{' '}
              <strong className="text-indigo-300">Inbound CRM → Vendor Lists & Tenders</strong> and
              automatically stops any cold no-answer email drips across the company.
            </p>
          </div>
        </div>

        <form onSubmit={handleFormSubmit} className="space-y-4 text-xs">
          {/* Procurement Mode */}
          <div>
            <label className="block font-bold text-slate-200 uppercase tracking-wider text-[11px] mb-2">
              1. What did they say on the call?
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {[
                {
                  key: 'vendor_list',
                  title: 'Vendor List / Pre-Qual',
                  desc: 'Submit COI, WSIB, or portal form to join sub list',
                  icon: ShieldCheck,
                },
                {
                  key: 'bid_tender',
                  title: 'Active Bid / Tender',
                  desc: 'Invited to bid on an upcoming or live project',
                  icon: FileSpreadsheet,
                },
                {
                  key: 'both',
                  title: 'Both (Pre-Qual + Bid)',
                  desc: 'Register on vendor list & price an active tender',
                  icon: Building2,
                },
              ].map((opt) => {
                const Icon = opt.icon;
                const active = procurementMode === opt.key;
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setProcurementMode(opt.key)}
                    className={`p-3 rounded-xl border text-left transition flex flex-col justify-between gap-1.5 ${
                      active
                        ? 'bg-indigo-600/20 border-indigo-500 text-white shadow-sm'
                        : 'bg-slate-950/70 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <Icon size={15} className={active ? 'text-indigo-400' : 'text-slate-400'} />
                      {active && (
                        <span className="w-4 h-4 rounded-full bg-indigo-500 text-white flex items-center justify-center">
                          <Check size={10} />
                        </span>
                      )}
                    </div>
                    <div>
                      <div className="font-bold text-xs text-white">{opt.title}</div>
                      <div className="text-[10px] text-slate-400 leading-snug mt-0.5">{opt.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Pre-Qual Requirements Checklist */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="font-bold text-slate-200 uppercase tracking-wider text-[11px]">
                2. Vendor Pre-Qual Checklist (Required vs. Already Sent)
              </label>
              <span className="text-[10px] text-slate-400">
                Click item to require • Click &quot;Mark Sent&quot; if already submitted
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {CHECKLIST_ITEMS.map((item) => {
                const isReq = requiredItems.includes(item.id);
                const isDone = completedItems.includes(item.id);
                return (
                  <div
                    key={item.id}
                    onClick={() => toggleRequiredItem(item.id)}
                    className={`px-3 py-2.5 rounded-xl border cursor-pointer transition flex items-center justify-between gap-2 ${
                      isReq
                        ? 'bg-slate-950 border-indigo-500/50 text-white'
                        : 'bg-slate-950/40 border-slate-800/80 text-slate-500 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <input
                        type="checkbox"
                        checked={isReq}
                        onChange={() => {}}
                        className="rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-0"
                      />
                      <span className="truncate font-medium text-xs">{item.label}</span>
                    </div>
                    {isReq && (
                      <button
                        type="button"
                        onClick={(e) => toggleCompletedItem(item.id, e)}
                        className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 transition ${
                          isDone
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                            : 'bg-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        {isDone ? '✓ Sent' : 'Mark Sent'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Submission Email, Portal URL & Approval Status */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-slate-300 mb-1 flex items-center gap-1">
                <Mail size={12} className="text-indigo-400" />
                Estimating / Vendor Email
              </label>
              <input
                type="email"
                value={procurementEmail}
                onChange={(e) => setProcurementEmail(e.target.value)}
                placeholder="estimating@company.com"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1 flex items-center gap-1">
                <Globe size={12} className="text-indigo-400" />
                Portal / Bid Platform
              </label>
              <input
                type="text"
                value={portalUrl}
                onChange={(e) => setPortalUrl(e.target.value)}
                placeholder="BuildingConnected / Procore / URL"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1">
                Vendor List Status
              </label>
              <select
                value={approvalStatus}
                onChange={(e) => setApprovalStatus(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="pending_submission">Pre-Qual Pending (To Send)</option>
                <option value="submitted">Package Sent / Under Review</option>
                <option value="approved">Approved on Vendor List</option>
              </select>
            </div>
          </div>

          {/* Active Bid / Tender Fields (Shown when bid_tender or both is selected) */}
          {(procurementMode === 'bid_tender' || procurementMode === 'both') && (
            <div className="p-3.5 rounded-xl bg-indigo-950/30 border border-indigo-500/30 space-y-3">
              <div className="font-bold text-indigo-300 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <FileSpreadsheet size={13} />
                Initial Project Tender Details (Creates Active Bid in Inbound CRM)
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">
                    Project / Tender Name
                  </label>
                  <input
                    type="text"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    placeholder="e.g. Square One Fit-Out"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 mb-1 flex items-center gap-1">
                    <Calendar size={12} className="text-indigo-400" />
                    Bid Closing / Due Date
                  </label>
                  <input
                    type="date"
                    value={bidDueDate}
                    onChange={(e) => setBidDueDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">
                    Est. Bid Value ($ optional)
                  </label>
                  <input
                    type="number"
                    value={quotedPrice}
                    onChange={(e) => setQuotedPrice(e.target.value)}
                    placeholder="e.g. 4500"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block font-semibold text-slate-300 mb-1">
              Procurement Notes / Next Tender Window
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Spoke with Senior Estimator — send COI + WSIB + One-Pager to estimating@company.com to be added to their BuildingConnected sub list."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between border-t border-slate-800 pt-4">
            <span className="text-[11px] text-slate-400">
              Logs +1 Dial &amp; +1 Connected • Bundles {totalCompanyContacts}{' '}
              {totalCompanyContacts === 1 ? 'contact' : 'contacts'}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 rounded-xl text-slate-400 hover:text-white text-xs font-semibold transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-indigo-950/50 transition disabled:opacity-50"
              >
                <span>
                  {submitting
                    ? 'Moving Company...'
                    : `Move ${contact.company} to Vendor & Tenders`}
                </span>
                <ArrowRight size={13} />
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
