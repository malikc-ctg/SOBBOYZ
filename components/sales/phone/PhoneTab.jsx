import React, { useState, useEffect, useRef } from 'react';
import {
  fetchSalesContacts,
  updateLeadStatus,
  createNewPhoneLead,
  logCallEvent,
  getLocalCallHistory,
  getTodayCallStats,
  CALL_OUTCOMES,
  OBJECTION_REBUTTALS,
  CALL_SCRIPTS
} from '@/lib/sales/phoneService';
import { Building2, Plus, Phone, MessageSquare, Clock, ArrowRight, Shield, Flame, Search, CheckCircle2 } from 'lucide-react';
import './phoneStyles.css';

export default function PhoneTab({ user, repName, isActive }) {
  // Navigation & Sub-views
  const [subView, setSubView] = useState('queue'); // 'queue' | 'dialpad' | 'scripts' | 'logs'
  const [filter, setFilter] = useState('all'); // 'all' | 'hot' | 'callbacks'
  const [searchQuery, setSearchQuery] = useState('');

  // Data states
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedContact, setSelectedContact] = useState(null);
  const [callStats, setCallStats] = useState({
    totalCalls: 0,
    connects: 0,
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
  const [selectedScriptKey, setSelectedScriptKey] = useState('COMMERCIAL_B2B');
  const [callbackDateTime, setCallbackDateTime] = useState('');
  const [showSaleModal, setShowSaleModal] = useState(false);
  const [saleAmount, setSaleAmount] = useState('650');
  const [saleServiceType, setSaleServiceType] = useState('Commercial Dumpster Pad Steam Sanitization & Exterior Wash');
  const [showAddLeadModal, setShowAddLeadModal] = useState(false);

  // New B2B Lead Form State
  const [newLeadCompany, setNewLeadCompany] = useState('');
  const [newLeadName, setNewLeadName] = useState('');
  const [newLeadPhone, setNewLeadPhone] = useState('');
  const [newLeadCity, setNewLeadCity] = useState('');
  const [newLeadFacility, setNewLeadFacility] = useState('Strip Plaza / Retail Center');
  const [newLeadService, setNewLeadService] = useState('Dumpster Pad Steam Sanitization');
  const [newLeadPrice, setNewLeadPrice] = useState('650');
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
      if (data.length > 0 && !selectedContact) {
        setSelectedContact(data[0]);
      } else if (data.length === 0) {
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

  // Format Call Timer mm:ss
  function formatDuration(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
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
    setSaleAmount(contact.estimated_value ? String(contact.estimated_value) : '650');
    setSaleServiceType(contact.service_type || 'Commercial Dumpster Pad Steam Sanitization');

    // Trigger device dialer if on mobile
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
        payment_method: 'Commercial Monthly Invoice',
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
      name: 'Commercial Prospect',
      company: 'Outbound Plaza / B2B Target',
      phone: dialNumber,
      city: 'GTA',
      service_type: 'Commercial Dumpster Steam Sanitization',
      estimated_value: 650
    };
    startCall(manualContact);
  }

  // Add new B2B lead form submission
  async function handleAddNewLead(e) {
    e.preventDefault();
    if (!newLeadPhone || !newLeadCompany) return;

    const res = await createNewPhoneLead({
      company_name: newLeadCompany,
      customer_name: newLeadName || 'Property Manager / DM',
      customer_phone: newLeadPhone,
      city: newLeadCity || 'GTA',
      service_type: newLeadService,
      quoted_price: newLeadPrice,
      notes: `${newLeadFacility} — ${newLeadNotes}`
    });

    if (res?.success) {
      setShowAddLeadModal(false);
      setNewLeadCompany('');
      setNewLeadName('');
      setNewLeadPhone('');
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
      (c.phone || '').includes(q) ||
      (c.city || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="phone-workspace-root font-sans">
      {/* 2-Column Workstation Grid */}
      <div className="phone-grid-layout">
        
        {/* LEFT COLUMN: B2B Lead Pipeline & Queue */}
        <div className="phone-panel">
          <div className="phone-panel-header">
            <div className="phone-panel-title">
              <Building2 className="w-4 h-4 text-emerald-500" />
              <span>B2B Commercial Pipeline</span>
              <span className="phone-badge">
                {loading ? 'Syncing...' : `${contacts.length} Accounts`}
              </span>
            </div>
            <button
              className="phone-subtab-btn active"
              style={{ padding: '4px 10px', fontSize: '11px', flex: 'none' }}
              onClick={() => setShowAddLeadModal(true)}
            >
              + Add B2B Lead
            </button>
          </div>

          <div style={{ padding: '14px 16px' }}>
            {/* Search Box */}
            <div className="phone-search-box">
              <Search size={14} style={{ color: '#88a2c0', marginLeft: 8, marginRight: 4 }} />
              <input
                type="text"
                className="phone-search-input"
                placeholder="Search plaza, company, contact, phone..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Filter Chips Bar */}
            <div className="phone-filter-bar">
              <button
                className={`phone-filter-pill ${filter === 'all' ? 'active' : ''}`}
                onClick={() => setFilter('all')}
              >
                All B2B ({contacts.length})
              </button>
              <button
                className={`phone-filter-pill ${filter === 'hot' ? 'active' : ''}`}
                onClick={() => setFilter('hot')}
              >
                Hot Outreach
              </button>
              <button
                className={`phone-filter-pill ${filter === 'callbacks' ? 'active' : ''}`}
                onClick={() => setFilter('callbacks')}
              >
                Follow-ups
              </button>
            </div>

            {/* Scrollable Lead List */}
            {loading ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#88a2c0', fontSize: '13px' }}>
                <p>Loading commercial pipeline...</p>
              </div>
            ) : filteredContacts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px 16px', color: '#88a2c0' }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                  <Building2 className="w-6 h-6" />
                </div>
                <div style={{ fontSize: '14px', fontWeight: 800, color: '#fff', marginBottom: '4px' }}>
                  No B2B Commercial Prospects
                </div>
                <p style={{ fontSize: '12px', color: '#88a2c0', maxWidth: 280, margin: '0 auto 16px', lineHeight: 1.5 }}>
                  This workstation is dedicated strictly to commercial plazas, facility directors, and property managers.
                </p>
                <button
                  className="phone-call-btn"
                  style={{ padding: '8px 14px', fontSize: '12px', margin: '0 auto' }}
                  onClick={() => setShowAddLeadModal(true)}
                >
                  + Add First B2B Prospect
                </button>
              </div>
            ) : (
              <div className="phone-lead-list">
                {filteredContacts.map(c => {
                  const isSelected = selectedContact?.id === c.id;
                  const isLiveCalling = isCalling && activeCallContact?.id === c.id;
                  
                  return (
                    <div
                      key={c.id}
                      className={`phone-lead-card ${isSelected ? 'selected' : ''}`}
                      onClick={() => setSelectedContact(c)}
                    >
                      <div className="phone-lead-top">
                        <div className="phone-lead-name">
                          {c.company || c.name}
                          {isLiveCalling && (
                            <span style={{ color: '#10b981', fontSize: '10px', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              <span className="phone-timer-dot" /> LIVE CALL
                            </span>
                          )}
                        </div>
                        <span className="phone-lead-type-badge badge-commercial">
                          Commercial B2B
                        </span>
                      </div>

                      <div style={{ fontSize: '12px', color: '#cbd5e1', fontWeight: 600 }}>
                        Attn: {c.name || 'Property Manager'}
                      </div>
                      <div className="phone-lead-phone">{c.phone || 'No phone'}</div>
                      <div className="phone-lead-service">
                        {c.service_type || 'Dumpster Pad Steam Sanitization'}
                      </div>

                      <div className="phone-lead-meta">
                        <span>{c.city || 'GTA'}</span>
                        <span className="phone-lead-val">${c.estimated_value || '650'}/mo</span>
                        <span className="uppercase text-[10px]">{c.status || 'New'}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Workstation Canvas & Active Calling Console */}
        <div className="phone-panel">
          
          {/* Top Panel Header: Stats + Sub-view Navigation */}
          <div style={{ padding: '16px 18px 0' }}>
            {/* Metric Strip */}
            <div className="phone-metrics-strip">
              <div className="phone-metric-item">
                <span className="phone-metric-num" style={{ color: '#fff' }}>{callStats.totalCalls}</span>
                <span className="phone-metric-label">Calls Today</span>
              </div>
              <div className="phone-metric-item">
                <span className="phone-metric-num" style={{ color: '#60a5fa' }}>{callStats.connects}</span>
                <span className="phone-metric-label">Connects</span>
              </div>
              <div className="phone-metric-item">
                <span className="phone-metric-num" style={{ color: '#10b981' }}>{callStats.sales}</span>
                <span className="phone-metric-label">Contracts Won</span>
              </div>
              <div className="phone-metric-item">
                <span className="phone-metric-num" style={{ color: '#f59e0b' }}>${callStats.revenue}</span>
                <span className="phone-metric-label">MRR Revenue</span>
              </div>
            </div>

            {/* Sub-view Nav Pills */}
            <div className="phone-subtabs">
              <button
                className={`phone-subtab-btn ${subView === 'queue' ? 'active' : ''}`}
                onClick={() => setSubView('queue')}
                title="Active Call Console"
              >
                <span>Console</span>
              </button>
              <button
                className={`phone-subtab-btn ${subView === 'dialpad' ? 'active' : ''}`}
                onClick={() => setSubView('dialpad')}
                title="Manual Keypad"
              >
                <span>Dial Pad</span>
              </button>
              <button
                className={`phone-subtab-btn ${subView === 'scripts' ? 'active' : ''}`}
                onClick={() => setSubView('scripts')}
                title="B2B Commercial Battle-Cards"
              >
                <span>B2B Scripts</span>
              </button>
              <button
                className={`phone-subtab-btn ${subView === 'logs' ? 'active' : ''}`}
                onClick={() => setSubView('logs')}
                title="Call History Logs"
              >
                <span>History</span>
              </button>
            </div>
          </div>

          <div className="phone-workstation-content">
            {/* VIEW 1: ACTIVE CALL CONSOLE & SELECTED CONTACT */}
            {subView === 'queue' && (
              <>
                {selectedContact ? (
                  <>
                    {/* Active Contact Dossier */}
                    <div className="phone-active-dossier">
                      <div className="phone-dossier-top">
                        <div>
                          <div className="phone-dossier-name">{selectedContact.company}</div>
                          <div style={{ color: '#93c5fd', fontSize: '13px', fontWeight: 600 }}>
                            Contact: {selectedContact.name}
                          </div>
                          <div style={{ color: '#60a5fa', fontWeight: 800, fontSize: '14px', marginTop: 2 }}>
                            {selectedContact.phone}
                          </div>
                        </div>

                        <div className="phone-dossier-actions">
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
                              <MessageSquare size={13} style={{ marginRight: 6 }} /> Text
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
                          <span className="phone-dossier-val">{selectedContact.service_type || 'Dumpster Steam Wash'}</span>
                        </div>
                        <div className="phone-dossier-cell">
                          <span className="phone-dossier-label">Est. Contract</span>
                          <span className="phone-dossier-val" style={{ color: '#10b981' }}>
                            ${selectedContact.estimated_value || '650'}/mo
                          </span>
                        </div>
                      </div>

                      {selectedContact.notes && (
                        <div style={{ fontSize: '11px', color: '#94a3b8', background: 'rgba(0,0,0,0.2)', padding: '6px 10px', borderRadius: '8px' }}>
                          <strong>Account Notes:</strong> {selectedContact.notes}
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
                        {isCalling && (
                          <span style={{ fontSize: '12px', color: '#8888a0' }}>
                            Timer running... Select outcome below when finished
                          </span>
                        )}
                      </div>

                      {/* Rep Live Notes */}
                      <div>
                        <textarea
                          className="phone-notes-area"
                          placeholder="Type notes from conversation... (e.g. Spoke with property manager Dan, needs quote emailed for 2 dumpster corrals, walkthrough next Tuesday)"
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
                          <button
                            className="phone-disp-btn won"
                            onClick={() => handleDisposition('SALE')}
                          >
                            WON COMMERCIAL CONTRACT ($)
                          </button>
                          
                          <button
                            className="phone-disp-btn"
                            style={{ borderColor: 'rgba(59, 130, 246, 0.4)', color: '#60a5fa' }}
                            onClick={() => handleDisposition('WALKTHROUGH')}
                          >
                            Walkthrough Booked
                          </button>

                          <button
                            className="phone-disp-btn"
                            style={{ borderColor: 'rgba(139, 92, 246, 0.4)', color: '#c084fc' }}
                            onClick={() => handleDisposition('CALLBACK')}
                          >
                            Callback Scheduled
                          </button>

                          <button
                            className="phone-disp-btn"
                            style={{ color: '#38bdf8' }}
                            onClick={() => handleDisposition('CONVO')}
                          >
                            Qualified Interest
                          </button>

                          <button
                            className="phone-disp-btn"
                            style={{ color: '#fbbf24' }}
                            onClick={() => handleDisposition('GATEKEEPER')}
                          >
                            Gatekeeper / Left Info
                          </button>

                          <button
                            className="phone-disp-btn"
                            style={{ color: '#94a3b8' }}
                            onClick={() => handleDisposition('VOICEMAIL')}
                          >
                            Left Voicemail
                          </button>

                          <button
                            className="phone-disp-btn"
                            style={{ color: '#94a3b8' }}
                            onClick={() => handleDisposition('NO_ANSWER')}
                          >
                            No Answer
                          </button>

                          <button
                            className="phone-disp-btn"
                            style={{ color: '#f87171' }}
                            onClick={() => handleDisposition('NOT_INTERESTED')}
                          >
                            Not Interested
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Quick Script & Objection Helper */}
                    <div className="phone-scripts-card">
                      <div className="phone-scripts-header">
                        <span>B2B Commercial Objection Battle-Cards</span>
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
                          <strong style={{ color: '#60a5fa' }}>Rebuttal: </strong>
                          {OBJECTION_REBUTTALS.find(r => r.title === selectedObjection)?.rebuttal}
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div style={{ textAlign: 'center', padding: '60px 20px', color: '#88a2c0' }}>
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
                      <Building2 size={36} style={{ color: '#88a2c0' }} />
                    </div>
                    <div style={{ fontSize: '16px', fontWeight: 800, color: '#fff', marginBottom: 8 }}>
                      B2B Inside Tele-Sales Console
                    </div>
                    <p style={{ fontSize: '13px', color: '#88a2c0', maxWidth: 360, margin: '0 auto 20px', lineHeight: 1.5 }}>
                      Select a commercial target on the left or add a new plaza to start cold calling, run scripts, and book property walkthroughs.
                    </p>
                    <button
                      className="phone-call-btn"
                      style={{ padding: '9px 18px', fontSize: '13px', margin: '0 auto' }}
                      onClick={() => setShowAddLeadModal(true)}
                    >
                      + Add B2B Commercial Target
                    </button>
                  </div>
                )}
              </>
            )}

            {/* VIEW 2: MANUAL DIAL PAD */}
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
                  <Phone size={15} style={{ marginRight: 8 }} /> Call B2B Number
                </button>
              </div>
            )}

            {/* VIEW 3: B2B COMMERCIAL SCRIPTS */}
            {subView === 'scripts' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'flex', gap: 8, background: '#001326', padding: 4, borderRadius: 10 }}>
                  {Object.entries(CALL_SCRIPTS).map(([key, script]) => (
                    <button
                      key={key}
                      className={`phone-subtab-btn ${selectedScriptKey === key ? 'active' : ''}`}
                      onClick={() => setSelectedScriptKey(key)}
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
                        2. Discovery & Need:
                      </span>
                      <div className="phone-script-box" style={{ borderLeftColor: '#f59e0b' }}>
                        {CALL_SCRIPTS[selectedScriptKey].discovery}
                      </div>
                    </div>

                    <div>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: '#10b981', textTransform: 'uppercase' }}>
                        3. Walkthrough Close:
                      </span>
                      <div className="phone-script-box" style={{ borderLeftColor: '#10b981' }}>
                        {CALL_SCRIPTS[selectedScriptKey].close}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* VIEW 4: CALL HISTORY */}
            {subView === 'logs' && (
              <div className="phone-scripts-card">
                <div className="phone-scripts-header">
                  <span>Today's Commercial Call Logs</span>
                </div>

                {callStats.todayCalls.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '30px 0', color: '#88a2c0', fontSize: '12px' }}>
                    No calls recorded yet today. Dial contacts to build history.
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
                            <span className="phone-lead-type-badge badge-commercial">
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

      {/* Sale Won Modal */}
      {showSaleModal && (
        <div className="phone-modal-overlay">
          <div className="phone-modal-content">
            <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#10b981', marginBottom: 8 }}>
              Commercial Contract Won!
            </h3>
            <p style={{ fontSize: '12px', color: '#88a2c0', marginBottom: 16 }}>
              Enter the monthly contract value and service scope to credit your commission and book the account.
            </p>

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: '11px', fontWeight: 700, color: '#88a2c0', display: 'block', marginBottom: 4 }}>
                Monthly Contract Value ($)
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
                Commercial Scope / Route
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
          <div className="phone-modal-content">
            <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#fff', marginBottom: 4 }}>
              Add B2B Commercial Prospect
            </h3>
            <p style={{ fontSize: '12px', color: '#88a2c0', marginBottom: 16 }}>
              Add a commercial plaza, facility, or property manager for outbound tele-sales.
            </p>

            <form onSubmit={handleAddNewLead}>
              <div style={{ marginBottom: 10 }}>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#88a2c0', display: 'block', marginBottom: 4 }}>
                  Company / Plaza Name *
                </label>
                <input
                  type="text"
                  required
                  className="phone-search-input"
                  style={{ padding: '10px 14px' }}
                  placeholder="e.g. Cambridge Professional Plaza"
                  value={newLeadCompany}
                  onChange={e => setNewLeadCompany(e.target.value)}
                />
              </div>

              <div style={{ marginBottom: 10 }}>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#88a2c0', display: 'block', marginBottom: 4 }}>
                  Decision Maker / Property Manager
                </label>
                <input
                  type="text"
                  className="phone-search-input"
                  style={{ padding: '10px 14px' }}
                  placeholder="e.g. Dan Miller (Facilities Director)"
                  value={newLeadName}
                  onChange={e => setNewLeadName(e.target.value)}
                />
              </div>

              <div style={{ marginBottom: 10 }}>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#88a2c0', display: 'block', marginBottom: 4 }}>
                  Phone Number *
                </label>
                <input
                  type="tel"
                  required
                  className="phone-search-input"
                  style={{ padding: '10px 14px' }}
                  placeholder="(519) 555-0199"
                  value={newLeadPhone}
                  onChange={e => setNewLeadPhone(e.target.value)}
                />
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
                    placeholder="Cambridge / Kitchener"
                    value={newLeadCity}
                    onChange={e => setNewLeadCity(e.target.value)}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#88a2c0', display: 'block', marginBottom: 4 }}>
                    Est. Monthly Value ($)
                  </label>
                  <input
                    type="number"
                    className="phone-search-input"
                    style={{ padding: '10px 14px' }}
                    placeholder="650"
                    value={newLeadPrice}
                    onChange={e => setNewLeadPrice(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ marginBottom: 10 }}>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#88a2c0', display: 'block', marginBottom: 4 }}>
                  Facility Type
                </label>
                <select
                  className="phone-search-input"
                  style={{ padding: '10px 14px', background: '#001326' }}
                  value={newLeadFacility}
                  onChange={e => setNewLeadFacility(e.target.value)}
                >
                  <option value="Strip Plaza / Retail Center">Strip Plaza / Retail Center</option>
                  <option value="Professional Office Building">Professional Office Building</option>
                  <option value="Medical / Dental Clinic">Medical / Dental Clinic</option>
                  <option value="Restaurant / Food Service">Restaurant / Food Service</option>
                  <option value="Industrial / Warehouse">Industrial / Warehouse</option>
                </select>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#88a2c0', display: 'block', marginBottom: 4 }}>
                  Notes & Gatekeeper Info
                </label>
                <textarea
                  className="phone-search-input"
                  style={{ padding: '8px 12px', minHeight: 60 }}
                  placeholder="Gatekeeper name, best time to call DM, 2 dumpster corrals..."
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
                  Save B2B Prospect
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
