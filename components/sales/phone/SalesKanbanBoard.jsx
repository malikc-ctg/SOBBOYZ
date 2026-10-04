import React, { useState, useMemo } from 'react';
import {
  Layers,
  Building2,
  Search,
  PhoneOff,
  Voicemail,
  PhoneIncoming,
  Calendar,
  FileText,
  CheckCircle2,
  XCircle,
  Clock,
  MoreHorizontal,
  ChevronDown,
  User,
  Copy,
  Check,
  Briefcase,
  AlertTriangle,
  Trash2,
  Plus,
  Upload
} from 'lucide-react';

export const SECTORS = [
  { key: 'post_construction', label: 'Post-Construction', shortLabel: 'Construction', color: 'blue', description: 'General Contractors, Builders, Developers, Site Supers' },
  { key: 'commercial_office', label: 'Commercial Offices', shortLabel: 'Corporate', color: 'indigo', description: 'Corporate HQ, Business Centers, Office Parks' },
  { key: 'property_management', label: 'Property Management', shortLabel: 'Property Mgmt', color: 'amber', description: 'Multi-Family, Condos, HOA, Commercial Landlords' },
  { key: 'industrial_warehouse', label: 'Industrial & Warehouses', shortLabel: 'Industrial', color: 'emerald', description: 'Manufacturing, Warehouses, Logistics Hubs' },
  { key: 'medical_healthcare', label: 'Medical & Healthcare', shortLabel: 'Healthcare', color: 'cyan', description: 'Medical Clinics, Dental Offices, Surgical Centers' },
  { key: 'retail_hospitality', label: 'Retail & Hospitality', shortLabel: 'Retail / Dining', color: 'purple', description: 'Showrooms, Fitness Clubs, Retail Storefronts' },
];

export const STAGES = [
  { key: 'new', label: 'New Leads', color: '#64748b', bg: 'bg-slate-900/60', border: 'border-slate-800' },
  { key: 'contacted', label: 'Contacted / In Progress', color: '#3b82f6', bg: 'bg-blue-950/20', border: 'border-blue-900/40' },
  { key: 'walkthrough_booked', label: 'Walkthrough Booked', color: '#8b5cf6', bg: 'bg-purple-950/20', border: 'border-purple-900/40' },
  { key: 'quoted', label: 'Quote Sent', color: '#06b6d4', bg: 'bg-cyan-950/20', border: 'border-cyan-900/40' },
  { key: 'won', label: 'Contract Won', color: '#10b981', bg: 'bg-emerald-950/20', border: 'border-emerald-900/40' },
  { key: 'lost', label: 'Lost / Follow Up', color: '#ef4444', bg: 'bg-rose-950/20', border: 'border-rose-950/40' }
];

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
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return 'Recently';
  }
}

