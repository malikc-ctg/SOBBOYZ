import React, { useState } from 'react';
import {
  X,
  Phone,
  PhoneCall,
  Building2,
  Mail,
  User,
  Users,
  Briefcase,
  ExternalLink,
  MapPin,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  Edit3,
  Save,
  Check,
  ArrowUpRight,
  TrendingUp,
  DollarSign,
  Shield,
  Layers,
  FileText,
  Copy
} from 'lucide-react';
import { CALL_OUTCOMES } from '@/lib/sales/phoneService';

function normalizeCompanyName(name) {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/\b(inc|incorporated|ltd|limited|corp|corporation|group|llc|gsc|co)\b/gi, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

function getSeniorityRank(seniority = '', title = '') {
  const s = (seniority || '').toLowerCase();
  const t = (title || '').toLowerCase();
  if (s === 'owner' || s === 'c_suite' || s === 'partner' || t.includes('owner') || t.includes('president') || t.includes('ceo') || t.includes('principal') || t.includes('vp')) return 4;
  if (s === 'director' || s === 'vp' || s === 'head' || t.includes('director') || t.includes('general manager') || t.includes('senior project manager') || t.includes('senior pm')) return 3.5;
  if (s === 'manager' || t.includes('project manager') || t.includes('superintendent') || t.includes('site super') || t.includes('estimator') || t.includes('pm')) return 3;
  if (s === 'entry' || s === 'intern' || t.includes('coordinator') || t.includes('assistant') || t.includes('admin')) return 2;
  return 2.5;
}

function getSeniorityLabel(rank, title = '') {
  if (title && (title.toLowerCase().includes('senior') || title.toLowerCase().includes('director'))) return 'Senior Leadership';
  if (rank >= 4) return 'Executive / Owner';
  if (rank >= 3.5) return 'Director / Senior PM';
  if (rank >= 3) return 'Project Manager / Super';
  if (rank <= 2) return 'Project Coordinator';
  return 'Operations Lead';
}

function formatDateRelative(dateStr) {
  if (!dateStr) return 'Never';
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now - d;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 2) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  } catch {
    return 'Recently';
  }
}

