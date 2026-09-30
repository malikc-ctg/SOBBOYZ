import { useState, useEffect } from 'react';
import Logger from './Logger';
import PhoneTab from './phone/PhoneTab';
import HistoryTab from './history/HistoryTab';
import MapTab from './map/MapTab';
import TeamTab from './team/TeamTab';
import './historyStyles.css';
import './salesLayout.css';

export default function MainLayout({ user, repName, onLogout }) {
  // Primary Workspace Mode: 'FIELD' (KnockLog) vs 'PHONE' (Tele-sales)
  const [salesMode, setSalesMode] = useState('FIELD');

  // Sub-tabs within Field Knocking Mode
  const [fieldTab, setFieldTab] = useState('KNOCK');

  useEffect(() => {
    try {
      const savedMode = localStorage.getItem('sob_sales_mode');
      if (savedMode === 'FIELD' || savedMode === 'PHONE') {
        setSalesMode(savedMode);
      }
    } catch (e) {}
  }, []);

  function handleSwitchMode(newMode) {
    setSalesMode(newMode);
    try {
      localStorage.setItem('sob_sales_mode', newMode);
    } catch (e) {}
  }

  return (
    <div className="sales-os-root">
      {/* Universal Fixed Top Navigation Bar */}
      <header className="sales-topbar">
        {/* Left: Return to SOB Admin + Brand */}
        <div className="sales-topbar-left">
          <a href="/sobadmin" className="sales-admin-back" title="Return to SOB Business Dashboard">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
            <span>SOB Admin</span>
          </a>

          <div className="sales-brand-badge">
            <span>Sales OS</span>
          </div>
        </div>

        {/* Center: Primary Workspace Switcher */}
        <div className="sales-mode-switcher">
          <button
            className={`sales-mode-btn ${salesMode === 'FIELD' ? 'active' : ''}`}
            onClick={() => handleSwitchMode('FIELD')}
          >
            <span>🚪 Field Knocking</span>
          </button>
          <button
            className={`sales-mode-btn ${salesMode === 'PHONE' ? 'active' : ''}`}
            onClick={() => handleSwitchMode('PHONE')}
          >
            <span>📞 Phone Sales</span>
          </button>
        </div>

        {/* Right: Rep Pill + Sign Out */}
        <div className="sales-topbar-right">
          <div className="sales-rep-pill">
            <span className="sales-rep-dot" />
            <span>{repName || 'Malik'}</span>
          </div>
          <button className="sales-logout-btn" onClick={onLogout} title="Sign Out">
            Sign Out
          </button>
        </div>
      </header>

      {/* ========================================================
          MODE 1: FIELD KNOCKING (Pure KnockLog Experience)
          ======================================================== */}
      {salesMode === 'FIELD' && (
        <div className="sales-workspace-field">
          <div className="sales-field-desktop-wrapper">
            <div style={{ paddingBottom: '70px', minHeight: 'calc(100vh - 56px)', boxSizing: 'border-box' }}>
              <div style={{ display: fieldTab === 'KNOCK' ? 'block' : 'none', height: '100%' }}>
                <Logger user={user} repName={repName} onLogout={onLogout} isActive={fieldTab === 'KNOCK'} />
              </div>
              <div style={{ display: fieldTab === 'MAP' ? 'block' : 'none', height: '100%', width: '100%' }}>
                <MapTab user={user} repName={repName} isActive={fieldTab === 'MAP'} />
              </div>
              <div style={{ display: fieldTab === 'TEAM' ? 'block' : 'none', height: '100%', width: '100%' }}>
                <TeamTab user={user} repName={repName} isActive={fieldTab === 'TEAM'} />
              </div>
              <div style={{ display: fieldTab === 'HISTORY' ? 'block' : 'none', height: '100%' }}>
                <HistoryTab user={user} repName={repName} isActive={fieldTab === 'HISTORY'} />
              </div>
            </div>

            {/* Original 4-Tab KnockLog Bottom Nav */}
            <nav className="bottom-nav">
              <button
                id="nav-knock"
                className={`nav-btn ${fieldTab === 'KNOCK' ? 'active' : ''}`}
                onClick={() => setFieldTab('KNOCK')}
              >
                <div className="nav-icon">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                    <circle cx="12" cy="10" r="3"></circle>
                  </svg>
                </div>
                <span>Knock</span>
              </button>

              <button
                id="nav-map"
                className={`nav-btn ${fieldTab === 'MAP' ? 'active' : ''}`}
                onClick={() => setFieldTab('MAP')}
              >
                <div className="nav-icon">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"></polygon>
                    <line x1="8" y1="2" x2="8" y2="18"></line>
                    <line x1="16" y1="6" x2="16" y2="22"></line>
                  </svg>
                </div>
                <span>Map</span>
              </button>

              <button
                id="nav-team"
                className={`nav-btn ${fieldTab === 'TEAM' ? 'active' : ''}`}
                onClick={() => setFieldTab('TEAM')}
              >
                <div className="nav-icon">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                    <circle cx="9" cy="7" r="4"></circle>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                  </svg>
                </div>
                <span>Team</span>
              </button>

              <button
                id="nav-history"
                className={`nav-btn ${fieldTab === 'HISTORY' ? 'active' : ''}`}
                onClick={() => setFieldTab('HISTORY')}
              >
                <div className="nav-icon">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
                    <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
                    <path d="M12 11h4"></path>
                    <path d="M12 16h4"></path>
                    <path d="M8 11h.01"></path>
                    <path d="M8 16h.01"></path>
                  </svg>
                </div>
                <span>History</span>
              </button>
            </nav>
          </div>
        </div>
      )}

      {/* ========================================================
          MODE 2: PHONE SALES (Inside Sales CRM Workstation)
          ======================================================== */}
      {salesMode === 'PHONE' && (
        <div className="sales-workspace-phone">
          <PhoneTab user={user} repName={repName} isActive={salesMode === 'PHONE'} />
        </div>
      )}
    </div>
  );
}