export default function SalesKanbanBoard({
  contacts = [],
  onUpdateStatus,
  onUpdateSector,
  onOneClickOutcome,
  onOpenDossier,
  onOpenWalkthrough,
  onDeleteLead,
  onOpenImporter,
  user
}) {
  const [groupBy, setGroupBy] = useState('stage'); // 'stage' | 'sector'
  const [activeSectorFilter, setActiveSectorFilter] = useState('all');
  const [activeStageFilter, setActiveStageFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [draggedContactId, setDraggedContactId] = useState(null);
  const [dragOverColumn, setDragOverColumn] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [openSectorMenuId, setOpenSectorMenuId] = useState(null);
  const [openMoreActionsId, setOpenMoreActionsId] = useState(null);
  const [oosConfirmContact, setOosConfirmContact] = useState(null);
  const [isDeletingLead, setIsDeletingLead] = useState(false);

  // Copy phone number helper
  const handleCopyPhone = (e, contactId, phone) => {
    e.stopPropagation();
    if (!phone) return;
    navigator.clipboard.writeText(phone);
    setCopiedId(contactId);
    setTimeout(() => setCopiedId(null), 1500);
  };

  // Filter contacts by search query and active filter tabs
  const filteredContacts = useMemo(() => {
    return contacts.filter(c => {
      // Search matching
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = (c.name || '').toLowerCase().includes(q);
        const matchesCompany = (c.company || '').toLowerCase().includes(q);
        const matchesPosition = (c.position || '').toLowerCase().includes(q);
        const matchesCity = (c.city || '').toLowerCase().includes(q);
        const matchesPhone = (c.phone || '').includes(q);
        if (!matchesName && !matchesCompany && !matchesPosition && !matchesCity && !matchesPhone) {
          return false;
        }
      }

      // If grouped by stage, filter by sector
      if (groupBy === 'stage' && activeSectorFilter !== 'all') {
        const contactSector = c.sector || 'post_construction';
        if (contactSector !== activeSectorFilter) return false;
      }

      // If grouped by sector, filter by stage
      if (groupBy === 'sector' && activeStageFilter !== 'all') {
        const contactStage = c.status || 'new';
        if (contactStage !== activeStageFilter) return false;
      }

      return true;
    });
  }, [contacts, searchQuery, groupBy, activeSectorFilter, activeStageFilter]);

  // Sector Counts
  const sectorCounts = useMemo(() => {
    const counts = { all: contacts.length };
    SECTORS.forEach(s => {
      counts[s.key] = contacts.filter(c => (c.sector || 'post_construction') === s.key).length;
    });
    return counts;
  }, [contacts]);

  // Stage Counts
  const stageCounts = useMemo(() => {
    const counts = { all: contacts.length };
    STAGES.forEach(s => {
      counts[s.key] = contacts.filter(c => (c.status || 'new') === s.key).length;
    });
    return counts;
  }, [contacts]);

  // Drag-and-drop handlers
  const handleDragStart = (e, contactId) => {
    setDraggedContactId(contactId);
    e.dataTransfer.setData('text/plain', contactId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, colKey) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverColumn !== colKey) {
      setDragOverColumn(colKey);
    }
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  const handleDrop = (e, targetColKey) => {
    e.preventDefault();
    setDragOverColumn(null);
    const contactId = e.dataTransfer.getData('text/plain') || draggedContactId;
    if (!contactId) return;

    if (groupBy === 'stage') {
      if (onUpdateStatus) {
        onUpdateStatus(contactId, targetColKey);
      }
    } else {
      if (onUpdateSector) {
        onUpdateSector(contactId, targetColKey);
      }
    }
    setDraggedContactId(null);
  };

  return (
    <div className="space-y-4">
      {/* CONTROLS HEADER */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Group By Toggle Switch */}
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 shrink-0">
            <button
              type="button"
              onClick={() => setGroupBy('stage')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                groupBy === 'stage'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Layers size={13} />
              <span>Group by Stage</span>
            </button>
            <button
              type="button"
              onClick={() => setGroupBy('sector')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                groupBy === 'sector'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Building2 size={13} />
              <span>Group by Sector</span>
            </button>
          </div>

          {/* Search bar */}
          <div className="relative flex-1 max-w-md">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 transition"
              placeholder="Search by name, company, position, phone, city..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Quick Metrics & Import Action */}
          <div className="flex items-center gap-3 text-xs text-slate-400 font-mono">
            <div>
              <span className="text-white font-bold">{filteredContacts.length}</span> leads shown
            </div>
            {onOpenImporter && (
              <button
                type="button"
                onClick={onOpenImporter}
                className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-sans text-xs font-bold transition flex items-center gap-1 shadow-sm"
              >
                <Plus size={12} />
                <span>Import Leads</span>
              </button>
            )}
          </div>
        </div>

        {/* Dynamic Filter Pills (Scrollbars hidden completely) */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar scrollbar-none">
          {groupBy === 'stage' ? (
            <>
              <button
                type="button"
                onClick={() => setActiveSectorFilter('all')}
                className={`px-3 py-1 rounded-lg font-bold shrink-0 transition ${
                  activeSectorFilter === 'all'
                    ? 'bg-blue-900/60 text-blue-200 border border-blue-700'
                    : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-white'
                }`}
              >
                All Sectors ({sectorCounts.all || 0})
              </button>
              {SECTORS.map(sec => (
                <button
                  key={sec.key}
                  type="button"
                  onClick={() => setActiveSectorFilter(sec.key)}
                  className={`px-3 py-1 rounded-lg font-bold shrink-0 transition flex items-center gap-1.5 ${
                    activeSectorFilter === sec.key
                      ? 'bg-blue-900/60 text-blue-200 border border-blue-700'
                      : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-white'
                  }`}
                >
                  <span>{sec.label}</span>
                  <span className="text-[10px] opacity-75 font-mono">({sectorCounts[sec.key] || 0})</span>
                </button>
              ))}
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setActiveStageFilter('all')}
                className={`px-3 py-1 rounded-lg font-bold shrink-0 transition ${
                  activeStageFilter === 'all'
                    ? 'bg-blue-900/60 text-blue-200 border border-blue-700'
                    : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-white'
                }`}
              >
                All Stages ({stageCounts.all || 0})
              </button>
              {STAGES.map(stg => (
                <button
                  key={stg.key}
                  type="button"
                  onClick={() => setActiveStageFilter(stg.key)}
                  className={`px-3 py-1 rounded-lg font-bold shrink-0 transition flex items-center gap-1.5 ${
                    activeStageFilter === stg.key
                      ? 'bg-blue-900/60 text-blue-200 border border-blue-700'
                      : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-white'
                  }`}
                >
                  <span>{stg.label}</span>
                  <span className="text-[10px] opacity-75 font-mono">({stageCounts[stg.key] || 0})</span>
                </button>
              ))}
            </>
          )}
        </div>
      </div>

      {/* EMPTY PIPELINE STATE (When 0 leads exist) */}
      {contacts.length === 0 && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-12 text-center flex flex-col items-center justify-center space-y-4 shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-blue-950/80 border border-blue-800/80 flex items-center justify-center text-blue-400">
            <Upload size={24} />
          </div>
          <div className="max-w-md space-y-1">
            <h3 className="text-base font-bold text-white">Lead Pipeline Ready for Upload</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              All previous leads have been cleared. Upload your fresh CSV or Excel lead list to populate your cold calling and sector pipeline.
            </p>
          </div>
          {onOpenImporter && (
            <button
              type="button"
              onClick={onOpenImporter}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-2 transition shadow-lg shadow-blue-950/40"
            >
              <Plus size={14} />
              <span>Import New Leads</span>
            </button>
          )}
        </div>
      )}

      {/* KANBAN BOARD: HORIZONTAL SCROLLABLE COLUMNS */}
      {contacts.length > 0 && (
        <div className="flex gap-4 overflow-x-auto pb-6 pt-1 items-start min-h-[550px]">
          {(groupBy === 'stage' ? STAGES : SECTORS).map(col => {
            const colKey = col.key;
            const colLeads = filteredContacts.filter(c => {
              if (groupBy === 'stage') {
                return (c.status || 'new') === colKey;
              } else {
                return (c.sector || 'post_construction') === colKey;
              }
            });

            const isDragTarget = dragOverColumn === colKey;

            return (
              <div
                key={colKey}
                onDragOver={e => handleDragOver(e, colKey)}
                onDragLeave={handleDragLeave}
                onDrop={e => handleDrop(e, colKey)}
                className={`w-[340px] shrink-0 rounded-2xl flex flex-col transition border ${
                  isDragTarget
                    ? 'border-blue-500 bg-blue-950/30 shadow-lg shadow-blue-500/10'
                    : 'border-slate-800/80 bg-slate-950/70'
                }`}
              >
                {/* Column Header (No deal values!) */}
                <div className="p-3.5 border-b border-slate-800/80 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: col.color || '#3b82f6' }}
                    />
                    <span className="text-xs font-black uppercase tracking-wider text-slate-200">
                      {col.label}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-slate-900 border border-slate-800 text-slate-300">
                      {colLeads.length}
                    </span>
                  </div>
                </div>

                {/* Column Card List */}
                <div className="p-2.5 space-y-2.5 max-h-[700px] overflow-y-auto">
                  {colLeads.length === 0 ? (
                    <div className="py-8 text-center text-xs text-slate-400 font-mono border border-dashed border-slate-850 rounded-xl">
                      {groupBy === 'stage' ? 'No leads in this stage' : 'No leads in this sector'}
                    </div>
                  ) : (
                    colLeads.map(contact => {
                      const sectorMeta = SECTORS.find(s => s.key === contact.sector) || SECTORS[0];
                      const stageMeta = STAGES.find(s => s.key === (contact.status || 'new')) || STAGES[0];
                      const hasDials = (contact.times_contacted || 0) > 0;

                      return (
                        <div
                          key={contact.id}
                          draggable
                          onDragStart={e => handleDragStart(e, contact.id)}
                          onDoubleClick={() => onOpenDossier && onOpenDossier(contact)}
                          className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 shadow-sm space-y-3 cursor-grab active:cursor-grabbing transition group select-none"
                          title="Double-click to open full lead dossier"
                        >
                          {/* Top: Name, Position, Company & City (No Deal Value Badge!) */}
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="font-bold text-sm text-white group-hover:text-blue-300 transition truncate">
                                {contact.name || 'Unnamed Contact'}
                              </div>
                              <div className="text-[11px] text-slate-400 flex items-center gap-1.5 truncate mt-0.5">
                                <span className="font-semibold text-slate-300">{contact.position || 'Project Lead'}</span>
                                <span>•</span>
                                <span className="truncate">{contact.company || 'Commercial Prospect'}</span>
                              </div>
                            </div>

                            {contact.city && (
                              <span className="text-[10px] text-slate-400 font-mono shrink-0">
                                {contact.city}
                              </span>
                            )}
                          </div>

                          {/* Middle: Phone Display + Outreach Intelligence */}
                          <div className="p-2 rounded-lg bg-slate-950/80 border border-slate-850 flex items-center justify-between text-xs">
                            <div className="flex items-center gap-1.5 font-mono text-slate-300 text-[11px]">
                              <span>{contact.phone || 'No direct phone'}</span>
                              {contact.phone && (
                                <button
                                  type="button"
                                  onClick={e => handleCopyPhone(e, contact.id, contact.phone)}
                                  className="text-slate-400 hover:text-white p-0.5 rounded"
                                  title="Copy phone number"
                                >
                                  {copiedId === contact.id ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                                </button>
                              )}
                            </div>

                            <div className="flex items-center gap-1.5 text-[10px]">
                              {hasDials ? (
                                <span className="text-blue-300 font-mono">
                                  {contact.times_contacted} dials
                                </span>
                              ) : (
                                <span className="text-slate-400 font-mono">Untouched</span>
                              )}
                              {contact.last_outcome && (
                                <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono border border-slate-700">
                                  {contact.last_outcome}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Sector Tag & Stage Badge (Allows quick sector change!) */}
                          <div className="flex items-center justify-between gap-2 pt-0.5 text-xs">
                            {/* Sector Selector Dropdown */}
                            <div className="relative">
                              <button
                                type="button"
                                onClick={e => {
                                  e.stopPropagation();
                                  setOpenSectorMenuId(openSectorMenuId === contact.id ? null : contact.id);
                                  setOpenMoreActionsId(null);
                                }}
                                className="px-2 py-0.5 rounded-md bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white text-[10px] font-bold flex items-center gap-1 transition"
                                title="Click to reassign sector"
                              >
                                <Building2 size={10} className="text-blue-400" />
                                <span>{sectorMeta.shortLabel}</span>
                                <ChevronDown size={10} className="text-slate-400" />
                              </button>

                              {openSectorMenuId === contact.id && (
                                <div
                                  className="absolute left-0 top-full mt-1 w-48 rounded-xl bg-slate-900 border border-slate-700 shadow-2xl p-1 z-50 space-y-0.5"
                                  onClick={e => e.stopPropagation()}
                                >
                                  <div className="text-[10px] font-bold text-slate-400 px-2 py-1 uppercase tracking-wider">
                                    Assign Sector
                                  </div>
                                  {SECTORS.map(s => (
                                    <button
                                      key={s.key}
                                      type="button"
                                      onClick={() => {
                                        if (onUpdateSector) onUpdateSector(contact.id, s.key);
                                        setOpenSectorMenuId(null);
                                      }}
                                      className={`w-full text-left px-2 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-between ${
                                        contact.sector === s.key ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800'
                                      }`}
                                    >
                                      <span>{s.label}</span>
                                      {contact.sector === s.key && <Check size={12} />}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* Stage Badge in Sector View */}
                            {groupBy === 'sector' && (
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">
                                {stageMeta.label}
                              </span>
                            )}

                            <span className="text-[10px] text-slate-400 font-mono">
                              {formatDateRelative(contact.last_contacted_at)}
                            </span>
                          </div>

                          {/* ONE-CLICK OUTCOME DISPOSITION BUTTONS (Universal Dial Rule applies) */}
                          <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-1">
                            {/* 1-Click No Answer */}
                            <button
                              type="button"
                              onClick={e => {
                                e.stopPropagation();
                                if (onOneClickOutcome) onOneClickOutcome(contact, 'NO_ANSWER');
                              }}
                              className="flex-1 py-1 px-1 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 text-[10px] font-bold flex items-center justify-center gap-1 transition"
                              title="Log No Answer (Bumps Dials and No Answer)"
                            >
                              <PhoneOff size={11} className="text-slate-400" />
                              <span>No Ans</span>
                            </button>

                            {/* 1-Click Voicemail */}
                            <button
                              type="button"
                              onClick={e => {
                                e.stopPropagation();
                                if (onOneClickOutcome) onOneClickOutcome(contact, 'VOICEMAIL');
                              }}
                              className="flex-1 py-1 px-1 rounded-lg bg-slate-950 hover:bg-slate-800 text-purple-300 hover:text-white border border-slate-800 text-[10px] font-bold flex items-center justify-center gap-1 transition"
                              title="Log Left Voicemail"
                            >
                              <Voicemail size={11} className="text-purple-400" />
                              <span>VM</span>
                            </button>

                            {/* 1-Click Pick Up / Connected */}
                            <button
                              type="button"
                              onClick={e => {
                                e.stopPropagation();
                                if (onOneClickOutcome) onOneClickOutcome(contact, 'CONVO');
                              }}
                              className="flex-1 py-1 px-1 rounded-lg bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-300 hover:text-emerald-100 border border-emerald-800/60 text-[10px] font-bold flex items-center justify-center gap-1 transition shadow-sm"
                              title="Mark Connected / In Discussion (Bumps Dials & Pick Ups)"
                            >
                              <PhoneIncoming size={11} className="text-emerald-400" />
                              <span>Pick Up</span>
                            </button>

                            {/* 1-Click Info Sent */}
                            <button
                              type="button"
                              onClick={e => {
                                e.stopPropagation();
                                if (onOneClickOutcome) onOneClickOutcome(contact, 'INFO_SENT');
                              }}
                              className="flex-1 py-1 px-1 rounded-lg bg-blue-950/60 hover:bg-blue-900/80 text-blue-300 hover:text-blue-100 border border-blue-800/60 text-[10px] font-bold flex items-center justify-center gap-1 transition shadow-sm"
                              title="Log Capabilities Info / Quote Sent (Bumps Dials & Info Sent)"
                            >
                              <FileText size={11} className="text-blue-400" />
                              <span>Info Sent</span>
                            </button>

                            {/* 1-Click Out of Service (OOS) - Prompts Office Check & Deletion */}
                            <button
                              type="button"
                              onClick={e => {
                                e.stopPropagation();
                                setOosConfirmContact(contact);
                              }}
                              className="py-1 px-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/70 text-rose-300 hover:text-rose-100 border border-rose-900/50 text-[10px] font-bold flex items-center justify-center gap-1 transition"
                              title="Out of service / Dead line"
                            >
                              <AlertTriangle size={11} className="text-rose-400" />
                              <span>OOS</span>
                            </button>

                            {/* More Options Dropdown */}
                            <div className="relative">
                              <button
                                type="button"
                                onClick={e => {
                                  e.stopPropagation();
                                  setOpenMoreActionsId(openMoreActionsId === contact.id ? null : contact.id);
                                  setOpenSectorMenuId(null);
                                }}
                                className="p-1 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition"
                                title="More actions"
                              >
                                <MoreHorizontal size={12} />
                              </button>

                              {openMoreActionsId === contact.id && (
                                <div
                                  className="absolute right-0 bottom-full mb-1 w-48 rounded-xl bg-slate-900 border border-slate-700 shadow-2xl p-1 z-50 space-y-0.5"
                                  onClick={e => e.stopPropagation()}
                                >
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (onOpenWalkthrough) {
                                        onOpenWalkthrough(contact);
                                      } else if (onOneClickOutcome) {
                                        onOneClickOutcome(contact, 'WALKTHROUGH');
                                      }
                                      setOpenMoreActionsId(null);
                                    }}
                                    className="w-full text-left px-2 py-1.5 rounded-lg text-xs font-semibold text-blue-300 hover:bg-slate-800 flex items-center gap-2"
                                  >
                                    <Calendar size={12} className="text-blue-400" />
                                    <span>Book Walkthrough</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (onOneClickOutcome) onOneClickOutcome(contact, 'JOB_WON');
                                      setOpenMoreActionsId(null);
                                    }}
                                    className="w-full text-left px-2 py-1.5 rounded-lg text-xs font-bold text-emerald-300 hover:bg-emerald-950/60 flex items-center gap-2"
                                  >
                                    <CheckCircle2 size={12} className="text-emerald-400" />
                                    <span>Job Won</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (onOneClickOutcome) onOneClickOutcome(contact, 'CALLBACK');
                                      setOpenMoreActionsId(null);
                                    }}
                                    className="w-full text-left px-2 py-1.5 rounded-lg text-xs font-semibold text-slate-300 hover:bg-slate-800 flex items-center gap-2"
                                  >
                                    <Clock size={12} className="text-amber-400" />
                                    <span>Schedule Callback</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (onOneClickOutcome) onOneClickOutcome(contact, 'NOT_INTERESTED');
                                      setOpenMoreActionsId(null);
                                    }}
                                    className="w-full text-left px-2 py-1.5 rounded-lg text-xs font-semibold text-rose-300 hover:bg-rose-950/60 flex items-center gap-2"
                                  >
                                    <XCircle size={12} className="text-rose-400" />
                                    <span>Not Interested</span>
                                  </button>
                                  <div className="border-t border-slate-800 my-1" />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (onOpenDossier) onOpenDossier(contact);
                                      setOpenMoreActionsId(null);
                                    }}
                                    className="w-full text-left px-2 py-1.5 rounded-lg text-xs font-bold text-blue-400 hover:bg-slate-800 flex items-center gap-2"
                                  >
                                    <User size={12} />
                                    <span>Open Full Dossier</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* OUT OF SERVICE VERIFICATION & DELETION MODAL */}
      {oosConfirmContact && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setOosConfirmContact(null)}
        >
          <div
            className="bg-slate-900 border border-rose-900/60 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl p-6 space-y-4"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-950 border border-rose-800/80 flex items-center justify-center shrink-0">
                <AlertTriangle className="text-rose-400" size={20} />
              </div>
              <div>
                <span className="text-[10px] font-bold font-mono tracking-wider uppercase text-rose-400 bg-rose-950/60 border border-rose-900/60 px-2 py-0.5 rounded">
                  Out of Service Verification
                </span>
                <h3 className="text-base font-bold text-white mt-1">
                  Have you called the office main line?
                </h3>
              </div>
            </div>

            {/* Details */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 space-y-2 text-xs">
              <div className="text-slate-300">
                Direct contact line <span className="font-mono text-rose-300 font-semibold">{oosConfirmContact.phone || 'N/A'}</span> for <strong className="text-white">{oosConfirmContact.name}</strong> at <strong className="text-white">{oosConfirmContact.company}</strong> is reported out of service.
              </div>
              
              {/* Office Switchboard / HQ line if available */}
              {(oosConfirmContact.company_phone || oosConfirmContact.work_direct_phone || oosConfirmContact.phone) && (
                <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                  <span className="text-slate-400">Office Main Line / HQ:</span>
                  <div className="flex items-center gap-1.5 font-mono text-blue-400 font-bold">
                    <span>{oosConfirmContact.company_phone || oosConfirmContact.work_direct_phone || 'Call Reception'}</span>
                    <button
                      type="button"
                      onClick={e => handleCopyPhone(e, oosConfirmContact.id, oosConfirmContact.company_phone || oosConfirmContact.phone)}
                      className="text-slate-400 hover:text-white p-1 rounded"
                      title="Copy phone"
                    >
                      {copiedId === oosConfirmContact.id ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed">
              If you have already called the office main line and this lead is completely unusable, clicking <strong className="text-rose-300">Yes</strong> will permanently delete this lead from the database.
            </p>

            {/* Action Buttons */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setOosConfirmContact(null)}
                className="flex-1 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition"
              >
                No, Call Office First
              </button>
              <button
                type="button"
                disabled={isDeletingLead}
                onClick={async () => {
                  setIsDeletingLead(true);
                  try {
                    if (onDeleteLead) {
                      await onDeleteLead(oosConfirmContact.id);
                    }
                  } finally {
                    setIsDeletingLead(false);
                    setOosConfirmContact(null);
                  }
                }}
                className="flex-1 py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition shadow-lg shadow-rose-950/50 disabled:opacity-50"
              >
                <Trash2 size={13} />
                <span>{isDeletingLead ? 'Deleting...' : 'Yes, Delete Lead'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
