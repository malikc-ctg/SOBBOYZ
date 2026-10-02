import React, { useState, useEffect, useRef } from 'react';
import {
  fetchSalesContacts,
  updateLeadStatus,
  updateLeadContact,
  createNewPhoneLead,
  logCallEvent,
  getTodayCallStats,
  CALL_OUTCOMES,
  OBJECTION_REBUTTALS,
  CALL_SCRIPTS
} from '@/lib/sales/phoneService';
import {
  Building2,
  Plus,
  Phone,
  MessageSquare,
  Clock,
  ArrowRight,
  Shield,
  Flame,
  Search,
  CheckCircle2,
  Map,
  Upload,
  HardHat,
  Mail,
  User,
  Briefcase,
  AlertTriangle,
  Edit3,
  Save,
  Check,
  Calendar,
  Sparkles,
  PhoneCall,
  PhoneForwarded,
  Filter
} from 'lucide-react';
import MiroScriptEmbed from './MiroScriptEmbed';
import ApolloImporterModal from './ApolloImporterModal';
import WalkthroughModal from './WalkthroughModal';
import './phoneStyles.css';

const QUICK_ROLES = [
  'Project Manager',
  'Site Superintendent',
  'Estimator',
  'Property Manager',
  'Operations Director',
  'Owner / General Contractor'
];

