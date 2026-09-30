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
import './phoneStyles.css';

export default function PhoneTab({ user, repName, isActive }) {
  // Navigation & Sub-views
  const [subView, setSubView] = useState('queue'); // 'queue' | 'dialpad' | 'scripts' | 'logs'
  const [filter, setFilter] = useState('all'); // 'all' | 'hot' | 'past_customers' | 'commercial'
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
  const [selectedScriptKey, setSelectedScriptKey] = useState('RESIDENTIAL_INBOUND');
  const [callbackDateTime, setCallbackDateTime] = useState('');
  const [showSaleModal, setShowSaleModal] = useState(false);
  const [saleAmount, setSaleAmount] = useState('220');
  const [saleServiceType, setSaleServiceType] = useState('Seasonal Can Sanitizing & Deep Clean');
  const [showAddLeadModal, setShowAddLeadModal] = useState(false);

  // New Lead Form State
  const [newLeadName, setNewLeadName] = useState('');
  const [newLeadPhone, setNewLeadPhone] = useState('');
  const [newLeadCity, setNewLeadCity] = useState('');
  const [newLeadCompany, setNewLeadCompany] = useState('');
  const [newLeadService, setNewLeadService] = useState('standard_clean');
  const [newLeadPrice, setNewLeadPrice] = useState('220');

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
      }
    } catch (e) {
      console.error('[PhoneTab] Error loading contacts:', e);
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
    setSaleAmount(contact.estimated_value ? String(contact.estimated_value) : '220');
    setSaleServiceType(contact.service_type || 'Seasonal Can Sanitizing & Deep Clean');

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
        payment_method: 'Invoice / Phone Pay',
        homeowner_name: contactToLog.name
      },
      repId: user?.id || '07853cdf-ed2c-4f3b-b713-cde7c40e20a1',
      repName: repName || 'Malik',
    });

    setShowSaleModal(false);
    setIsCalling(false);
    setActiveCallContact(null);
    refreshStats();
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
      name: 'Direct Outbound Call',
      phone: dialNumber,
      city: 'Toronto',
      service_type: 'Inquiry / Direct Call',
      estimated_value: 220
    };
    startCall(manualContact);
  }

  // Add new lead form submission
  async function handleAddNewLead(e) {
    e.preventDefault();
    if (!newLeadPhone) return;

    const res = await createNewPhoneLead({
      customer_name: newLeadName || 'Direct Prospect',
      customer_phone: newLeadPhone,
      city: newLeadCity || 'Toronto',
      company_name: newLeadCompany || null,
      service_type: newLeadService,
      quoted_price: newLeadPrice
    });

    if (res?.success) {
      setShowAddLeadModal(false);
      setNewLeadName('');
      setNewLeadPhone('');
      setNewLeadCity('');
      setNewLeadCompany('');
      loadContacts();
    }
  }

  // Filtered contacts based on search
  const filteredContacts = contacts.filter(c => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (c.name || '').toLowerCase().includes(q) ||
      (c.phone || '').includes(q) ||
      (c.city || '').toLowerCase().includes(q) ||
      (c.company || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="phone-workspace-root">
      {/* 2-Column Workstation Grid */}
      <div className="phone-grid-layout">
        
        {/* LEFT COLUMN: Lead Pipeline & Queue */}
        <div className="phone-panel">
          <div className="phone-panel-header">
            <div className="phone-panel-title">
              <span>⚡ Lead Pipeline</span>
              <span className="phone-badge">{loading ? 'Loading...' : `${contacts.length} Leads`}</span>
            </div>
            <button
              className="phone-subtab-btn active"
              style={{ padding: '4px 10px', fontSize: '11px', flex: 'none' }}
              onClick={() => setShowAddLeadModal(true)}
            >
              + Add Lead
            </button>
          </div>

          <div style={{ padding: '14px 16px' }}>
            {/* Search Box */}
            <div className="phone-search-box">
              <span className="phone-search-icon">🔍</span>
              <input
                type="text"
                className="phone-search-input"
                placeholder="Search name, phone, city..."
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
                All Leads ({contacts.length})
              </button>
              <button
                className={`phone-filter-pill ${filter === 'hot' ? 'active' : ''}`}
                onClick={() => setFilter('hot')}
              >
                🔥 Hot Inbound
              </button>
              <button
                className={`phone-filter-pill ${filter === 'past_customers' ? 'active' : ''}`}
                onClick={() => setFilter('past_customers')}
              >
                🔄 Past Customers
              </button>
              <button
                className={`phone-filter-pill ${filter === 'commercial' ? 'active' : ''}`}
                onClick={() => setFilter('commercial')}
              >
                🏢 Commercial
              </button>
            </div>

            {/* Scrollable Lead List */}
            {loading ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#8888a0', fontSize: '13px' }}>
                <p>Loading sales contacts...</p>
              </div>
            ) : filteredContacts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#8888a0', fontSize: '13px' }}>
                <p>No leads found matching query.</p>
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
                          {c.name}
                          {isLiveCalling && (
                            <span style={{ color: '#10b981', fontSize: '10px', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              <span className="phone-timer-dot" /> CALLING
                            </span>
                          )}
                        </div>
                        <span className={`phone-lead-type-badge ${
                          c.type === 'COMMERCIAL' ? 'badge-commercial' :
                          c.type === 'PAST_CUSTOMER' ? 'badge-winback' : 'badge-inbound'
                        }`}>
                          {c.type === 'COMMERCIAL' ? 'Commercial' :
                           c.type === 'PAST_CUSTOMER' ? 'Customer' : 'Inbound'}
                        </span>
                      </div>

                      <div className="phone-lead-phone">{c.phone || 'No phone'}</div>
                      <div className="phone-lead-service">
                        {c.service_type || 'Cleaning Inquiry'}
                      </div>

                      <div className="phone-lead-meta">
                        <span>📍 {c.city || 'GTA'}</span>
                        <span className="phone-lead-val">${c.estimated_value || '220'}</span>
                        <span>{c.status || 'New'}</span>
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
                <span className="phone-metric-label">Sales Won</span>
              </div>
              <div className="phone-metric-item">
                <span className="phone-metric-num" style={{ color: '#f59e0b' }}>${callStats.revenue}</span>
                <span className="phone-metric-label">Revenue</span>
              </div>
            </div>

            {/* Sub-view Nav Pills */}
            <div className="phone-subtabs">
              <button
                className={`phone-subtab-btn ${subView === 'queue' ? 'active' : ''}`}
                onClick={() => setSubView('queue')}
                title="Active Call Console"
              >
                <span>⚡ Console</span>
              </button>
              <button
                className={`phone-subtab-btn ${subView === 'dialpad' ? 'active' : ''}`}
                onClick={() => setSubView('dialpad')}
                title="Dial Pad"
              >
                <span>🔢 Dial Pad</span>
              </button>
              <button
                className={`phone-subtab-btn ${subView === 'scripts' ? 'active' : ''}`}
                onClick={() => setSubView('scripts')}
                title="Sales Scripts & Rebuttals"
              >
                <span>📋 Scripts</span>
              </button>
              <button
                className={`phone-subtab-btn ${subView === 'logs' ? 'active' : ''}`}
                onClick={() => setSubView('logs')}
                title="Call History Logs"
              >
                <span>📊 History</span>
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
                          <div className="phone-dossier-name">{selectedContact.name}</div>
                          <div style={{ color: '#818cf8', fontWeight: 700, fontSize: '14px', marginTop: 2 }}>
                            {selectedContact.phone}
                          </div>
                        </div>

                        <div className="phone-dossier-actions">
                          <button
                            className="phone-call-btn"
                            onClick={() => startCall(selectedContact)}
                          >
                            📞 Call Now
                          </button>
                          {selectedContact.phone && (
                            <a
                              href={`sms:${selectedContact.phone.replace(/[^0-9+]/g, '')}`}
                              className="phone-text-btn"
                            >
                              💬 Text
                            </a>
                          )}
                        </div>
                      </div>

                      {/* Detail Matrix */}
                      <div className="phone-dossier-grid">
                        <div className="phone-dossier-cell">
                          <span className="phone-dossier-label">City / Territory</span>
                          <span className="phone-dossier-val">📍 {selectedContact.city || 'Toronto'}</span>
                        </div>
                        <div className="phone-dossier-cell">
                          <span className="phone-dossier-label">Quoted Service</span>
                          <span className="phone-dossier-val">{selectedContact.service_type || 'Cleaning'}</span>
                        </div>
                        <div className="phone-dossier-cell">
                          <span className="phone-dossier-label">Est. Value</span>
                          <span className="phone-dossier-val" style={{ color: '#10b981' }}>
                            ${selectedContact.estimated_value || '220'}
                          </span>
                        </div>
                      </div>

                      {selectedContact.address && (
                        <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                          🏠 <strong>Property:</strong> {selectedContact.address}
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
                          placeholder="Type notes from conversation... (e.g. Needs quote emailed, dog in backyard, spouse decides Friday)"
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
                            🏆 WON / BOOKED SALE ($)
                          </button>
                          
                          <button
                            className="phone-disp-btn"
                            style={{ borderColor: 'rgba(59, 130, 246, 0.4)', color: '#60a5fa' }}
                            onClick={() => handleDisposition('CALLBACK')}
                          >
                            📅 Callback Set
                          </button>

                          <button
                            className="phone-disp-btn"
                            style={{ borderColor: 'rgba(99, 102, 241, 0.4)', color: '#c7d2fe' }}
                            onClick={() => handleDisposition('GOOD_CONVO')}
                          >
                            🗣️ Good Convo
                          </button>

                          <button
                            className="phone-disp-btn"
                            style={{ color: '#94a3b8' }}
                            onClick={() => handleDisposition('LEFT_VOICEMAIL')}
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

                    {/* Quick Script & Objection Helper */}
                    <div className="phone-scripts-card">
                      <div className="phone-scripts-header">
                        <span>🛡️ Objection Battle-Cards (Quick Rebuttals)</span>
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                        {OBJECTION_REBUTTALS.map(obj => (
                          <button
                            key={obj.title}
                            type="button"
                            className={`phone-filter-pill ${selectedObjection === obj.title ? 'active' : ''}`}
                            onClick={() => setSelectedObjection(selectedObjection === obj.title ? '' : obj.title)}
                          >
                            "{obj.title}"
                          </button>
                        ))}
                      </div>

                      {selectedObjection && (
                        <div className="phone-script-box">
                          {(() => {
                            const found = OBJECTION_REBUTTALS.find(o => o.title === selectedObjection);
                            if (!found) return null;
                            return (
                              <>
                                <div style={{ color: '#fbbf24', fontWeight: 800 }}>When they say: {found.trigger}</div>
                                <div style={{ marginTop: 6, color: '#f3f4f6', lineHeight: 1.5 }}>{found.rebuttal}</div>
                              </>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div style={{ textAlign: 'center', padding: '60px 20px', color: '#8888a0' }}>
                    <p style={{ fontSize: '16px', fontWeight: 700, color: '#fff' }}>No Lead Selected</p>
                    <p style={{ fontSize: '13px', marginTop: 6 }}>Select any contact from the Lead Pipeline on the left to start calling.</p>
                  </div>
                )}
              </>
            )}

            {/* VIEW 2: MANUAL DIAL PAD */}
            {subView === 'dialpad' && (
              <div className="phone-dialpad-container">
                <div className="phone-dial-display">
                  <span>{dialNumber || '___-___-____'}</span>
                  {dialNumber && (
                    <button className="phone-dial-clear" onClick={() => setDialNumber('')}>
                      ✕
                    </button>
                  )}
                </div>

                <div className="phone-keypad-grid">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].map(k => (
                    <button key={k} className="phone-key-btn" onClick={() => handleDialPress(k)}>
                      <span className="phone-key-num">{k}</span>
                    </button>
                  ))}
                </div>

                <button
                  className="phone-call-btn"
                  style={{ width: '100%', padding: '14px', fontSize: '16px' }}
                  onClick={launchManualDial}
                >
                  📞 Call {dialNumber || 'Number'}
                </button>
              </div>
            )}

            {/* VIEW 3: FULL SCRIPTS & BATTLE CARDS */}
            {subView === 'scripts' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  {Object.keys(CALL_SCRIPTS).map(scriptKey => (
                    <button
                      key={scriptKey}
                      className={`phone-filter-pill ${selectedScriptKey === scriptKey ? 'active' : ''}`}
                      onClick={() => setSelectedScriptKey(scriptKey)}
                    >
                      {scriptKey.replace('_', ' ')}
                    </button>
                  ))}
                </div>

                <div className="phone-active-dossier">
                  <div style={{ fontSize: '16px', fontWeight: 800, color: '#fff', marginBottom: 6 }}>
                    {CALL_SCRIPTS[selectedScriptKey]?.title}
                  </div>
                  
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#818cf8', textTransform: 'uppercase' }}>1. The Opener</div>
                    <div className="phone-script-box" style={{ background: '#121221', marginTop: 4 }}>
                      <p style={{ lineHeight: 1.5 }}>{CALL_SCRIPTS[selectedScriptKey]?.opener}</p>
                    </div>
                  </div>

                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#60a5fa', textTransform: 'uppercase' }}>2. Discovery Question</div>
                    <div className="phone-script-box" style={{ background: '#121221', marginTop: 4 }}>
                      <p style={{ lineHeight: 1.5 }}>{CALL_SCRIPTS[selectedScriptKey]?.discovery}</p>
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#10b981', textTransform: 'uppercase' }}>3. Closing Hook</div>
                    <div className="phone-script-box" style={{ background: '#121221', marginTop: 4 }}>
                      <p style={{ lineHeight: 1.5 }}>{CALL_SCRIPTS[selectedScriptKey]?.close}</p>
                    </div>
                  </div>
                </div>

                <div className="phone-active-dossier">
                  <div style={{ fontSize: '15px', fontWeight: 800, color: '#fff', marginBottom: 10 }}>
                    All Objection Battle Cards
                  </div>
                  {OBJECTION_REBUTTALS.map(obj => (
                    <div key={obj.title} style={{ marginBottom: 14 }}>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: '#fbbf24' }}>
                        Customer says: {obj.trigger}
                      </div>
                      <div className="phone-script-box" style={{ marginTop: 4 }}>
                        {obj.rebuttal}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* VIEW 4: CALL ACTIVITY LOG */}
            {subView === 'logs' && (
              <div style={{ overflowX: 'auto' }}>
                <table className="phone-logs-table">
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Prospect</th>
                      <th>Phone</th>
                      <th>Duration</th>
                      <th>Outcome</th>
                      <th>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {callStats.todayCalls && callStats.todayCalls.length > 0 ? (
                      callStats.todayCalls.map((c, i) => (
                        <tr key={i}>
                          <td>{new Date(c.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                          <td style={{ fontWeight: 700, color: '#fff' }}>{c.contact_name || 'Outbound'}</td>
                          <td style={{ color: '#818cf8' }}>{c.phone_number}</td>
                          <td>{formatDuration(c.duration_seconds || 0)}</td>
                          <td>
                            <span style={{
                              fontWeight: 700,
                              color: c.outcome_type === 'SALE' ? '#10b981' :
                                     c.outcome_type === 'GOOD_CONVO' ? '#60a5fa' :
                                     c.outcome_type === 'CALLBACK' ? '#fbbf24' : '#94a3b8'
                            }}>
                              {c.outcome_type}
                            </span>
                          </td>
                          <td style={{ color: '#94a3b8', fontSize: '11px' }}>{c.notes || '—'}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} style={{ textAlign: 'center', color: '#8888a0', padding: '30px 0' }}>
                          No calls logged yet today.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Sale Won Confirmation Modal */}
      {showSaleModal && (
        <div className="phone-modal-overlay">
          <div className="phone-modal-content">
            <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#10b981', marginBottom: 12 }}>
              🎉 Record Closed Sale!
            </h3>
            <p style={{ fontSize: '13px', color: '#94a3b8', marginBottom: 16 }}>
              Log the job total and service package to credit your commission and update the lead.
            </p>

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: '11px', fontWeight: 700, color: '#8888a0', display: 'block', marginBottom: 4 }}>
                Job Total ($)
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
              <label style={{ fontSize: '11px', fontWeight: 700, color: '#8888a0', display: 'block', marginBottom: 4 }}>
                Service Type
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
                Confirm Sale ($)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Add Lead Modal */}
      {showAddLeadModal && (
        <div className="phone-modal-overlay">
          <div className="phone-modal-content">
            <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#fff', marginBottom: 12 }}>
              + Add Sales Prospect
            </h3>

            <form onSubmit={handleAddNewLead}>
              <div style={{ marginBottom: 10 }}>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#8888a0', display: 'block', marginBottom: 4 }}>
                  Contact Name
                </label>
                <input
                  type="text"
                  className="phone-search-input"
                  style={{ padding: '10px 14px' }}
                  placeholder="e.g. John Smith"
                  value={newLeadName}
                  onChange={e => setNewLeadName(e.target.value)}
                />
              </div>

              <div style={{ marginBottom: 10 }}>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#8888a0', display: 'block', marginBottom: 4 }}>
                  Phone Number *
                </label>
                <input
                  type="tel"
                  required
                  className="phone-search-input"
                  style={{ padding: '10px 14px' }}
                  placeholder="(416) 555-0192"
                  value={newLeadPhone}
                  onChange={e => setNewLeadPhone(e.target.value)}
                />
              </div>

              <div style={{ marginBottom: 10 }}>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#8888a0', display: 'block', marginBottom: 4 }}>
                  City / Location
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

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
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
