import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Layers,
  Building2,
  Search,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  User,
  Copy,
  Check,
  Plus,
  Upload
} from 'lucide-react';

export const SECTORS = [
  { key: 'post_construction', label: 'Post-Construction', shortLabel: 'Construction', color: 'blue', description: 'General Contractors, Builders, Developers, Site Supers' },
  { key: 'franchise_owners', label: 'Franchise Owners', shortLabel: 'Franchise', color: 'amber', description: 'Franchise Owners, Multi-Unit Operators, Store Owners' },
  { key: 'commercial_office', label: 'Commercial Offices', shortLabel: 'Corporate', color: 'indigo', description: 'Corporate HQ, Business Centers, Office Parks' },
  { key: 'property_management', label: 'Property Management', shortLabel: 'Property Mgmt', color: 'emerald', description: 'Multi-Family, Condos, HOA, Commercial Landlords' },
  { key: 'industrial_warehouse', label: 'Industrial & Warehouses', shortLabel: 'Industrial', color: 'slate', description: 'Manufacturing, Warehouses, Logistics Hubs' },
  { key: 'medical_healthcare', label: 'Medical & Healthcare', shortLabel: 'Healthcare', color: 'cyan', description: 'Medical Clinics, Dental Offices, Surgical Centers' },
  { key: 'retail_hospitality', label: 'Retail & Hospitality', shortLabel: 'Retail / Dining', color: 'purple', description: 'Showrooms, Fitness Clubs, Retail Storefronts' },
];