export default function PhoneTab({ user, repName, isActive }) {
  // Navigation & Sub-views
  // 'queue' (Dialer & Lead Console) | 'miro' (Miro Mind Map) | 'scripts' (Quick Cards) | 'dialpad' | 'logs'
  const [subView, setSubView] = useState('queue');
  const [filter, setFilter] = useState('construction'); // default to post-construction target
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [showApolloModal, setShowApolloModal] = useState(false);
  const [showWalkthroughModal, setShowWalkthroughModal] = useState(false);
  const [showSaleModal, setShowSaleModal] = useState(false);
  const [showAddLeadModal, setShowAddLeadModal] = useState(false);

  // Data states
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedContact, setSelectedContact] = useState(null);
  const [callStats, setCallStats] = useState({
    totalCalls: 0,
    connects: 0,
    walkthroughs: 0,
    callbacks: 0,
    sales: 0,
    closeRate: '0.0',
    revenue: 0,
    todayCalls: []
  });

  // Active Call State
  const [activeCallContact, setActiveCallContact] = useState(null);
  const [callDuration, setCallDuration] = useState(0);
  const [isCalling, setIsCalling] = useState(false);
  const [callNotes, setCallNotes] = useState('');
  const [selectedObjection, setSelectedObjection] = useState('');
  const [selectedScriptKey, setSelectedScriptKey] = useState('POST_CONSTRUCTION_GC');
  const [callbackDateTime, setCallbackDateTime] = useState('');
  const [inCallMiroOpen, setInCallMiroOpen] = useState(false);

  // Sale Modal state
  const [saleAmount, setSaleAmount] = useState('2500');
  const [saleServiceType, setSaleServiceType] = useState('Post-Construction Rough & Final Turnover Clean');

  // In-Call Quick Enrichment fields (editing state for selected contact)
  const [isEditingContact, setIsEditingContact] = useState(false);
  const [editName, setEditName] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [editCompany, setEditCompany] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editCity, setEditCity] = useState('');
  const [saveSuccessMsg, setSaveSuccessMsg] = useState(false);

  // New B2B Lead Form State
  const [newLeadCompany, setNewLeadCompany] = useState('');
  const [newLeadName, setNewLeadName] = useState('');
  const [newLeadTitle, setNewLeadTitle] = useState('Project Manager');
  const [newLeadPhone, setNewLeadPhone] = useState('');
  const [newLeadEmail, setNewLeadEmail] = useState('');
  const [newLeadCity, setNewLeadCity] = useState('');
  const [newLeadVertical, setNewLeadVertical] = useState('post_construction');
  const [newLeadService, setNewLeadService] = useState('Post-Construction Rough & Final Turnover Clean');
  const [newLeadPrice, setNewLeadPrice] = useState('2500');
  const [newLeadNotes, setNewLeadNotes] = useState('');

  // Dialpad state
  const [dialNumber, setDialNumber] = useState('');

  // Call timer interval
  const timerRef = useRef(null);

  // 1. Fetch contacts & stats on mount & tab active
  useEffect(() => {
    if (!isActive) return;
    loadContacts();
    refreshStats();

    const handleSync = () => {
      refreshStats();
    };
    window.addEventListener('sync-local-events', handleSync);
    return () => window.removeEventListener('sync-local-events', handleSync);
  }, [isActive, filter]);

  // Synchronize edit fields when selected contact changes
  useEffect(() => {
    if (selectedContact) {
      setEditName(selectedContact.name || '');
      setEditTitle(selectedContact.position || '');
      setEditCompany(selectedContact.company || '');
      setEditPhone(selectedContact.phone || '');
      setEditEmail(selectedContact.email || '');
      setEditCity(selectedContact.city || '');
      setIsEditingContact(false);
      setSaveSuccessMsg(false);

      // Select relevant script
      if (selectedContact.service_type?.toLowerCase().includes('construction')) {
        setSelectedScriptKey('POST_CONSTRUCTION_GC');
      } else {
        setSelectedScriptKey('COMMERCIAL_B2B');
      }
    }
  }, [selectedContact]);

  // Handle live call timer
  useEffect(() => {
    if (isCalling) {
      timerRef.current = setInterval(() => {
        setCallDuration(d => d + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isCalling]);

  async function loadContacts() {
    setLoading(true);
    try {
      const data = await fetchSalesContacts(filter);
      setContacts(data);
      if (data.length > 0) {
        // Keep selected if still in list, else default to first
        if (!selectedContact || !data.some(c => c.id === selectedContact.id)) {
          setSelectedContact(data[0]);
        }
      } else {
        setSelectedContact(null);
      }
    } catch (e) {
      console.error('[PhoneTab] Error loading B2B contacts:', e);
    } finally {
      setLoading(false);
    }
  }

  async function refreshStats() {
    const stats = await getTodayCallStats();
    setCallStats(stats);
  }

  function formatDuration(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  // Quick In-Call Field Save
  async function handleSaveContactDetails() {
    if (!selectedContact?.id) return;
    try {
      await updateLeadContact(selectedContact.id, {
        customer_name: editName,
        contact_title: editTitle,
        company_name: editCompany,
        customer_phone: editPhone,
        customer_email: editEmail,
        city: editCity
      });

      // Update local state
      const updated = {
        ...selectedContact,
        name: editName,
        position: editTitle,
        company: editCompany,
        phone: editPhone,
        email: editEmail,
        city: editCity
      };
      setSelectedContact(updated);
      setContacts(prev => prev.map(c => c.id === updated.id ? updated : c));
      setIsEditingContact(false);
      setSaveSuccessMsg(true);
      setTimeout(() => setSaveSuccessMsg(false), 2500);
    } catch (err) {
      console.error('[PhoneTab] Failed saving contact enrichment:', err);
    }
  }

  // Launch a call to contact
  function startCall(contact) {
    setSelectedContact(contact);
    setActiveCallContact(contact);
    setCallDuration(0);
    setIsCalling(true);
    setCallNotes('');
    setSelectedObjection('');
    setCallbackDateTime('');
    setSaleAmount(contact.estimated_value ? String(contact.estimated_value) : '2500');
    setSaleServiceType(contact.service_type || 'Post-Construction Rough & Final Turnover Clean');

    // Trigger device dialer if on mobile or tel handler
    if (contact.phone) {
      const cleanPhone = contact.phone.replace(/[^0-9+]/g, '');
      window.location.href = `tel:${cleanPhone}`;
    }
  }

  // End Call & Log Disposition
  async function handleDisposition(outcomeType) {
    const contactToLog = activeCallContact || selectedContact;
    if (!contactToLog) return;

    if (outcomeType === 'SALE') {
      setShowSaleModal(true);
      return;
    }

    if (outcomeType === 'WALKTHROUGH') {
      setShowWalkthroughModal(true);
      return;
    }

    await logCallEvent({
      contactId: contactToLog.id,
      contactName: contactToLog.name,
      phoneNumber: contactToLog.phone,
      city: contactToLog.city,
      callType: 'OUTBOUND',
      outcomeType: outcomeType,
      durationSeconds: callDuration,
      notes: callNotes,
      callbackTime: outcomeType === 'CALLBACK' ? callbackDateTime : null,
      objectionType: selectedObjection || null,
      repId: user?.id || '07853cdf-ed2c-4f3b-b713-cde7c40e20a1',
      repName: repName || 'Malik',
    });

    setIsCalling(false);
    setActiveCallContact(null);
    refreshStats();
    loadContacts();
  }

  // Confirm Walkthrough Booking
  async function confirmWalkthroughBooking(walkDetails) {
    const contactToLog = activeCallContact || selectedContact;
    if (!contactToLog) return;

    const fullNotes = [
      callNotes,
      `Walkthrough scheduled: ${walkDetails.walkthroughDate}`,
      `Site: ${walkDetails.siteAddress}`,
      `On-Site Contact: ${walkDetails.siteContactName} (${walkDetails.siteContactPhone})`,
      `Scope: ${walkDetails.scopePhase}`,
      walkDetails.siteNotes ? `Protocols: ${walkDetails.siteNotes}` : ''
    ].filter(Boolean).join(' | ');

    await logCallEvent({
      contactId: contactToLog.id,
      contactName: walkDetails.siteContactName || contactToLog.name,
      phoneNumber: walkDetails.siteContactPhone || contactToLog.phone,
      city: contactToLog.city,
      callType: 'OUTBOUND',
      outcomeType: 'WALKTHROUGH',
      durationSeconds: callDuration,
      notes: fullNotes,
      callbackTime: walkDetails.walkthroughDate,
      saleDetails: {
        estimated_value: walkDetails.estimatedValue,
        site_address: walkDetails.siteAddress,
        scope: walkDetails.scopePhase
      },
      repId: user?.id || '07853cdf-ed2c-4f3b-b713-cde7c40e20a1',
      repName: repName || 'Malik',
    });

    setIsCalling(false);
    setActiveCallContact(null);
    refreshStats();
    loadContacts();
  }

  // Confirm Sale Submission
  async function confirmSale() {
    const contactToLog = activeCallContact || selectedContact;
    if (!contactToLog) return;

    await logCallEvent({
      contactId: contactToLog.id,
      contactName: contactToLog.name,
      phoneNumber: contactToLog.phone,
      city: contactToLog.city,
      callType: 'OUTBOUND',
      outcomeType: 'SALE',
      durationSeconds: callDuration,
      notes: callNotes,
      saleDetails: {
        job_total: saleAmount,
        service_type: saleServiceType,
        payment_method: 'Commercial Trade Subcontract Invoice',
        homeowner_name: contactToLog.name
      },
      repId: user?.id || '07853cdf-ed2c-4f3b-b713-cde7c40e20a1',
      repName: repName || 'Malik',
    });

    setShowSaleModal(false);
    setIsCalling(false);
    setActiveCallContact(null);
    refreshStats();
    loadContacts();
  }

  // Dialpad key press
  function handleDialPress(char) {
    if (dialNumber.length < 15) {
      setDialNumber(prev => prev + char);
    }
  }

  // Launch call from Dialpad
  function launchManualDial() {
    if (!dialNumber) return;
    const manualContact = {
      id: `manual_${Date.now()}`,
      name: 'General Contractor / DM',
      company: 'Outbound Builder Prospect',
      position: 'Project Manager',
      phone: dialNumber,
      city: 'GTA',
      service_type: 'Post-Construction Rough & Final Clean',
      estimated_value: 2500
    };
    startCall(manualContact);
  }

  // Add new lead form submission
  async function handleAddNewLead(e) {
    e.preventDefault();
    if (!newLeadCompany && !newLeadPhone) return;

    const res = await createNewPhoneLead({
      company_name: newLeadCompany,
      customer_name: newLeadName || 'Decision Maker / PM',
      contact_title: newLeadTitle,
      customer_phone: newLeadPhone,
      customer_email: newLeadEmail,
      city: newLeadCity || 'GTA',
      service_type: newLeadService,
      quoted_price: newLeadPrice,
      notes: newLeadNotes,
      source: 'cold_call'
    });

    if (res?.success) {
      setShowAddLeadModal(false);
      setNewLeadCompany('');
      setNewLeadName('');
      setNewLeadPhone('');
      setNewLeadEmail('');
      setNewLeadCity('');
      setNewLeadNotes('');
      loadContacts();
    }
  }

  // Filtered contacts based on search
  const filteredContacts = contacts.filter(c => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (c.company || '').toLowerCase().includes(q) ||
      (c.name || '').toLowerCase().includes(q) ||
      (c.position || '').toLowerCase().includes(q) ||
      (c.phone || '').includes(q) ||
      (c.email || '').toLowerCase().includes(q) ||
      (c.city || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="phone-workspace-root font-sans">
      {/* Workstation 2-Column Grid */}
      <div className="phone-grid-layout">
        
        {/* LEFT COLUMN: Apollo Lead Pipeline & Queue */}
        <div className="phone-panel">
          <div className="phone-panel-header">
            <div className="phone-panel-title">
              <HardHat className="w-4 h-4 text-amber-400" />
              <span>Commercial & GC Calling Queue</span>
              <span className="phone-badge">
                {loading ? 'Syncing...' : `${contacts.length} Leads`}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                className="phone-subtab-btn"
                style={{ padding: '4px 8px', fontSize: '11px', flex: 'none', background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.3)' }}
                onClick={() => setShowApolloModal(true)}
                title="Import Apollo.io Leads CSV"
              >
                <Upload size={12} /> Import Apollo
              </button>
              <button
                className="phone-subtab-btn active"
                style={{ padding: '4px 8px', fontSize: '11px', flex: 'none' }}
                onClick={() => setShowAddLeadModal(true)}
              >
                <Plus size={12} /> Add Lead
              </button>
            </div>
          </div>

          <div style={{ padding: '14px 16px' }}>
            {/* Search Box */}
            <div className="phone-search-box">
              <Search size={14} style={{ color: '#88a2c0', marginLeft: 8, marginRight: 4 }} />
              <input
                type="text"
                className="phone-search-input"
                placeholder="Search contractor, PM, title, phone, city..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Filter Chips Bar */}
            <div className="phone-filter-bar">
              <button
                className={`phone-filter-pill ${filter === 'construction' ? 'active' : ''}`}
                onClick={() => setFilter('construction')}
              >
                🔨 Construction GCs
              </button>
              <button
                className={`phone-filter-pill ${filter === 'all' ? 'active' : ''}`}
                onClick={() => setFilter('all')}
              >
                All Accounts ({contacts.length})
              </button>
              <button
                className={`phone-filter-pill ${filter === 'hot' ? 'active' : ''}`}
                onClick={() => setFilter('hot')}
              >
                🔥 Ready to Call
              </button>
              <button
                className={`phone-filter-pill ${filter === 'missing_info' ? 'active' : ''}`}
                onClick={() => setFilter('missing_info')}
                title="Leads missing direct phone or contact title - gatekeeper discovery targets"
              >
                ⚠️ Needs Info
              </button>
              <button
                className={`phone-filter-pill ${filter === 'walkthroughs' ? 'active' : ''}`}
                onClick={() => setFilter('walkthroughs')}
              >
                🚶‍♂️ Walkthroughs
              </button>
              <button
                className={`phone-filter-pill ${filter === 'callbacks' ? 'active' : ''}`}
                onClick={() => setFilter('callbacks')}
              >
                📅 Follow-ups
              </button>
            </div>

            {/* Scrollable Lead List */}
            {loading ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#88a2c0', fontSize: '13px' }}>
                <p>Loading commercial pipeline...</p>
              </div>
            ) : filteredContacts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px 16px', color: '#88a2c0' }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                  <HardHat className="w-6 h-6" />
                </div>
                <div style={{ fontSize: '14px', fontWeight: 800, color: '#fff', marginBottom: '4px' }}>
                  No Leads Found in this Queue
                </div>
                <p style={{ fontSize: '12px', color: '#88a2c0', maxWidth: 300, margin: '0 auto 16px', lineHeight: 1.5 }}>
                  Import your Apollo.io CSV export or add target General Contractors and commercial accounts to begin cold outreach.
                </p>
                <div className="flex justify-center gap-2">
                  <button
                    className="phone-call-btn"
                    style={{ padding: '8px 14px', fontSize: '12px' }}
                    onClick={() => setShowApolloModal(true)}
                  >
                    <Upload size={13} /> Import Apollo CSV
                  </button>
                  <button
                    className="phone-text-btn"
                    style={{ padding: '8px 14px', fontSize: '12px' }}
                    onClick={() => setShowAddLeadModal(true)}
                  >
                    + Add Single Lead
                  </button>
                </div>
              </div>
            ) : (
              <div className="phone-lead-list">
                {filteredContacts.map(c => {
                  const isSelected = selectedContact?.id === c.id;
                  const isLiveCalling = isCalling && activeCallContact?.id === c.id;
                  const isPostCon = (c.service_type || '').toLowerCase().includes('construction');

                  // Completeness checks
                  const hasName = Boolean(c.name && !c.name.toLowerCase().includes('decision maker'));
                  const hasPosition = Boolean(c.position);
                  const hasPhone = Boolean(c.phone);
                  const hasEmail = Boolean(c.email);

                  return (
                    <div
                      key={c.id}
                      className={`phone-lead-card ${isSelected ? 'selected' : ''}`}
                      onClick={() => setSelectedContact(c)}
                    >
                      <div className="phone-lead-top">
                        <div className="phone-lead-name">
                          <span className="truncate max-w-[200px]">{c.company || c.name}</span>
                          {isLiveCalling && (
                            <span style={{ color: '#10b981', fontSize: '10px', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              <span className="phone-timer-dot" /> LIVE
                            </span>
                          )}
                        </div>
                        <span className={`phone-lead-type-badge ${isPostCon ? 'badge-postcon' : 'badge-commercial'}`}>
                          {isPostCon ? '🔨 Post-Con' : '🏢 Commercial'}
                        </span>
                      </div>

                      {/* Contact Person & Position */}
                      <div className="flex items-center gap-1.5 text-xs text-slate-300 font-semibold my-1">
                        <User size={12} className={hasName ? "text-emerald-400" : "text-amber-400"} />
                        <span className="truncate">{c.name || 'Unknown Contact'}</span>
                        {c.position ? (
                          <span className="text-[10px] text-blue-300 bg-blue-900/40 px-1.5 py-0.5 rounded border border-blue-800/40 truncate max-w-[120px]">
                            {c.position}
                          </span>
                        ) : (
                          <span className="text-[10px] text-amber-400/80 bg-amber-900/30 px-1 py-0.5 rounded">
                            + Tag Role
                          </span>
                        )}
                      </div>

                      {/* Phone & Direct Status */}
                      <div className="flex items-center justify-between text-xs mt-1">
                        <div className="phone-lead-phone font-mono">
                          {c.phone ? (
                            c.phone
                          ) : (
                            <span className="text-amber-400 font-sans text-[11px] flex items-center gap-1">
                              <AlertTriangle size={11} /> No Direct Phone (HQ Lookup)
                            </span>
                          )}
                        </div>
                        {hasEmail && (
                          <span className="text-[10px] text-indigo-300 bg-indigo-950/60 px-1.5 py-0.5 rounded border border-indigo-800/40">
                            ✉️ Email
                          </span>
                        )}
                      </div>

                      {/* Service / Vertical Tag */}
                      <div className="phone-lead-service mt-1">
                        {c.service_type || 'Post-Construction Rough & Final Turnover'}
                      </div>

                      {/* Metadata Row */}
                      <div className="phone-lead-meta">
                        <span>{c.city || 'GTA'}</span>
                        <span className="phone-lead-val">${c.estimated_value || '2,500'}</span>
                        <span className="uppercase text-[10px] font-bold text-slate-400">
                          {c.status === 'walkthrough_booked' ? '🚶‍♂️ Walkthrough' : c.status || 'New'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Workstation Canvas & Active Calling Cockpit */}
        <div className="phone-panel">
          
          {/* Top Panel Header: Stats + Sub-view Navigation */}
          <div style={{ padding: '16px 18px 0' }}>
            {/* Metric Strip */}
            <div className="phone-metrics-strip">
              <div className="phone-metric-item">
                <span className="phone-metric-num" style={{ color: '#fff' }}>{callStats.totalCalls}</span>
                <span className="phone-metric-label">Dials Today</span>
              </div>
              <div className="phone-metric-item">
                <span className="phone-metric-num" style={{ color: '#60a5fa' }}>{callStats.connects}</span>
                <span className="phone-metric-label">Connects</span>
              </div>
              <div className="phone-metric-item" style={{ borderColor: 'rgba(59, 130, 246, 0.4)' }}>
                <span className="phone-metric-num" style={{ color: '#38bdf8' }}>{callStats.walkthroughs || 0}</span>
                <span className="phone-metric-label">Walkthroughs</span>
              </div>
              <div className="phone-metric-item">
                <span className="phone-metric-num" style={{ color: '#10b981' }}>{callStats.sales}</span>
                <span className="phone-metric-label">Jobs Won</span>
              </div>
            </div>

            {/* Sub-view Nav Pills */}
            <div className="phone-subtabs">
              <button
                className={`phone-subtab-btn ${subView === 'queue' ? 'active' : ''}`}
                onClick={() => setSubView('queue')}
                title="Active Dialing Console & Dossier"
              >
                <span>Console</span>
              </button>
              <button
                className={`phone-subtab-btn ${subView === 'miro' ? 'active' : ''}`}
                onClick={() => setSubView('miro')}
                title="Interactive Miro Mind Map Script"
                style={{ position: 'relative' }}
              >
                <Map size={13} className="text-amber-400" />
                <span>Miro Mind Map</span>
              </button>
              <button
                className={`phone-subtab-btn ${subView === 'scripts' ? 'active' : ''}`}
                onClick={() => setSubView('scripts')}
                title="B2B Commercial & GC Cheat Sheets"
              >
                <span>Quick Scripts</span>
              </button>
              <button
                className={`phone-subtab-btn ${subView === 'dialpad' ? 'active' : ''}`}
                onClick={() => setSubView('dialpad')}
                title="Manual Keypad"
              >
                <span>Dial Pad</span>
              </button>
              <button
                className={`phone-subtab-btn ${subView === 'logs' ? 'active' : ''}`}
                onClick={() => setSubView('logs')}
                title="Call History Logs"
              >
                <span>Logs ({callStats.todayCalls?.length || 0})</span>
              </button>
            </div>
          </div>

          <div className="phone-workstation-content">
            
            {/* VIEW 1: ACTIVE CALL CONSOLE & SELECTED CONTACT DOSSIER */}
            {subView === 'queue' && (
              <>
                {selectedContact ? (
                  <>
                    {/* Active Contact Dossier Card with Live Field Enrichment */}
                    <div className="phone-active-dossier">
                      <div className="phone-dossier-top">
                        <div className="flex-1 min-w-0 pr-2">
                          {isEditingContact ? (
                            <div className="space-y-2 mb-2">
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <label className="text-[10px] text-slate-400 uppercase font-bold">Company / GC</label>
                                  <input
                                    type="text"
                                    className="phone-search-input"
                                    style={{ padding: '6px 10px', fontSize: '13px' }}
                                    value={editCompany}
                                    onChange={e => setEditCompany(e.target.value)}
                                  />
                                </div>
                                <div>
                                  <label className="text-[10px] text-slate-400 uppercase font-bold">Contact Full Name</label>
                                  <input
                                    type="text"
                                    className="phone-search-input"
                                    style={{ padding: '6px 10px', fontSize: '13px' }}
                                    value={editName}
                                    onChange={e => setEditName(e.target.value)}
                                  />
                                </div>
                              </div>

                              <div className="grid grid-cols-3 gap-2">
                                <div>
                                  <label className="text-[10px] text-slate-400 uppercase font-bold">Role / Position</label>
                                  <input
                                    type="text"
                                    className="phone-search-input"
                                    style={{ padding: '6px 10px', fontSize: '12px' }}
                                    value={editTitle}
                                    onChange={e => setEditTitle(e.target.value)}
                                    placeholder="Project Manager"
                                  />
                                </div>
                                <div>
                                  <label className="text-[10px] text-slate-400 uppercase font-bold">Direct Phone</label>
                                  <input
                                    type="tel"
                                    className="phone-search-input"
                                    style={{ padding: '6px 10px', fontSize: '12px' }}
                                    value={editPhone}
                                    onChange={e => setEditPhone(e.target.value)}
                                  />
                                </div>
                                <div>
                                  <label className="text-[10px] text-slate-400 uppercase font-bold">Direct Email</label>
                                  <input
                                    type="email"
                                    className="phone-search-input"
                                    style={{ padding: '6px 10px', fontSize: '12px' }}
                                    value={editEmail}
                                    onChange={e => setEditEmail(e.target.value)}
                                  />
                                </div>
                              </div>

                              {/* Quick Role Chip Tags */}
                              <div className="flex flex-wrap gap-1.5 pt-1">
                                <span className="text-[10px] text-slate-400 self-center">Quick Tag:</span>
                                {QUICK_ROLES.map(role => (
                                  <button
                                    key={role}
                                    type="button"
                                    className="text-[10px] px-2 py-0.5 rounded bg-blue-900/30 hover:bg-blue-800/50 text-blue-300 border border-blue-700/40"
                                    onClick={() => setEditTitle(role)}
                                  >
                                    {role}
                                  </button>
                                ))}
                              </div>

                              <div className="flex gap-2 justify-end pt-1">
                                <button
                                  type="button"
                                  className="phone-text-btn"
                                  style={{ padding: '4px 10px', fontSize: '11px' }}
                                  onClick={() => setIsEditingContact(false)}
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  className="phone-call-btn"
                                  style={{ padding: '4px 12px', fontSize: '11px' }}
                                  onClick={handleSaveContactDetails}
                                >
                                  <Save size={12} /> Save Info
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="phone-dossier-name truncate">{selectedContact.company}</span>
                                <button
                                  type="button"
                                  onClick={() => setIsEditingContact(true)}
                                  className="text-slate-400 hover:text-blue-400 p-1 rounded"
                                  title="Quick Enrich Lead Info"
                                >
                                  <Edit3 size={13} />
                                </button>
                                {saveSuccessMsg && (
                                  <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-bold">
                                    <Check size={11} /> Saved
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                <span className="text-sm font-bold text-white flex items-center gap-1.5">
                                  <User size={13} className="text-slate-400" />
                                  {selectedContact.name}
                                </span>
                                {selectedContact.position ? (
                                  <span className="text-xs font-semibold text-blue-300 bg-blue-950/70 border border-blue-800/50 px-2 py-0.5 rounded-full">
                                    {selectedContact.position}
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => setIsEditingContact(true)}
                                    className="text-[11px] text-amber-400/90 bg-amber-950/40 border border-amber-800/40 px-2 py-0.5 rounded-full hover:bg-amber-900/60"
                                  >
                                    + Tag Role (e.g. PM / Super)
                                  </button>
                                )}
                              </div>

                              <div className="flex items-center gap-4 mt-1.5 text-xs text-slate-300">
                                <div className="font-mono font-bold text-blue-400">
                                  {selectedContact.phone || (
                                    <span className="text-amber-400 font-sans text-xs">
                                      ⚠️ No Direct Phone (Call Switchboard)
                                    </span>
                                  )}
                                </div>
                                {selectedContact.email && (
                                  <div className="text-slate-400 flex items-center gap-1">
                                    <Mail size={12} className="text-indigo-400" /> {selectedContact.email}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="phone-dossier-actions shrink-0">
                          <button
                            className="phone-call-btn"
                            onClick={() => startCall(selectedContact)}
                          >
                            <Phone size={13} style={{ marginRight: 6 }} /> Call Now
                          </button>
                          {selectedContact.phone && (
                            <a
                              href={`sms:${selectedContact.phone.replace(/[^0-9+]/g, '')}`}
                              className="phone-text-btn"
                            >
                              <MessageSquare size={13} style={{ marginRight: 6 }} /> SMS
                            </a>
                          )}
                        </div>
                      </div>

                      {/* Detail Matrix */}
                      <div className="phone-dossier-grid">
                        <div className="phone-dossier-cell">
                          <span className="phone-dossier-label">City / Territory</span>
                          <span className="phone-dossier-val">{selectedContact.city || 'GTA'}</span>
                        </div>
                        <div className="phone-dossier-cell">
                          <span className="phone-dossier-label">Service Scope</span>
                          <span className="phone-dossier-val truncate">{selectedContact.service_type || 'Post-Construction Turnover'}</span>
                        </div>
                        <div className="phone-dossier-cell">
                          <span className="phone-dossier-label">Target Bid Value</span>
                          <span className="phone-dossier-val" style={{ color: '#10b981' }}>
                            ${selectedContact.estimated_value || '2,500'}
                          </span>
                        </div>
                      </div>

                      {selectedContact.notes && (
                        <div style={{ fontSize: '11px', color: '#94a3b8', background: 'rgba(0,0,0,0.2)', padding: '6px 10px', borderRadius: '8px' }}>
                          <strong>Lead Notes / Apollo Intelligence:</strong> {selectedContact.notes}
                        </div>
                      )}
                    </div>

                    {/* Active Live Call Timer & Disposition Box */}
                    <div className="phone-active-call-box">
                      <div className="phone-call-timer-row">
                        <div className="phone-timer-badge">
                          {isCalling && <span className="phone-timer-dot" />}
                          <span>{isCalling ? `ON CALL: ${formatDuration(callDuration)}` : 'CALL DISPOSITION'}</span>
                        </div>
                        
                        {/* Quick Toggle for In-Call Miro Script */}
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            className="text-xs px-2.5 py-1 rounded-md font-semibold bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1.5 transition"
                            onClick={() => setInCallMiroOpen(!inCallMiroOpen)}
                          >
                            <Map size={12} />
                            {inCallMiroOpen ? 'Hide Mind Map' : '🗺️ Open Miro Mind Map'}
                          </button>
                        </div>
                      </div>

                      {/* Inline Miro Mind Map Split (when rep toggles it during call) */}
                      {inCallMiroOpen && (
                        <div className="my-2 border border-slate-700/60 rounded-xl overflow-hidden">
                          <MiroScriptEmbed isCompact={true} />
                        </div>
                      )}

                      {/* Rep Live Notes Input */}
                      <div>
                        <textarea
                          className="phone-notes-area"
                          placeholder="Type live call notes... (e.g. Spoke with Site Super Dave, rough clean done, needs final handover clean next Thursday on 45,000 sq ft office fit-out. Steel toes required on site.)"
                          value={callNotes}
                          onChange={e => setCallNotes(e.target.value)}
                        />
                      </div>

                      {/* 1-Tap Disposition Buttons */}
                      <div>
                        <div style={{ fontSize: '11px', fontWeight: 700, color: '#8888a0', textTransform: 'uppercase', marginBottom: 6 }}>
                          Record Call Outcome:
                        </div>
                        <div className="phone-dispositions-grid">
                          {/* PRIMARY B2B GOAL: SITE WALKTHROUGH */}
                          <button
                            className="phone-disp-btn"
                            style={{
                              gridColumn: 'span 3',
                              background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                              borderColor: '#3b82f6',
                              color: '#fff',
                              fontSize: '13px',
                              padding: '11px',
                              boxShadow: '0 2px 10px rgba(37, 99, 235, 0.3)'
                            }}
                            onClick={() => handleDisposition('WALKTHROUGH')}
                          >
                            🚶‍♂️ BOOK SITE WALKTHROUGH ASSESSMENT (PRIMARY GOAL)
                          </button>

                          <button
                            className="phone-disp-btn won"
                            onClick={() => handleDisposition('SALE')}
                          >
                            🏆 WON TRADE SUBCONTRACT / PO ($)
                          </button>

                          <button
                            className="phone-disp-btn"
                            style={{ borderColor: 'rgba(6, 182, 212, 0.4)', color: '#22d3ee' }}
                            onClick={() => handleDisposition('SEND_QUOTE')}
                          >
                            ✉️ Send Bid / Rate Card
                          </button>

                          <button
                            className="phone-disp-btn"
                            style={{ borderColor: 'rgba(139, 92, 246, 0.4)', color: '#c084fc' }}
                            onClick={() => handleDisposition('CALLBACK')}
                          >
                            📅 Callback Scheduled
                          </button>

                          <button
                            className="phone-disp-btn"
                            style={{ color: '#f59e0b', borderColor: 'rgba(245, 158, 11, 0.3)' }}
                            onClick={() => handleDisposition('GATEKEEPER')}
                          >
                            🚪 Gatekeeper / Found DM
                          </button>

                          <button
                            className="phone-disp-btn"
                            style={{ color: '#10b981' }}
                            onClick={() => handleDisposition('CONVO')}
                          >
                            🗣️ Qualified Interest
                          </button>

                          <button
                            className="phone-disp-btn"
                            style={{ color: '#94a3b8' }}
                            onClick={() => handleDisposition('VOICEMAIL')}
                          >
                            📼 Left Voicemail
                          </button>

                          <button
                            className="phone-disp-btn"
                            style={{ color: '#94a3b8' }}
                            onClick={() => handleDisposition('NO_ANSWER')}
                          >
                            📵 No Answer
                          </button>

                          <button
                            className="phone-disp-btn"
                            style={{ color: '#f87171' }}
                            onClick={() => handleDisposition('NOT_INTERESTED')}
                          >
                            ⛔ Not Interested
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Objection Rebuttal Battle Cards */}
                    <div className="phone-scripts-card">
                      <div className="phone-scripts-header flex items-center justify-between">
                        <span>🔨 Post-Construction & Commercial Objection Battle-Cards</span>
                        <span className="text-[10px] text-slate-400">1-Tap Rebuttals</span>
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {OBJECTION_REBUTTALS.map((r, idx) => (
                          <button
                            key={idx}
                            className={`phone-filter-pill ${selectedObjection === r.title ? 'active' : ''}`}
                            onClick={() => setSelectedObjection(selectedObjection === r.title ? '' : r.title)}
                          >
                            "{r.title}"
                          </button>
                        ))}
                      </div>

                      {selectedObjection && (
                        <div className="phone-script-box" style={{ marginTop: 10 }}>
                          <div className="text-xs font-bold text-amber-300 mb-1">
                            Trigger: {OBJECTION_REBUTTALS.find(r => r.title === selectedObjection)?.trigger}
                          </div>
                          <strong style={{ color: '#60a5fa' }}>Turnaround: </strong>
                          {OBJECTION_REBUTTALS.find(r => r.title === selectedObjection)?.rebuttal}
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div style={{ textAlign: 'center', padding: '60px 20px', color: '#88a2c0' }}>
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
                      <HardHat size={38} className="text-amber-400" />
                    </div>
                    <div style={{ fontSize: '16px', fontWeight: 800, color: '#fff', marginBottom: 8 }}>
                      Post-Construction & Commercial Inside Sales Console
                    </div>
                    <p style={{ fontSize: '13px', color: '#88a2c0', maxWidth: 380, margin: '0 auto 20px', lineHeight: 1.5 }}>
                      Select a General Contractor or commercial account on the left to start cold calling, open your Miro script mind map, and book site walkthroughs.
                    </p>
                    <div className="flex justify-center gap-2">
                      <button
                        className="phone-call-btn"
                        style={{ padding: '9px 18px', fontSize: '13px' }}
                        onClick={() => setShowApolloModal(true)}
                      >
                        <Upload size={14} /> Import Apollo.io Leads
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* VIEW 2: DEDICATED MIRO MIND MAP SCRIPT VIEW */}
            {subView === 'miro' && (
              <div className="phone-scripts-card" style={{ padding: 12 }}>
                <MiroScriptEmbed />
              </div>
            )}

            {/* VIEW 3: QUICK B2B & GC SCRIPTS CHEAT SHEET */}
            {subView === 'scripts' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'flex', gap: 6, background: '#001326', padding: 4, borderRadius: 10, overflowX: 'auto' }}>
                  {Object.entries(CALL_SCRIPTS).map(([key, script]) => (
                    <button
                      key={key}
                      className={`phone-subtab-btn ${selectedScriptKey === key ? 'active' : ''}`}
                      onClick={() => setSelectedScriptKey(key)}
                      style={{ whiteSpace: 'nowrap' }}
                    >
                      {script.title}
                    </button>
                  ))}
                </div>

                {CALL_SCRIPTS[selectedScriptKey] && (
                  <div className="phone-scripts-card">
                    <h4 style={{ fontSize: '15px', fontWeight: 800, color: '#fff', marginBottom: 12 }}>
                      {CALL_SCRIPTS[selectedScriptKey].title}
                    </h4>

                    <div style={{ marginBottom: 12 }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: '#60a5fa', textTransform: 'uppercase' }}>
                        1. Opener & Hook:
                      </span>
                      <div className="phone-script-box">
                        {CALL_SCRIPTS[selectedScriptKey].opener}
                      </div>
                    </div>

                    <div style={{ marginBottom: 12 }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: '#f59e0b', textTransform: 'uppercase' }}>
                        2. Discovery & Trade Qualification:
                      </span>
                      <div className="phone-script-box" style={{ borderLeftColor: '#f59e0b' }}>
                        {CALL_SCRIPTS[selectedScriptKey].discovery}
                      </div>
                    </div>

                    {CALL_SCRIPTS[selectedScriptKey].value && (
                      <div style={{ marginBottom: 12 }}>
                        <span style={{ fontSize: '11px', fontWeight: 700, color: '#a855f7', textTransform: 'uppercase' }}>
                          3. Trade Value & Credentials:
                        </span>
                        <div className="phone-script-box" style={{ borderLeftColor: '#a855f7' }}>
                          {CALL_SCRIPTS[selectedScriptKey].value}
                        </div>
                      </div>
                    )}

                    <div>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: '#10b981', textTransform: 'uppercase' }}>
                        4. Walkthrough Close:
                      </span>
                      <div className="phone-script-box" style={{ borderLeftColor: '#10b981' }}>
                        {CALL_SCRIPTS[selectedScriptKey].close}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* VIEW 4: MANUAL DIAL PAD */}
            {subView === 'dialpad' && (
              <div className="phone-dialpad-container">
                <div className="phone-dial-display">
                  <span>{dialNumber || 'Enter Phone #'}</span>
                  {dialNumber && (
                    <button className="phone-dial-clear" onClick={() => setDialNumber('')}>
                      ✕
                    </button>
                  )}
                </div>

                <div className="phone-keypad-grid">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].map(k => (
                    <button
                      key={k}
                      className="phone-key-btn"
                      onClick={() => handleDialPress(k)}
                    >
                      <span className="phone-key-num">{k}</span>
                    </button>
                  ))}
                </div>

                <button
                  className="phone-call-btn"
                  style={{ width: '100%', padding: '14px', fontSize: '15px' }}
                  onClick={launchManualDial}
                  disabled={!dialNumber}
                >
                  <Phone size={15} style={{ marginRight: 8 }} /> Call Number
                </button>
              </div>
            )}

            {/* VIEW 5: CALL HISTORY */}
            {subView === 'logs' && (
              <div className="phone-scripts-card">
                <div className="phone-scripts-header flex items-center justify-between">
                  <span>Today's Call History</span>
                  <span className="text-xs text-slate-400">{callStats.todayCalls.length} Dials Logged</span>
                </div>

                {callStats.todayCalls.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '30px 0', color: '#88a2c0', fontSize: '12px' }}>
                    No calls recorded yet today. Dial contacts from queue to build history.
                  </div>
                ) : (
                  <table className="phone-logs-table">
                    <thead>
                      <tr>
                        <th>Time</th>
                        <th>Target</th>
                        <th>Outcome</th>
                        <th>Duration</th>
                        <th>Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {callStats.todayCalls.map((call, idx) => (
                        <tr key={idx}>
                          <td>{new Date(call.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                          <td>
                            <strong>{call.contact_name || 'Prospect'}</strong>
                            <div style={{ fontSize: '11px', color: '#88a2c0' }}>{call.phone_number}</div>
                          </td>
                          <td>
                            <span className="phone-lead-type-badge badge-postcon">
                              {call.outcome_type}
                            </span>
                          </td>
                          <td>{formatDuration(call.duration_seconds || 0)}</td>
                          <td style={{ fontSize: '11px', color: '#94a3b8' }}>{call.notes || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Walkthrough Booking Modal */}
      <WalkthroughModal
        isOpen={showWalkthroughModal}
        contact={activeCallContact || selectedContact}
        onClose={() => setShowWalkthroughModal(false)}
        onConfirm={confirmWalkthroughBooking}
      />

      {/* Apollo Leads Importer Modal */}
      <ApolloImporterModal
        isOpen={showApolloModal}
        onClose={() => setShowApolloModal(false)}
        onImportSuccess={() => {
          loadContacts();
          refreshStats();
        }}
      />

      {/* Sale Won Modal */}
      {showSaleModal && (
        <div className="phone-modal-overlay">
          <div className="phone-modal-content">
            <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#10b981', marginBottom: 8 }}>
              Cleaning Subcontract / Job Won!
            </h3>
            <p style={{ fontSize: '12px', color: '#88a2c0', marginBottom: 16 }}>
              Enter the agreed trade contract value and cleaning scope to credit your commission and book the job into operations.
            </p>

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: '11px', fontWeight: 700, color: '#88a2c0', display: 'block', marginBottom: 4 }}>
                Contract / Invoice Value ($)
              </label>
              <input
                type="number"
                className="phone-search-input"
                style={{ padding: '10px 14px' }}
                value={saleAmount}
                onChange={e => setSaleAmount(e.target.value)}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: '11px', fontWeight: 700, color: '#88a2c0', display: 'block', marginBottom: 4 }}>
                Service Scope / Turnover Phase
              </label>
              <input
                type="text"
                className="phone-search-input"
                style={{ padding: '10px 14px' }}
                value={saleServiceType}
                onChange={e => setSaleServiceType(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                className="phone-text-btn"
                onClick={() => setShowSaleModal(false)}
              >
                Cancel
              </button>
              <button
                className="phone-call-btn"
                onClick={confirmSale}
              >
                Confirm Contract ($)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Add B2B Lead Modal */}
      {showAddLeadModal && (
        <div className="phone-modal-overlay">
          <div className="phone-modal-content" style={{ maxWidth: 500 }}>
            <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#fff', marginBottom: 4 }}>
              Add Cold Call Target
            </h3>
            <p style={{ fontSize: '12px', color: '#88a2c0', marginBottom: 16 }}>
              Add a General Contractor, Project Manager, or commercial account for outbound tele-sales.
            </p>

            <form onSubmit={handleAddNewLead}>
              <div style={{ marginBottom: 10 }}>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#88a2c0', display: 'block', marginBottom: 4 }}>
                  Company / General Contractor Name *
                </label>
                <input
                  type="text"
                  required
                  className="phone-search-input"
                  style={{ padding: '10px 14px' }}
                  placeholder="e.g. EllisDon Construction / PCL Builders"
                  value={newLeadCompany}
                  onChange={e => setNewLeadCompany(e.target.value)}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#88a2c0', display: 'block', marginBottom: 4 }}>
                    Decision Maker Name
                  </label>
                  <input
                    type="text"
                    className="phone-search-input"
                    style={{ padding: '10px 14px' }}
                    placeholder="e.g. Dan Miller"
                    value={newLeadName}
                    onChange={e => setNewLeadName(e.target.value)}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#88a2c0', display: 'block', marginBottom: 4 }}>
                    Position / Role
                  </label>
                  <input
                    type="text"
                    className="phone-search-input"
                    style={{ padding: '10px 14px' }}
                    placeholder="Project Manager"
                    value={newLeadTitle}
                    onChange={e => setNewLeadTitle(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#88a2c0', display: 'block', marginBottom: 4 }}>
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    className="phone-search-input"
                    style={{ padding: '10px 14px' }}
                    placeholder="(416) 555-0199"
                    value={newLeadPhone}
                    onChange={e => setNewLeadPhone(e.target.value)}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#88a2c0', display: 'block', marginBottom: 4 }}>
                    Direct Email
                  </label>
                  <input
                    type="email"
                    className="phone-search-input"
                    style={{ padding: '10px 14px' }}
                    placeholder="dmiller@builder.ca"
                    value={newLeadEmail}
                    onChange={e => setNewLeadEmail(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#88a2c0', display: 'block', marginBottom: 4 }}>
                    City / Territory
                  </label>
                  <input
                    type="text"
                    className="phone-search-input"
                    style={{ padding: '10px 14px' }}
                    placeholder="Toronto / Mississauga"
                    value={newLeadCity}
                    onChange={e => setNewLeadCity(e.target.value)}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#88a2c0', display: 'block', marginBottom: 4 }}>
                    Target Job Value ($)
                  </label>
                  <input
                    type="number"
                    className="phone-search-input"
                    style={{ padding: '10px 14px' }}
                    placeholder="2500"
                    value={newLeadPrice}
                    onChange={e => setNewLeadPrice(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ marginBottom: 10 }}>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#88a2c0', display: 'block', marginBottom: 4 }}>
                  Target Cleaning Vertical
                </label>
                <select
                  className="phone-search-input"
                  style={{ padding: '10px 14px', background: '#001326' }}
                  value={newLeadVertical}
                  onChange={e => {
                    setNewLeadVertical(e.target.value);
                    if (e.target.value === 'post_construction') {
                      setNewLeadService('Post-Construction Rough & Final Turnover Clean');
                      setNewLeadPrice('2500');
                    } else {
                      setNewLeadService('Commercial Dumpster Steam Sanitization');
                      setNewLeadPrice('650');
                    }
                  }}
                >
                  <option value="post_construction">🔨 Post-Construction (General Contractors & Builders)</option>
                  <option value="commercial">🏢 Commercial Plazas & Facilities</option>
                  <option value="property_management">🏠 Property Management & Multi-Res</option>
                </select>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#88a2c0', display: 'block', marginBottom: 4 }}>
                  Gatekeeper / Switchboard Notes
                </label>
                <textarea
                  className="phone-search-input"
                  style={{ padding: '8px 12px', minHeight: 60 }}
                  placeholder="HQ receptionist extension, best time to reach PM, project site address..."
                  value={newLeadNotes}
                  onChange={e => setNewLeadNotes(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="phone-text-btn"
                  onClick={() => setShowAddLeadModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="phone-call-btn"
                >
                  Save Lead
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