export default function LeadDossierModal({
  contact,
  allContacts = [],
  isOpen,
  onClose,
  onSelectContact,
  onStartCall,
  onSaveContact
}) {
  if (!isOpen || !contact) return null;

  const [isEditing, setIsEditing] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [copiedKey, setCopiedKey] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  function handleCopyNumber(num, key) {
    if (!num) return;
    try {
      if (navigator?.clipboard?.writeText) {
        navigator.clipboard.writeText(num).catch(() => fallbackCopy(num));
      } else {
        fallbackCopy(num);
      }
    } catch {
      fallbackCopy(num);
    }
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  }

  function fallbackCopy(text) {
    try {
      const el = document.createElement('textarea');
      el.value = text;
      el.setAttribute('readonly', '');
      el.style.position = 'absolute';
      el.style.left = '-9999px';
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    } catch {}
  }

  // Form state for editing
  const [editName, setEditName] = useState(contact.name || '');
  const [editTitle, setEditTitle] = useState(contact.position || '');
  const [editCompany, setEditCompany] = useState(contact.company || '');
  const [editPhone, setEditPhone] = useState(contact.phone || '');
  const [editDirect, setEditDirect] = useState(contact.work_direct_phone || '');
  const [editMobile, setEditMobile] = useState(contact.mobile_phone || '');
  const [editEmail, setEditEmail] = useState(contact.email || '');
  const [editCity, setEditCity] = useState(contact.city || '');
  const [editValue, setEditValue] = useState(contact.estimated_value || '2500');
  const [editNotes, setEditNotes] = useState(contact.notes || '');

  // Calculate Company Colleagues & Hierarchy
  const normComp = normalizeCompanyName(contact.company);
  const colleagues = allContacts.filter(c => c.id !== contact.id && normalizeCompanyName(c.company) === normComp);
  
  const currentRank = getSeniorityRank(contact.seniority, contact.position);
  const superiors = colleagues.filter(c => getSeniorityRank(c.seniority, c.position) > currentRank);
  const peers = colleagues.filter(c => getSeniorityRank(c.seniority, c.position) === currentRank);
  const subordinates = colleagues.filter(c => getSeniorityRank(c.seniority, c.position) < currentRank);

  // Company-wide call history aggregation
  const companyCallLogs = colleagues.flatMap(c => (c.call_logs || []).map(l => ({ ...l, colleagueName: c.name, colleaguePosition: c.position })));
  const directCallLogs = contact.call_logs || [];
  const allRelatedLogs = [...directCallLogs, ...companyCallLogs].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  async function handleSave() {
    if (onSaveContact) {
      await onSaveContact(contact.id, {
        name: editName,
        position: editTitle,
        company: editCompany,
        phone: editPhone,
        work_direct_phone: editDirect,
        mobile_phone: editMobile,
        email: editEmail,
        city: editCity,
        estimated_value: editValue,
        notes: editNotes,
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
      setIsEditing(false);
    }
  }

  function handleCopyEmail(email) {
    if (!email) return;
    navigator.clipboard.writeText(email);
    setCopiedEmail(true);
    setTimeout(() => setCopiedEmail(false), 2000);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div 
        className="w-full max-w-4xl max-h-[92vh] flex flex-col rounded-2xl border border-blue-900/40 bg-[#001326] shadow-2xl overflow-hidden text-slate-100"
        onClick={e => e.stopPropagation()}
      >
        {/* Top Header Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-blue-900/30 bg-[#001733]/90">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400 shrink-0 font-bold">
              <User size={20} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight truncate">
                  {contact.name || 'Decision Maker'}
                </h2>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-950 border border-blue-800 text-blue-300">
                  {getSeniorityLabel(currentRank, contact.position)}
                </span>
                <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-800/60">
                  ${contact.estimated_value || '2,500'} Target
                </span>
                {saveSuccess && (
                  <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                    <Check size={13} /> Updated
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs sm:text-sm text-blue-400 font-semibold mt-0.5 truncate">
                <span>{contact.position || 'Project Lead'}</span>
                <span className="text-slate-400 font-normal">•</span>
                <span className="text-slate-300 flex items-center gap-1 font-medium">
                  <Building2 size={13} className="text-slate-400" />
                  {contact.company}
                </span>
                {contact.city && (
                  <>
                    <span className="text-slate-400 font-normal">•</span>
                    <span className="text-slate-400">{contact.city}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsEditing(!isEditing)}
              className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 transition"
              title="Edit Lead Information"
            >
              <Edit3 size={13} />
              <span className="hidden sm:inline">{isEditing ? 'Cancel Edit' : 'Edit Details'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              title="Close Modal"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content Body: Scrollable */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* EDIT FORM (If in edit mode) */}
          {isEditing && (
            <div className="p-4 rounded-xl bg-slate-900/90 border border-blue-800/50 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="text-xs font-bold uppercase tracking-wider text-blue-400">
                  Update Lead Profile
                </span>
                <button
                  type="button"
                  onClick={handleSave}
                  className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-bold flex items-center gap-1.5 transition"
                >
                  <Save size={13} /> Save Changes
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="text-slate-400 block mb-1 font-semibold">Contact Full Name</label>
                  <input
                    type="text"
                    className="phone-search-input"
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1 font-semibold">Job Title / Position</label>
                  <input
                    type="text"
                    className="phone-search-input"
                    value={editTitle}
                    onChange={e => setEditTitle(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1 font-semibold">Company Name</label>
                  <input
                    type="text"
                    className="phone-search-input"
                    value={editCompany}
                    onChange={e => setEditCompany(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1 font-semibold">Primary Phone Line</label>
                  <input
                    type="tel"
                    className="phone-search-input"
                    value={editPhone}
                    onChange={e => setEditPhone(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1 font-semibold">Direct Desk Ext / Line</label>
                  <input
                    type="tel"
                    className="phone-search-input"
                    value={editDirect}
                    onChange={e => setEditDirect(e.target.value)}
                    placeholder="e.g. +1 416-213-7165 ext 113"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1 font-semibold">Mobile Cell</label>
                  <input
                    type="tel"
                    className="phone-search-input"
                    value={editMobile}
                    onChange={e => setEditMobile(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1 font-semibold">Direct Email</label>
                  <input
                    type="email"
                    className="phone-search-input"
                    value={editEmail}
                    onChange={e => setEditEmail(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1 font-semibold">City / Territory</label>
                  <input
                    type="text"
                    className="phone-search-input"
                    value={editCity}
                    onChange={e => setEditCity(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-400 block mb-1 font-semibold text-xs">Rep Notes & Intel</label>
                <textarea
                  rows={2}
                  className="phone-search-input w-full"
                  value={editNotes}
                  onChange={e => setEditNotes(e.target.value)}
                  placeholder="Notes on project, active sites, gatekeeper instructions..."
                />
              </div>
            </div>
          )}

          {/* SECTION 1: Outreach & Contact History Metrics ("How many times contacted? When were they contacted?") */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Clock size={14} className="text-blue-400" />
                Contact History & Outreach Intelligence
              </span>
              <span className="text-xs text-slate-400">
                {directCallLogs.length > 0 ? `${directCallLogs.length} interactions logged` : 'No direct dials logged yet'}
              </span>
            </div>

            {/* 4 Metric Counter Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800/80">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Times Contacted</div>
                <div className="text-xl sm:text-2xl font-black text-white mt-1">
                  {contact.times_contacted || directCallLogs.length || 0}
                  <span className="text-xs font-normal text-slate-400 ml-1.5">dials</span>
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  {contact.times_contacted ? 'Direct outreach logged' : 'Ready for initial cold call'}
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800/80">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Last Contacted</div>
                <div className="text-base sm:text-lg font-bold text-blue-300 mt-1 truncate">
                  {formatDateRelative(contact.last_contacted_at)}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5 truncate">
                  {contact.last_contacted_at ? new Date(contact.last_contacted_at).toLocaleDateString() : 'Never contacted'}
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800/80">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Last Outcome</div>
                <div className="text-sm sm:text-base font-bold text-emerald-400 mt-1 truncate">
                  {contact.last_outcome || (contact.status === 'walkthrough_booked' ? 'Walkthrough' : contact.status || 'New Lead')}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5 truncate">
                  {contact.last_notes || 'Pending first connection'}
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800/80">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Company Outreach</div>
                <div className="text-xl sm:text-2xl font-black text-amber-300 mt-1">
                  {(contact.company_times_contacted || allRelatedLogs.length) || 0}
                  <span className="text-xs font-normal text-slate-400 ml-1.5">at firm</span>
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5 truncate">
                  {colleagues.length > 0 ? `${colleagues.length + 1} contacts on file` : 'Sole contact on file'}
                </div>
              </div>
            </div>

            {/* Detailed Interaction Log Timeline */}
            {allRelatedLogs.length > 0 ? (
              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                <div className="text-xs font-bold text-slate-300 flex items-center justify-between pb-1 border-b border-slate-800/80">
                  <span>Outreach Timeline (This Contact & Colleagues)</span>
                  <span className="text-[11px] text-slate-400 font-normal">Most recent first</span>
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {allRelatedLogs.map((log, idx) => {
                    const isColleague = log.colleagueName && log.colleagueName !== contact.name;
                    return (
                      <div key={log.event_id || idx} className="p-2.5 rounded-lg bg-slate-900/70 border border-slate-800/60 flex items-start justify-between gap-3 text-xs">
                        <div className="space-y-0.5 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-white">
                              {isColleague ? `Colleague: ${log.colleagueName} (${log.colleaguePosition || 'Team'})` : contact.name}
                            </span>
                            <span className="px-2 py-0.5 rounded bg-blue-900/40 text-blue-300 font-mono text-[10px] border border-blue-800/40">
                              {log.outcome_type || 'PHONE_CALL'}
                            </span>
                            {log.duration_seconds > 0 && (
                              <span className="text-slate-400 text-[11px]">
                                {log.duration_seconds}s
                              </span>
                            )}
                            {log.source === 'quo_webhook' && (
                              <span className="px-1.5 py-0.5 rounded bg-emerald-950/60 text-emerald-400 font-mono text-[9px] border border-emerald-800/40">
                                Quo VoIP
                              </span>
                            )}
                          </div>
                          {log.notes && (
                            <p className="text-slate-300 text-[11px] italic">
                              "{log.notes}"
                            </p>
                          )}
                          {log.ai_summary && (
                            <div className="mt-1 p-2 rounded bg-slate-950/70 border border-blue-900/30 text-[11px] text-blue-200 space-y-1">
                              <span className="font-semibold text-blue-400 block text-[10px] uppercase tracking-wider">Quo Sona AI Summary</span>
                              {Array.isArray(log.ai_summary) ? (
                                <ul className="list-disc pl-3.5 space-y-0.5">
                                  {log.ai_summary.map((b, i) => (
                                    <li key={i}>{b}</li>
                                  ))}
                                </ul>
                              ) : (
                                <div>{log.ai_summary}</div>
                              )}
                            </div>
                          )}
                          {log.transcript && (
                            <details className="mt-1 p-2 rounded bg-slate-950/90 border border-slate-800 text-[11px] text-slate-300">
                              <summary className="cursor-pointer font-bold text-slate-400 hover:text-slate-200">
                                View Full Call Transcript
                              </summary>
                              <div className="mt-1.5 p-2 max-h-48 overflow-y-auto font-mono text-[10px] whitespace-pre-wrap text-slate-200 bg-slate-900/90 rounded border border-slate-800/80">
                                {log.transcript}
                              </div>
                            </details>
                          )}
                          {log.recording_url && (
                            <div className="mt-1">
                              <a
                                href={log.recording_url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[11px] text-blue-400 hover:text-blue-300 underline font-mono flex items-center gap-1"
                              >
                                Listen to Call Recording
                              </a>
                            </div>
                          )}
                          <div className="text-[10px] text-slate-400 flex items-center gap-2">
                            <span>Rep: {log.rep_name || 'Malik'}</span>
                            {log.phone_number && <span>• Dialed: {log.phone_number}</span>}
                          </div>
                        </div>
                        <span className="text-[11px] text-slate-400 font-mono shrink-0">
                          {formatDateRelative(log.created_at)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-slate-950/40 border border-dashed border-slate-800 text-center text-xs text-slate-400">
                No past calls logged yet for this contact. Use the direct dial buttons below to log the first outreach.
              </div>
            )}
          </div>

          {/* SECTION 2: Direct Contact Channels & Routing */}
          <div className="space-y-2.5">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Phone size={14} className="text-blue-400" />
              Verified Communication Lines
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {/* Direct Desk Line */}
              <div
                onClick={() => handleCopyNumber(contact.work_direct_phone || contact.phone, 'desk')}
                className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-blue-500/50 flex items-center justify-between gap-2 cursor-pointer transition group"
                title="Click to copy direct desk phone"
              >
                <div className="min-w-0">
                  <div className="text-[10px] uppercase font-bold text-slate-400">Direct Desk / Extension</div>
                  <div className="font-mono text-sm font-bold text-blue-300 truncate mt-0.5 group-hover:text-blue-200">
                    {contact.work_direct_phone || contact.phone || 'No direct line'}
                  </div>
                </div>
                {(contact.work_direct_phone || contact.phone) && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCopyNumber(contact.work_direct_phone || contact.phone, 'desk');
                    }}
                    className="px-2.5 py-1.5 bg-blue-950 hover:bg-blue-900/60 border border-blue-800/80 text-blue-300 rounded-lg text-xs font-bold flex items-center gap-1.5 transition shrink-0"
                  >
                    {copiedKey === 'desk' ? (
                      <>
                        <Check size={12} className="text-emerald-400" />
                        <span className="text-emerald-400">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy size={12} />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              {/* Mobile Cell */}
              <div
                onClick={() => handleCopyNumber(contact.mobile_phone, 'mobile')}
                className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-emerald-500/50 flex items-center justify-between gap-2 cursor-pointer transition group"
                title="Click to copy mobile cell phone"
              >
                <div className="min-w-0">
                  <div className="text-[10px] uppercase font-bold text-slate-400">Mobile Cell</div>
                  <div className="font-mono text-sm font-bold text-emerald-300 truncate mt-0.5 group-hover:text-emerald-200">
                    {contact.mobile_phone || 'No cell on file'}
                  </div>
                </div>
                {contact.mobile_phone && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCopyNumber(contact.mobile_phone, 'mobile');
                    }}
                    className="px-2.5 py-1.5 bg-emerald-950 hover:bg-emerald-900/60 border border-emerald-800/80 text-emerald-300 rounded-lg text-xs font-bold flex items-center gap-1.5 transition shrink-0"
                  >
                    {copiedKey === 'mobile' ? (
                      <>
                        <Check size={12} className="text-emerald-400" />
                        <span className="text-emerald-400">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy size={12} />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              {/* HQ Switchboard */}
              <div
                onClick={() => handleCopyNumber(contact.corporate_phone || contact.phone, 'hq')}
                className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-slate-600 flex items-center justify-between gap-2 cursor-pointer transition group"
                title="Click to copy HQ corporate switchboard"
              >
                <div className="min-w-0">
                  <div className="text-[10px] uppercase font-bold text-slate-400">HQ Corporate Switchboard</div>
                  <div className="font-mono text-sm font-bold text-slate-300 truncate mt-0.5 group-hover:text-white">
                    {contact.corporate_phone || contact.phone || 'No HQ line'}
                  </div>
                </div>
                {(contact.corporate_phone || contact.phone) && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCopyNumber(contact.corporate_phone || contact.phone, 'hq');
                    }}
                    className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-bold flex items-center gap-1.5 transition shrink-0"
                  >
                    {copiedKey === 'hq' ? (
                      <>
                        <Check size={12} className="text-emerald-400" />
                        <span className="text-emerald-400">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy size={12} />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* Email & Digital Profile Bar */}
            <div className="flex items-center gap-2 flex-wrap pt-1 text-xs">
              {contact.email && (
                <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg">
                  <Mail size={13} className="text-indigo-400 shrink-0" />
                  <a href={`mailto:${contact.email}`} className="text-slate-200 hover:text-white font-mono">
                    {contact.email}
                  </a>
                  <button
                    type="button"
                    onClick={() => handleCopyEmail(contact.email)}
                    className="text-slate-400 hover:text-white text-[11px] ml-1 px-1.5 py-0.5 bg-slate-800 rounded"
                    title="Copy Email Address"
                  >
                    {copiedEmail ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              )}

              {contact.linkedin && (
                <a
                  href={contact.linkedin}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 hover:border-blue-600 px-3 py-1.5 rounded-lg text-blue-400 hover:text-blue-300 font-semibold transition"
                >
                  <ExternalLink size={12} />
                  <span>LinkedIn Profile</span>
                </a>
              )}

              {contact.website && (
                <a
                  href={contact.website}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 hover:border-slate-700 px-3 py-1.5 rounded-lg text-slate-300 hover:text-white transition"
                >
                  <ExternalLink size={12} />
                  <span>Company Website</span>
                </a>
              )}
            </div>
          </div>

          {/* SECTION 3: Colleagues at this Company ("Who are they?") */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Users size={14} className="text-blue-400" />
                Colleagues at {contact.company} ({colleagues.length} other decision makers)
              </span>
              <span className="text-[11px] text-slate-400">
                Click any colleague to switch active dossier
              </span>
            </div>

            {colleagues.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {colleagues.map(col => {
                  const rank = getSeniorityRank(col.seniority, col.position);
                  const isSuperior = rank > currentRank;
                  const isSubordinate = rank < currentRank;
                  const colCalls = col.times_contacted || (col.call_logs || []).length || 0;

                  return (
                    <div
                      key={col.id}
                      className={`p-3.5 rounded-xl border transition flex flex-col justify-between gap-2.5 ${
                        isSuperior
                          ? 'bg-amber-950/20 border-amber-600/30 hover:border-amber-500/60'
                          : 'bg-slate-900/70 border-slate-800/80 hover:border-blue-600/50'
                      }`}
                    >
                      <div>
                        {/* Colleague Header */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="font-bold text-white text-sm truncate flex items-center gap-1.5">
                              {col.name || 'Decision Maker'}
                              {isSuperior && (
                                <span className="text-[9px] font-bold uppercase px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                  Superior
                                </span>
                              )}
                              {isSubordinate && (
                                <span className="text-[9px] font-bold uppercase px-1.5 py-0.2 rounded bg-blue-900/30 text-blue-300 border border-blue-800/30">
                                  Team
                                </span>
                              )}
                            </div>
                            <div className="text-xs font-semibold text-blue-400 truncate mt-0.5">
                              {col.position || 'Project Lead'}
                            </div>
                          </div>

                          <span className="text-[10px] text-slate-400 shrink-0 font-medium">
                            {getSeniorityLabel(rank, col.position)}
                          </span>
                        </div>

                        {/* Phone & Email Strip */}
                        <div className="mt-2 space-y-1 text-xs font-mono text-slate-300">
                          {col.work_direct_phone ? (
                            <div className="flex items-center gap-1.5 text-blue-300">
                              <Phone size={11} className="text-blue-400 shrink-0" />
                              <span className="truncate">Direct: {col.work_direct_phone}</span>
                            </div>
                          ) : col.phone ? (
                            <div className="flex items-center gap-1.5 text-slate-300">
                              <Phone size={11} className="text-slate-400 shrink-0" />
                              <span className="truncate">Line: {col.phone}</span>
                            </div>
                          ) : null}

                          {col.mobile_phone && (
                            <div className="flex items-center gap-1.5 text-emerald-300">
                              <PhoneCall size={11} className="text-emerald-400 shrink-0" />
                              <span className="truncate">Cell: {col.mobile_phone}</span>
                            </div>
                          )}

                          {col.email && (
                            <div className="flex items-center gap-1.5 text-slate-400 font-sans text-[11px] truncate">
                              <Mail size={11} className="shrink-0" />
                              <span className="truncate">{col.email}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Colleague Action Strip */}
                      <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2">
                        <span className="text-[10px] text-slate-400">
                          {colCalls > 0 ? `Contacted ${colCalls}x` : 'Never contacted'}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              if (onSelectContact) onSelectContact(col);
                            }}
                            className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition flex items-center gap-1"
                          >
                            <ArrowUpRight size={11} /> Switch
                          </button>
                          {(col.work_direct_phone || col.phone || col.mobile_phone) && (
                            <button
                              type="button"
                              onClick={() => {
                                handleCopyNumber(col.work_direct_phone || col.phone || col.mobile_phone, `col-${col.id}`);
                              }}
                              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold transition flex items-center gap-1 border border-slate-750"
                              title="Copy colleague phone number"
                            >
                              {copiedKey === `col-${col.id}` ? (
                                <>
                                  <Check size={11} className="text-emerald-400" />
                                  <span className="text-emerald-400">Copied!</span>
                                </>
                              ) : (
                                <>
                                  <Copy size={11} />
                                  <span>Copy</span>
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800 text-center text-xs text-slate-400">
                No other colleagues detected at {contact.company} in this import batch.
              </div>
            )}
          </div>

          {/* SECTION 4: Company & Jobsite Profile Intelligence */}
          <div className="space-y-2.5">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Building2 size={14} className="text-blue-400" />
              Company & Jobsite Profile
            </span>

            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3 text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Employees</span>
                  <span className="text-sm font-bold text-white mt-0.5 block">
                    {contact.employees ? `${contact.employees} team members` : 'Mid-size firm'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Est. Annual Revenue</span>
                  <span className="text-sm font-bold text-emerald-400 mt-0.5 block">
                    {contact.annual_revenue ? `$${Number(contact.annual_revenue).toLocaleString()}` : '$5M - $25M'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Industry Sector</span>
                  <span className="text-sm font-bold text-slate-200 mt-0.5 block capitalize">
                    {contact.industry || 'Construction & General Contracting'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Department</span>
                  <span className="text-sm font-bold text-slate-200 mt-0.5 block">
                    {contact.departments || contact.service_type || 'Operations'}
                  </span>
                </div>
              </div>

              {contact.address && (
                <div className="pt-2 border-t border-slate-800/80 flex items-start gap-2">
                  <MapPin size={14} className="text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-slate-400 block text-[11px] font-semibold">HQ / Jobsite Address</span>
                    <a
                      href={`https://maps.google.com/?q=${encodeURIComponent(contact.address)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-slate-200 hover:text-blue-400 transition"
                    >
                      {contact.address}
                    </a>
                  </div>
                </div>
              )}

              {contact.technologies && (
                <div className="pt-2 border-t border-slate-800/80">
                  <span className="text-slate-400 block text-[11px] font-semibold mb-1">
                    Tech Stack & Construction Software Detected
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {contact.technologies.split(',').slice(0, 10).map((tech, i) => (
                      <span key={i} className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                        {tech.trim()}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Footer Actions Bar */}
        <div className="px-6 py-3.5 border-t border-blue-900/30 bg-[#001733]/90 flex items-center justify-between gap-3">
          <div className="text-xs text-slate-400 font-mono">
            Lead ID: <span className="text-slate-300">#{contact.id}</span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
            >
              Close
            </button>
            {(contact.work_direct_phone || contact.phone || contact.mobile_phone) && (
              <button
                type="button"
                onClick={() => {
                  const targetPhone = contact.work_direct_phone || contact.phone || contact.mobile_phone;
                  handleCopyNumber(targetPhone, 'footer');
                }}
                className={`px-5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg transition ${
                  copiedKey === 'footer'
                    ? 'bg-emerald-600 text-white shadow-emerald-950/40'
                    : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-950/40'
                }`}
                title="Copy phone number"
              >
                {copiedKey === 'footer' ? (
                  <>
                    <Check size={13} className="text-emerald-200" />
                    <span>Copied {contact.work_direct_phone || contact.phone || contact.mobile_phone}!</span>
                  </>
                ) : (
                  <>
                    <Copy size={13} />
                    <span>Copy {contact.work_direct_phone || contact.phone || contact.mobile_phone}</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