export const STAGES = [
  { key: 'new', label: 'New Leads', shortLabel: 'New', color: '#64748b', bg: 'bg-slate-900/60', border: 'border-slate-800' },
  { key: 'no_answer', label: 'No Answer', shortLabel: 'No Answer', color: '#f59e0b', bg: 'bg-amber-950/20', border: 'border-amber-900/40' },
  { key: 'contacted', label: 'Contacted / In Progress', shortLabel: 'In Progress', color: '#3b82f6', bg: 'bg-blue-950/20', border: 'border-blue-900/40' },
  { key: 'walkthrough_booked', label: 'Walkthrough Booked', shortLabel: 'Booked', color: '#8b5cf6', bg: 'bg-purple-950/20', border: 'border-purple-900/40' },
  { key: 'quoted', label: 'Quote Sent', shortLabel: 'Quoted', color: '#06b6d4', bg: 'bg-cyan-950/20', border: 'border-cyan-900/40' },
  { key: 'won', label: 'Contract Won', shortLabel: 'Won', color: '#10b981', bg: 'bg-emerald-950/20', border: 'border-emerald-900/40' },
  { key: 'lost', label: 'Lost / Follow Up', shortLabel: 'Lost', color: '#ef4444', bg: 'bg-rose-950/20', border: 'border-rose-950/40' }
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
  const [activeSectorFilter, setActiveSectorFilter] = useState('all');
  const [isSectorDropdownOpen, setIsSectorDropdownOpen] = useState(false);
  const sectorDropdownRef = useRef(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [draggedContactId, setDraggedContactId] = useState(null);
  const [dragOverColumn, setDragOverColumn] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [copiedNameId, setCopiedNameId] = useState(null);
  const [openSectorMenuId, setOpenSectorMenuId] = useState(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (sectorDropdownRef.current && !sectorDropdownRef.current.contains(event.target)) {
        setIsSectorDropdownOpen(false);
      }
    }
    if (isSectorDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isSectorDropdownOpen]);

  const currentSectorMeta = useMemo(() => {
    if (activeSectorFilter === 'all') return null;
    return SECTORS.find(s => s.key === activeSectorFilter) || null;
  }, [activeSectorFilter]);

  // Horizontal Navigation & Scroll State
  const boardRef = useRef(null);
  const columnRefs = useRef({});
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const checkScrollability = () => {
    if (!boardRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = boardRef.current;
    setCanScrollLeft(scrollLeft > 15);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 15);
  };

  useEffect(() => {
    const el = boardRef.current;
    if (!el) return;
    checkScrollability();
    el.addEventListener('scroll', checkScrollability, { passive: true });
    window.addEventListener('resize', checkScrollability);
    return () => {
      el.removeEventListener('scroll', checkScrollability);
      window.removeEventListener('resize', checkScrollability);
    };
  }, [contacts.length]);

  const scrollBoard = (direction) => {
    if (!boardRef.current) return;
    const offset = direction === 'left' ? -400 : 400;
    boardRef.current.scrollBy({ left: offset, behavior: 'smooth' });
  };

  const scrollToStage = (stageKey) => {
    const targetEl = columnRefs.current[stageKey];
    if (targetEl && boardRef.current) {
      targetEl.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' });
    }
  };

  const handleBoardWheel = (e) => {
    // If the wheel event originated inside any column or its card list,
    // NEVER convert vertical wheel scrolling into horizontal board scrolling!
    // Column scrolling must stay purely vertical and cleanly stop at column boundaries.
    if (e.target.closest('.column-card-list') || e.target.closest('.kanban-column')) {
      return;
    }

    // Only translate vertical wheel to horizontal if cursor is over empty board gutters/padding
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX) && !e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey) {
      if (boardRef.current) {
        boardRef.current.scrollLeft += e.deltaY;
      }
    }
  };

  // Copy contact name helper
  const handleCopyName = (e, contactId, name) => {
    e.stopPropagation();
    if (!name) return;
    try {
      if (navigator?.clipboard?.writeText) {
        navigator.clipboard.writeText(name).catch(() => {
          fallbackCopyText(name);
        });
      } else {
        fallbackCopyText(name);
      }
    } catch {
      fallbackCopyText(name);
    }
    setCopiedNameId(contactId);
    setTimeout(() => setCopiedNameId(null), 1500);
  };

  // Copy phone number helper
  const handleCopyPhone = (e, contactId, phone) => {
    e.stopPropagation();
    if (!phone) return;
    try {
      if (navigator?.clipboard?.writeText) {
        navigator.clipboard.writeText(phone).catch(() => {
          fallbackCopyText(phone);
        });
      } else {
        fallbackCopyText(phone);
      }
    } catch {
      fallbackCopyText(phone);
    }
    setCopiedId(contactId);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const fallbackCopyText = (text) => {
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
  };

  // Filter contacts by search query and active sector filter
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

      // Filter by sector tab
      if (activeSectorFilter !== 'all') {
        const contactSector = c.sector || 'post_construction';
        if (contactSector !== activeSectorFilter) return false;
      }

      return true;
    });
  }, [contacts, searchQuery, activeSectorFilter]);

  // Sector Counts
  const sectorCounts = useMemo(() => {
    const counts = { all: contacts.length };
    SECTORS.forEach(s => {
      counts[s.key] = contacts.filter(c => (c.sector || 'post_construction') === s.key).length;
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

    if (onUpdateStatus) {
      onUpdateStatus(contactId, targetColKey);
    }
    setDraggedContactId(null);
  };

  return (
    <div className="space-y-5">
      {/* CONTROLS HEADER */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 shadow-sm">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Left: Search Bar & Sector Dropdown Filter */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 flex-1 max-w-2xl">
            {/* Search bar */}
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 transition"
                placeholder="Search by name, company, position, phone, city..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Sector Dropdown Filter */}
            <div className="relative shrink-0" ref={sectorDropdownRef}>
              <button
                type="button"
                onClick={() => setIsSectorDropdownOpen(prev => !prev)}
                className={`w-full sm:w-auto px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center justify-between sm:justify-start gap-2 border shadow-sm ${
                  activeSectorFilter !== 'all'
                    ? 'bg-blue-600/20 text-blue-200 border-blue-500/60 hover:bg-blue-600/30'
                    : 'bg-slate-950 text-slate-300 border-slate-800 hover:text-white hover:border-slate-700'
                }`}
                title="Filter by Industry Sector"
              >
                <div className="flex items-center gap-2 truncate">
                  <Building2 size={13} className={activeSectorFilter !== 'all' ? 'text-blue-400' : 'text-slate-400'} />
                  <span className="font-semibold text-slate-400">Sector:</span>
                  <span className="text-white font-bold truncate max-w-[150px]">
                    {currentSectorMeta?.label || 'All Sectors'}
                  </span>
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-mono bg-blue-950/80 text-blue-300 border border-blue-800/60">
                    {activeSectorFilter === 'all' ? (sectorCounts.all || 0) : (sectorCounts[activeSectorFilter] || 0)}
                  </span>
                </div>
                <ChevronDown
                  size={13}
                  className={`text-slate-400 transition-transform duration-200 shrink-0 ml-1 ${
                    isSectorDropdownOpen ? 'rotate-180 text-white' : ''
                  }`}
                />
              </button>

              {/* Sector Dropdown Menu */}
              {isSectorDropdownOpen && (
                <div className="absolute left-0 top-full mt-1.5 w-72 rounded-2xl bg-slate-950 border border-slate-800 shadow-2xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
                  <div className="px-2.5 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between border-b border-slate-800/80 mb-1">
                    <span>Filter By Sector</span>
                    <span className="font-mono text-slate-400">{contacts.length} total</span>
                  </div>

                  <div className="space-y-0.5 max-h-72 overflow-y-auto no-scrollbar">
                    {/* All Sectors Option */}
                    <button
                      type="button"
                      onClick={() => {
                        setActiveSectorFilter('all');
                        setIsSectorDropdownOpen(false);
                      }}
                      className={`w-full text-left px-2.5 py-2 rounded-xl text-xs font-semibold flex items-center justify-between transition ${
                        activeSectorFilter === 'all'
                          ? 'bg-blue-600 text-white font-bold shadow-sm'
                          : 'text-slate-300 hover:bg-slate-900 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Layers size={13} className={activeSectorFilter === 'all' ? 'text-white' : 'text-slate-400'} />
                        <span>All Sectors</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                          activeSectorFilter === 'all' ? 'bg-blue-700 text-blue-100' : 'bg-slate-900 text-slate-400 border border-slate-800'
                        }`}>
                          {sectorCounts.all || 0}
                        </span>
                        {activeSectorFilter === 'all' && <Check size={13} />}
                      </div>
                    </button>

                    {/* Individual Sectors */}
                    {SECTORS.map(sec => {
                      const count = sectorCounts[sec.key] || 0;
                      const isSelected = activeSectorFilter === sec.key;
                      return (
                        <button
                          key={sec.key}
                          type="button"
                          onClick={() => {
                            setActiveSectorFilter(sec.key);
                            setIsSectorDropdownOpen(false);
                          }}
                          className={`w-full text-left px-2.5 py-2 rounded-xl text-xs font-semibold flex items-center justify-between transition ${
                            isSelected
                              ? 'bg-blue-600 text-white font-bold shadow-sm'
                              : 'text-slate-300 hover:bg-slate-900 hover:text-white'
                          }`}
                        >
                          <div className="min-w-0 pr-2">
                            <div className="flex items-center gap-2">
                              <Building2 size={13} className={isSelected ? 'text-white' : 'text-blue-400'} />
                              <span className="truncate">{sec.label}</span>
                            </div>
                            {sec.description && (
                              <div className={`text-[10px] truncate pl-5 font-normal ${
                                isSelected ? 'text-blue-100/80' : 'text-slate-400'
                              }`}>
                                {sec.description}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                              isSelected ? 'bg-blue-700 text-blue-100' : 'bg-slate-900 text-slate-400 border border-slate-800'
                            }`}>
                              {count}
                            </span>
                            {isSelected && <Check size={13} />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Quick Metrics & Import Action */}
          <div className="flex items-center gap-3.5 text-xs text-slate-400 font-mono shrink-0 justify-end">
            <div>
              <span className="text-white font-bold text-sm">{filteredContacts.length}</span> leads shown
            </div>
            {onOpenImporter && (
              <button
                type="button"
                onClick={onOpenImporter}
                className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-sans text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
              >
                <Plus size={13} />
                <span>Import Leads</span>
              </button>
            )}
          </div>
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

      {/* STAGE JUMP STRIP & SIDEWAYS SCROLL NAVIGATION BAR */}
      {contacts.length > 0 && (
        <div className="flex items-center justify-between gap-3 bg-slate-900/80 border border-slate-800/80 px-3.5 py-2 rounded-xl shadow-xs">
          {/* Quick Stage Jump Buttons */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 min-w-0">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 shrink-0 mr-1 hidden sm:inline">
              Jump:
            </span>
            {STAGES.map(stage => {
              const count = filteredContacts.filter(c => {
                const s = (c.status || 'new').toLowerCase();
                if (stage.key === 'no_answer') return s === 'no_answer' || s === 'no_answers' || s === 'unreachable' || s === 'voicemail' || s === 'left_voicemail';
                if (stage.key === 'contacted') return s === 'contacted' || s === 'convo';
                return s === stage.key;
              }).length;

              return (
                <button
                  key={stage.key}
                  type="button"
                  onClick={() => scrollToStage(stage.key)}
                  className="px-2 py-1 rounded-lg bg-slate-950/80 hover:bg-slate-800 border border-slate-800/80 hover:border-slate-700 text-xs font-semibold flex items-center gap-1.5 shrink-0 transition group cursor-pointer"
                  title={`Jump to ${stage.label}`}
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0 group-hover:scale-125 transition-transform"
                    style={{ backgroundColor: stage.color }}
                  />
                  <span className="text-slate-300 group-hover:text-white truncate text-[11px]">
                    {stage.shortLabel || stage.label}
                  </span>
                  <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-900 px-1 rounded">
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Left & Right Column Scroll Arrows */}
          <div className="flex items-center gap-1.5 shrink-0 pl-2 border-l border-slate-800/80">
            <button
              type="button"
              onClick={() => scrollBoard('left')}
              disabled={!canScrollLeft}
              className={`px-2.5 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-1 transition cursor-pointer ${
                canScrollLeft
                  ? 'bg-blue-950/80 border-blue-800/80 text-blue-300 hover:bg-blue-900 hover:text-white shadow-sm'
                  : 'bg-slate-950/40 border-slate-800/50 text-slate-600 cursor-not-allowed'
              }`}
              title="Scroll board left"
            >
              <ChevronLeft size={15} />
              <span className="text-[11px] hidden sm:inline">Left</span>
            </button>
            <button
              type="button"
              onClick={() => scrollBoard('right')}
              disabled={!canScrollRight}
              className={`px-2.5 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-1 transition cursor-pointer ${
                canScrollRight
                  ? 'bg-blue-950/80 border-blue-800/80 text-blue-300 hover:bg-blue-900 hover:text-white shadow-sm'
                  : 'bg-slate-950/40 border-slate-800/50 text-slate-600 cursor-not-allowed'
              }`}
              title="Scroll board right"
            >
              <span className="text-[11px] hidden sm:inline">Right</span>
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      )}

      {/* KANBAN BOARD: HORIZONTAL SCROLLABLE COLUMNS WITH FLOATING CONTROLS */}
      {contacts.length > 0 && (
        <div className="relative group/kanban">
          {/* Floating Left Arrow */}
          {canScrollLeft && (
            <button
              type="button"
              onClick={() => scrollBoard('left')}
              className="absolute left-2 top-1/2 -translate-y-1/2 z-30 w-10 h-10 rounded-full bg-slate-950/90 border border-blue-500/70 shadow-2xl flex items-center justify-center text-blue-300 hover:text-white hover:bg-blue-600 hover:border-blue-400 transition-all transform hover:scale-110 active:scale-95 backdrop-blur-md cursor-pointer"
              title="Scroll left"
            >
              <ChevronLeft size={20} />
            </button>
          )}

          {/* Floating Right Arrow */}
          {canScrollRight && (
            <button
              type="button"
              onClick={() => scrollBoard('right')}
              className="absolute right-2 top-1/2 -translate-y-1/2 z-30 w-10 h-10 rounded-full bg-slate-950/90 border border-blue-500/70 shadow-2xl flex items-center justify-center text-blue-300 hover:text-white hover:bg-blue-600 hover:border-blue-400 transition-all transform hover:scale-110 active:scale-95 backdrop-blur-md cursor-pointer"
              title="Scroll right"
            >
              <ChevronRight size={20} />
            </button>
          )}

          <div
            ref={boardRef}
            onWheel={handleBoardWheel}
            className="flex gap-5 overflow-x-auto pb-6 pt-2 items-start min-h-[550px] kanban-horizontal-scroll"
          >
            {STAGES.map(col => {
              const colKey = col.key;
              const colLeads = filteredContacts.filter(c => {
                const s = (c.status || 'new').toLowerCase();
                if (colKey === 'no_answer') return s === 'no_answer' || s === 'no_answers' || s === 'unreachable' || s === 'voicemail' || s === 'left_voicemail';
                if (colKey === 'contacted') return s === 'contacted' || s === 'convo';
                return s === colKey;
              });
              const isDragTarget = dragOverColumn === colKey;

              return (
                <div
                  key={colKey}
                  ref={el => { columnRefs.current[colKey] = el; }}
                  onDragOver={e => handleDragOver(e, colKey)}
                  onDragLeave={handleDragLeave}
                  onDrop={e => handleDrop(e, colKey)}
                  className={`kanban-column w-[360px] shrink-0 rounded-2xl flex flex-col transition border ${
                    isDragTarget
                      ? 'border-blue-500 bg-blue-950/30 shadow-lg shadow-blue-500/10'
                      : 'border-slate-800/80 bg-slate-950/70'
                  }`}
                >
                  {/* Column Header */}
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

                  {/* Column Card List - Generous spacing to eliminate clumping */}
                  <div className="p-3 space-y-4 max-h-[660px] overflow-y-auto no-scrollbar scrollbar-none column-card-list">
                  {colLeads.length === 0 ? (
                    <div className="py-10 text-center text-xs text-slate-500 font-mono border border-dashed border-slate-800/80 rounded-xl">
                      No leads in this stage
                    </div>
                  ) : (
                    colLeads.map(contact => {
                      const sectorMeta = SECTORS.find(s => s.key === contact.sector) || SECTORS[0];
                      const hasDials = (contact.times_contacted || 0) > 0;

                      return (
                        <div
                          key={contact.id}
                          draggable
                          onDragStart={e => handleDragStart(e, contact.id)}
                          onDoubleClick={() => onOpenDossier && onOpenDossier(contact)}
                          className="p-4 rounded-xl bg-[#01162b] border border-blue-950/70 hover:border-blue-700/60 hover:bg-[#021d38] shadow-sm hover:shadow-md transition-all duration-150 space-y-3.5 cursor-grab active:cursor-grabbing group select-none"
                          title="Double-click to open full lead dossier"
                        >
                          {/* Top: Name, Position, Company & City */}
                          <div className="flex items-start justify-between gap-2.5">
                            <div className="min-w-0">
                              <div
                                onClick={e => handleCopyName(e, contact.id, contact.name)}
                                className="inline-flex items-center gap-1.5 cursor-pointer group/name py-0.5 rounded transition max-w-full"
                                title="Click to copy name"
                              >
                                <span className="font-bold text-[15px] text-white group-hover/name:text-blue-300 transition truncate tracking-tight select-text">
                                  {contact.name || 'Unnamed Contact'}
                                </span>
                                {copiedNameId === contact.id ? (
                                  <span className="inline-flex items-center gap-1 text-emerald-400 text-[10px] font-sans font-bold bg-emerald-950/90 px-1.5 py-0.5 rounded border border-emerald-800/80 animate-in fade-in shrink-0">
                                    <Check size={11} /> Copied!
                                  </span>
                                ) : (
                                  <span className="opacity-0 group-hover:opacity-100 group-hover/name:opacity-100 text-slate-400 hover:text-white p-0.5 transition shrink-0" title="Copy name">
                                    <Copy size={11} />
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-slate-400 flex items-center gap-1.5 truncate mt-0.5">
                                <span className="font-semibold text-slate-300 select-text">{contact.position || 'Project Lead'}</span>
                                <span className="text-slate-600">•</span>
                                <span className="truncate text-slate-400 select-text">{contact.company || 'Commercial Prospect'}</span>
                              </div>
                            </div>

                            {contact.city && (
                              <span className="text-[10px] text-slate-400 font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-800 shrink-0">
                                {contact.city}
                              </span>
                            )}
                          </div>

                          {/* Middle: Phone Display - Entire Box is 1-Click Copy */}
                          <div
                            onClick={e => handleCopyPhone(e, contact.id, contact.phone)}
                            className="p-2.5 rounded-lg bg-slate-950/90 border border-slate-800/80 hover:border-blue-600/50 flex items-center justify-between text-xs cursor-pointer transition group/phone"
                            title="Click anywhere to copy phone number"
                          >
                            <div className="flex items-center gap-2 font-mono text-[12px] font-medium text-slate-200">
                              <span className="group-hover/phone:text-blue-300 transition">
                                {contact.phone || 'No direct phone'}
                              </span>
                              {contact.phone && (
                                <span className="p-1 rounded bg-slate-900 border border-slate-800 text-slate-400 group-hover/phone:text-white transition">
                                  {copiedId === contact.id ? (
                                    <span className="flex items-center gap-1 text-emerald-400 text-[10px] font-sans font-bold">
                                      <Check size={11} /> Copied!
                                    </span>
                                  ) : (
                                    <Copy size={11} />
                                  )}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-1.5 text-[10px]">
                              {hasDials ? (
                                <span className="text-blue-300 font-mono font-semibold">
                                  {contact.times_contacted} dials
                                </span>
                              ) : (
                                <span className="text-slate-400 font-mono">Untouched</span>
                              )}
                              {contact.last_outcome && (
                                <span className="px-1.5 py-0.5 rounded bg-slate-900 text-slate-300 font-mono border border-slate-700/80 font-bold">
                                  {contact.last_outcome}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Sector Tag & Stage Badge */}
                          <div className="flex items-center justify-between gap-2 text-xs">
                            {/* Sector Selector Dropdown */}
                            <div className="relative">
                              <button
                                type="button"
                                onClick={e => {
                                  e.stopPropagation();
                                  setOpenSectorMenuId(openSectorMenuId === contact.id ? null : contact.id);
                                  setOpenMoreActionsId(null);
                                }}
                                className="px-2 py-1 rounded-md bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white text-[11px] font-semibold flex items-center gap-1.5 transition"
                                title="Click to reassign sector"
                              >
                                <Building2 size={11} className="text-blue-400" />
                                <span>{sectorMeta.shortLabel}</span>
                                <ChevronDown size={11} className="text-slate-400" />
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

                            <span className="text-[11px] text-slate-400 font-mono">
                              {formatDateRelative(contact.last_contacted_at)}
                            </span>
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
        </div>
      )}

    </div>
  );
}
