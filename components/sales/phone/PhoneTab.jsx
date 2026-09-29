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
    if (!activeCallContact) return;

    if (outcomeType === 'SALE') {
      setShowSaleModal(true);
      return;
    }

    await logCallEvent({
      contactId: activeCallContact.id,
      contactName: activeCallContact.name,
      phoneNumber: activeCallContact.phone,
      city: activeCallContact.city,
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
    if (!activeCallContact) return;

    await logCallEvent({
      contactId: activeCallContact.id,
      contactName: activeCallContact.name,
      phoneNumber: activeCallContact.phone,
      city: activeCallContact.city,
      callType: 'OUTBOUND',
      outcomeType: 'SALE',
      durationSeconds: callDuration,
      notes: callNotes,
      saleDetails: {
        job_total: saleAmount,
        service_type: saleServiceType,
        payment_method: 'Invoice / Phone Pay',
        homeowner_name: activeCallContact.name
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
      name: 'Direct Dial',
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
    <div className="phone-container">
      {/* Header */}
      <div className="phone-header">
        <div className="phone-header-title">
          <span>📞 Phone Sales OS</span>
          <span className="phone-header-badge">{repName}</span>
        </div>
        <button
          className="phone-secondary-btn"
          style={{ padding: '6px 12px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: 4 }}
          onClick={() => setShowAddLeadModal(true)}
        >
          <span>+ Add Lead</span>
        </button>
      </div>

      {/* Hero Metrics Strip */}
      <div className="phone-metrics-strip">
        <div className="phone-metric-item">
          <span className="phone-metric-num" style={{ color: '#fff' }}>{callStats.totalCalls}</span>
          <span className="phone-metric-label">Calls</span>
        </div>
        <div className="phone-metric-item">
          <span className="phone-metric-num" style={{ color: '#3b82f6' }}>{callStats.connects}</span>
          <span className="phone-metric-label">Connects</span>
        </div>
        <div className="phone-metric-item">
          <span className="phone-metric-num" style={{ color: '#10b981' }}>{callStats.sales}</span>
          <span className="phone-metric-label">Sales</span>
        </div>
        <div className="phone-metric-item">
          <span className="phone-metric-num" style={{ color: '#f59e0b' }}>${callStats.revenue}</span>
          <span className="phone-metric-label">Revenue</span>
        </div>
      </div>

      {/* Sub-Tab Navigation */}
      <div className="phone-subtabs">
        <button
          className={`phone-subtab-btn ${subView === 'queue' ? 'active' : ''}`}
          onClick={() => setSubView('queue')}
        >
          <span>⚡ Lead Queue</span>
        </button>
        <button
          className={`phone-subtab-btn ${subView === 'dialpad' ? 'active' : ''}`}
          onClick={() => setSubView('dialpad')}
        >
          <span>🔢 Dial Pad</span>
        </button>
        <button
          className={`phone-subtab-btn ${subView === 'scripts' ? 'active' : ''}`}
          onClick={() => setSubView('scripts')}
        >
          <span>📋 Scripts</span>
        </button>
        <button
          className={`phone-subtab-btn ${subView === 'logs' ? 'active' : ''}`}
          onClick={() => setSubView('logs')}
        >
          <span>📊 Call Log</span>
        </button>
      </div>

      {/* ── VIEW 1: LEAD QUEUE ── */}
      {subView === 'queue' && (
        <>
          {/* Filter Pills */}
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
              🏢 Commercial B2B
            </button>
          </div>

          {/* Search Box */}
          <div style={{ marginBottom: 12 }}>
            <input
              type="text"
              placeholder="Search name, phone number, address..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                background: 'var(--bg-card)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 10,
                padding: '10px 14px',
                color: '#fff',
                fontSize: 13,
                boxSizing: 'border-box'
              }}
            />
          </div>

          {/* Contacts List */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
              Loading tele-sales queue...
            </div>
          ) : filteredContacts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-secondary)' }}>
              <p style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>No contacts in this queue</p>
              <p style={{ fontSize: 12 }}>All follow-ups completed or adjust filters above.</p>
            </div>
          ) : (
            <div className="phone-lead-list">
              {filteredContacts.slice(0, 40).map(contact => (
                <div key={contact.contact_id} className="phone-lead-card">
                  <div className="phone-lead-top">
                    <div>
                      <div className="phone-lead-name">
                        {contact.name}
                        {contact.company && (
                          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginLeft: 6 }}>
                            ({contact.company})
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 700, marginTop: 2 }}>
                        {contact.phone}
                      </div>
                    </div>
                    <span className={`phone-lead-type-badge ${
                      contact.type === 'COMMERCIAL_WINBACK' ? 'badge-commercial' :
                      contact.type === 'PAST_CUSTOMER_WINBACK' ? 'badge-winback' : 'badge-inbound'
                    }`}>
                      {contact.type === 'COMMERCIAL_WINBACK' ? 'Commercial' :
                       contact.type === 'PAST_CUSTOMER_WINBACK' ? 'Renewal' : 'Inbound Quote'}
                    </span>
                  </div>

                  <div className="phone-lead-service">
                    {contact.service_type}
                  </div>

                  <div className="phone-lead-meta">
                    <span>📍 {contact.city}</span>
                    <span className="phone-lead-val">${contact.estimated_value}</span>
                    <span style={{ textTransform: 'capitalize' }}>Status: {contact.status}</span>
                  </div>

                  {contact.notes && (
                    <div style={{
                      fontSize: 11,
                      color: 'var(--text-muted)',
                      marginBottom: 10,
                      fontStyle: 'italic',
                      background: 'rgba(255,255,255,0.02)',
                      padding: '6px 8px',
                      borderRadius: 6,
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      lineHeight: '1.4'
                    }}>
                      {contact.notes}
                    </div>
                  )}

                  <div className="phone-lead-actions">
                    <button
                      className="phone-call-btn"
                      onClick={() => startCall(contact)}
                    >
                      <span>📞 Call Now</span>
                    </button>
                    <a
                      href={`sms:${contact.phone?.replace(/[^0-9+]/g, '')}`}
                      className="phone-secondary-btn"
                      style={{ textDecoration: 'none', display: 'flex', alignItems: 'center' }}
                    >
                      💬 Text
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── VIEW 2: NUMERIC DIAL PAD ── */}
      {subView === 'dialpad' && (
        <div className="phone-dialpad-container">
          <div className="phone-dial-display">
            <span>{dialNumber || 'Enter Phone #'}</span>
            {dialNumber && (
              <button className="phone-dial-clear" onClick={() => setDialNumber(prev => prev.slice(0, -1))}>
                ✕
              </button>
            )}
          </div>

          <div className="phone-dial-grid">
            {[
              { num: '1', letters: '' },
              { num: '2', letters: 'ABC' },
              { num: '3', letters: 'DEF' },
              { num: '4', letters: 'GHI' },
              { num: '5', letters: 'JKL' },
              { num: '6', letters: 'MNO' },
              { num: '7', letters: 'PQRS' },
              { num: '8', letters: 'TUV' },
              { num: '9', letters: 'WXYZ' },
              { num: '*', letters: '' },
              { num: '0', letters: '+' },
              { num: '#', letters: '' },
            ].map(k => (
              <button
                key={k.num}
                className="phone-dial-key"
                onClick={() => handleDialPress(k.num)}
              >
                <span className="phone-dial-num">{k.num}</span>
                {k.letters && <span className="phone-dial-letters">{k.letters}</span>}
              </button>
            ))}
          </div>

          <button
            className="phone-dial-launch"
            disabled={!dialNumber}
            onClick={launchManualDial}
          >
            📞
          </button>
        </div>
      )}

      {/* ── VIEW 3: SCRIPTS & OBJECTION KILLERS ── */}
      {subView === 'scripts' && (
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#fff', marginBottom: 12 }}>
            ⚡ Sales Battle Cards & Pitch Scripts
          </div>

          {/* Script Accordion */}
          {Object.entries(CALL_SCRIPTS).map(([k, s]) => (
            <div key={k} className="phone-script-card">
              <div className="phone-script-title">{s.title}</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 4 }}>OPPOSING / HOOK:</div>
              <div className="phone-script-box">{s.opener}</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 4 }}>DISCOVERY QUESTION:</div>
              <div className="phone-script-box">{s.discovery}</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#10b981', marginBottom: 4 }}>CLOSING PITCH:</div>
              <div className="phone-script-box" style={{ borderLeftColor: '#10b981' }}>{s.close}</div>
            </div>
          ))}

          <div style={{ fontSize: 15, fontWeight: 800, color: '#f59e0b', margin: '20px 0 12px' }}>
            🛡️ Instant Objection Handlers
          </div>

          {OBJECTION_REBUTTALS.map((r, i) => (
            <div key={i} className="phone-script-card">
              <div className="phone-rebuttal-trigger">{r.trigger}</div>
              <div className="phone-script-title">{r.title}</div>
              <div className="phone-script-box" style={{ borderLeftColor: '#f59e0b' }}>
                {r.rebuttal}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── VIEW 4: CALL LOGS ── */}
      {subView === 'logs' && (
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#fff', marginBottom: 12 }}>
            📊 Today's Call History
          </div>

          {callStats.todayCalls.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-secondary)' }}>
              <p>No phone calls logged today yet.</p>
              <p style={{ fontSize: 12, marginTop: 4 }}>Dial from the Lead Queue to build your stats!</p>
            </div>
          ) : (
            <div className="phone-lead-list">
              {callStats.todayCalls.map((c, idx) => (
                <div key={c.id || idx} className="phone-lead-card">
                  <div className="phone-lead-top">
                    <div>
                      <div className="phone-lead-name">{c.contact_name || 'Contact'}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{c.phone_number}</div>
                    </div>
                    <span
                      className="phone-lead-type-badge"
                      style={{
                        background: CALL_OUTCOMES.find(o => o.key === c.outcome_type)?.color + '22',
                        color: CALL_OUTCOMES.find(o => o.key === c.outcome_type)?.color || '#fff',
                        border: `1px solid ${CALL_OUTCOMES.find(o => o.key === c.outcome_type)?.color}55`
                      }}
                    >
                      {CALL_OUTCOMES.find(o => o.key === c.outcome_type)?.label || c.outcome_type}
                    </span>
                  </div>

                  <div className="phone-lead-meta">
                    <span>⏱️ {formatDuration(c.duration_seconds || 0)}</span>
                    <span>📍 {c.city || 'Toronto'}</span>
                    {c.sale_details?.job_total && (
                      <span className="phone-lead-val">+${c.sale_details.job_total} WON</span>
                    )}
                    <span>{new Date(c.timestamp || c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>

                  {c.notes && (
                    <div style={{ fontSize: 12, color: 'var(--text-primary)', background: 'rgba(0,0,0,0.2)', padding: '6px 8px', borderRadius: 6 }}>
                      {c.notes}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── ACTIVE CALL DISPOSITION MODAL ── */}
      {isCalling && activeCallContact && (
        <div className="phone-modal-overlay">
          <div className="phone-modal-card">
            <div className="phone-active-call-header">
              <div className="phone-active-pulse">
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', display: 'inline-block' }}></span>
                CALL IN PROGRESS
              </div>
              <div style={{ fontSize: 20, fontWeight: 900, color: '#fff' }}>
                {activeCallContact.name}
              </div>
              <div style={{ fontSize: 14, color: 'var(--accent)', fontWeight: 700, margin: '4px 0' }}>
                <a href={`tel:${activeCallContact.phone?.replace(/[^0-9+]/g, '')}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                  {activeCallContact.phone} ↗
                </a>
              </div>
              <div className="phone-timer">
                {formatDuration(callDuration)}
              </div>
            </div>

            {/* Live Notes Scratchpad */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                CALL NOTES / SCRATCHPAD
              </label>
              <textarea
                value={callNotes}
                onChange={e => setCallNotes(e.target.value)}
                placeholder="Type customer notes, questions, timing..."
                style={{
                  width: '100%',
                  height: 60,
                  background: 'var(--bg-input)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 10,
                  color: '#fff',
                  fontSize: 12,
                  padding: 8,
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {/* Quick Objection Tag Selector */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                OBJECTION NOTED (OPTIONAL)
              </label>
              <select
                value={selectedObjection}
                onChange={e => setSelectedObjection(e.target.value)}
                style={{
                  width: '100%',
                  background: 'var(--bg-input)',
                  color: '#fff',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 8,
                  padding: 8,
                  fontSize: 12
                }}
              >
                <option value="">None / Positive Discussion</option>
                <option value="Too Expensive">Too Expensive / Price</option>
                <option value="Can Do Myself">Can Do It Myself (DIY)</option>
                <option value="Send Email">Wants Email Info Only</option>
                <option value="Has Competitor">Has Another Cleaner</option>
                <option value="Spouse Check">Needs Spouse Confirmation</option>
              </select>
            </div>

            {/* One-Tap Dispositions */}
            <label style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>
              Select Call Result
            </label>

            <div className="phone-disposition-grid">
              <button
                className="phone-disp-btn btn-sale"
                onClick={() => handleDisposition('SALE')}
              >
                <span>🏆 CLOSED SALE / BOOKING</span>
                <span style={{ fontSize: 10, opacity: 0.85, fontWeight: 500 }}>Confirm job total & date</span>
              </button>

              <button
                className="phone-disp-btn"
                style={{ borderLeft: '3px solid #8b5cf6' }}
                onClick={() => {
                  const cb = prompt('Enter callback date & time (e.g. Tomorrow 2pm):');
                  if (cb) setCallbackDateTime(cb);
                  handleDisposition('CALLBACK');
                }}
              >
                <span>📅 Callback Set</span>
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Schedule follow-up</span>
              </button>

              <button
                className="phone-disp-btn"
                style={{ borderLeft: '3px solid #3b82f6' }}
                onClick={() => handleDisposition('CONVO')}
              >
                <span>🗣️ Good Convo</span>
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Qualified interest</span>
              </button>

              <button
                className="phone-disp-btn"
                style={{ borderLeft: '3px solid #f59e0b' }}
                onClick={() => handleDisposition('VOICEMAIL')}
              >
                <span>📼 Left Voicemail</span>
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Dropped pitch VM</span>
              </button>

              <button
                className="phone-disp-btn"
                style={{ borderLeft: '3px solid #6b7280' }}
                onClick={() => handleDisposition('NO_ANSWER')}
              >
                <span>📵 No Answer</span>
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Rang out</span>
              </button>

              <button
                className="phone-disp-btn"
                style={{ borderLeft: '3px solid #ef4444' }}
                onClick={() => handleDisposition('NOT_INTERESTED')}
              >
                <span>⛔ Not Interested</span>
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Declined offer</span>
              </button>

              <button
                className="phone-disp-btn"
                style={{ borderLeft: '3px solid #9ca3af' }}
                onClick={() => handleDisposition('BAD_NUMBER')}
              >
                <span>❌ Bad Number</span>
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Disconnected</span>
              </button>
            </div>

            <button
              style={{
                width: '100%',
                padding: '10px',
                background: 'transparent',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 10,
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: 12
              }}
              onClick={() => {
                setIsCalling(false);
                setActiveCallContact(null);
              }}
            >
              Cancel / Dismiss
            </button>
          </div>
        </div>
      )}

      {/* ── SALE MODAL ── */}
      {showSaleModal && (
        <div className="phone-modal-overlay">
          <div className="phone-modal-card" style={{ maxWidth: 420 }}>
            <h3 style={{ fontSize: 18, fontWeight: 900, color: '#10b981', marginBottom: 6 }}>
              🏆 Record Closed Sale
            </h3>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 16 }}>
              Won deal for {activeCallContact?.name} over the phone!
            </p>

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                JOB TOTAL ($)
              </label>
              <input
                type="number"
                value={saleAmount}
                onChange={e => setSaleAmount(e.target.value)}
                style={{
                  width: '100%',
                  background: 'var(--bg-input)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 8,
                  padding: 10,
                  color: '#fff',
                  fontSize: 16,
                  fontWeight: 800,
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                SERVICE PACKAGE
              </label>
              <select
                value={saleServiceType}
                onChange={e => setSaleServiceType(e.target.value)}
                style={{
                  width: '100%',
                  background: 'var(--bg-input)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 8,
                  padding: 10,
                  color: '#fff',
                  fontSize: 12
                }}
              >
                <option value="Seasonal Can Sanitizing & Deep Clean">Seasonal Can Sanitizing (2 Bins)</option>
                <option value="Yearly Clean Route (Monthly)">Yearly Clean Route (Monthly VIP)</option>
                <option value="Exterior Power Washing Bundle">Exterior Power Washing Bundle</option>
                <option value="Commercial Dumpster Pad Sanitizing">Commercial Dumpster Pad Sanitizing</option>
                <option value="Commercial Office Cleaning">Commercial Office Cleaning</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="phone-call-btn"
                style={{ flex: 1 }}
                onClick={confirmSale}
              >
                Log Phone Sale
              </button>
              <button
                className="phone-secondary-btn"
                onClick={() => setShowSaleModal(false)}
              >
                Back
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── ADD NEW LEAD MODAL ── */}
      {showAddLeadModal && (
        <div className="phone-modal-overlay">
          <div className="phone-modal-card" style={{ maxWidth: 420 }}>
            <h3 style={{ fontSize: 18, fontWeight: 900, color: '#fff', marginBottom: 6 }}>
              + Add Phone Sales Prospect
            </h3>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 16 }}>
              Quickly create a contact to dial immediately.
            </p>

            <form onSubmit={handleAddNewLead}>
              <div style={{ marginBottom: 10 }}>
                <input
                  type="text"
                  placeholder="Contact Name *"
                  required
                  value={newLeadName}
                  onChange={e => setNewLeadName(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'var(--bg-input)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 8,
                    padding: 10,
                    color: '#fff',
                    fontSize: 13,
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ marginBottom: 10 }}>
                <input
                  type="tel"
                  placeholder="Phone Number *"
                  required
                  value={newLeadPhone}
                  onChange={e => setNewLeadPhone(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'var(--bg-input)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 8,
                    padding: 10,
                    color: '#fff',
                    fontSize: 13,
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                <input
                  type="text"
                  placeholder="City / Area"
                  value={newLeadCity}
                  onChange={e => setNewLeadCity(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'var(--bg-input)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 8,
                    padding: 10,
                    color: '#fff',
                    fontSize: 13,
                    boxSizing: 'border-box'
                  }}
                />
                <input
                  type="text"
                  placeholder="Company (optional)"
                  value={newLeadCompany}
                  onChange={e => setNewLeadCompany(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'var(--bg-input)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 8,
                    padding: 10,
                    color: '#fff',
                    fontSize: 13,
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px', gap: 8, marginBottom: 16 }}>
                <select
                  value={newLeadService}
                  onChange={e => setNewLeadService(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'var(--bg-input)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 8,
                    padding: 10,
                    color: '#fff',
                    fontSize: 12
                  }}
                >
                  <option value="standard_clean">Standard Can Sanitizing</option>
                  <option value="deep_clean">Deep Clean & Wash</option>
                  <option value="commercial">Commercial Sanitation</option>
                </select>

                <input
                  type="number"
                  placeholder="Price ($)"
                  value={newLeadPrice}
                  onChange={e => setNewLeadPrice(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'var(--bg-input)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 8,
                    padding: 10,
                    color: '#fff',
                    fontSize: 13,
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="submit"
                  className="phone-call-btn"
                  style={{ flex: 1 }}
                >
                  Save & Add
                </button>
                <button
                  type="button"
                  className="phone-secondary-btn"
                  onClick={() => setShowAddLeadModal(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
