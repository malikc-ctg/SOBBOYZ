import { useState, useEffect } from 'react';
import SalesLaunchpad from './SalesLaunchpad';
import Logger from './Logger';
import PhoneTab from './phone/PhoneTab';
import HistoryTab from './history/HistoryTab';
import MapTab from './map/MapTab';
import TeamTab from './team/TeamTab';
import './historyStyles.css';
import './salesLayout.css';
import './launchpadStyles.css';

export default function MainLayout({ user, repName, onLogout }) {
  // Active App: null (Launcher Home) | 'residential' | 'commercial' | 'phone' | 'map' | 'team'
  const [activeApp, setActiveApp] = useState(null);

  // Field Knocking sub-tab (for residential & commercial)
  const [fieldTab, setFieldTab] = useState('KNOCK');

  // App Metadata Helper
  const APP_METAS = {
    residential: { title: 'KnockLog (Residential)', badge: 'Field Canvassing', color: '#10b981', icon: '🚪' },
    commercial: { title: 'KnockLog (Commercial)', badge: 'Commercial B2B', color: '#c084fc', icon: '🏢' },
    phone: { title: 'Phone Sales OS', badge: 'Inside CRM', color: '#fb923c', icon: '📞' },
    map: { title: 'Territory Map', badge: 'Satellite GPS', color: '#22d3ee', icon: '🗺️' },
    team: { title: 'Team Hub', badge: 'Leaderboard', color: '#fbbf24', icon: '🏆' },
  };

  // If on launcher home screen, render SalesLaunchpad
  if (!activeApp) {
    return (
      <SalesLaunchpad
        repName={repName}
        user={user}
        onSelectApp={(appId) => {
          setActiveApp(appId);
          setFieldTab('KNOCK');
        }}
        onLogout={onLogout}
      />
    );
  }

  const currentMeta = APP_METAS[activeApp] || { title: 'Sales OS', badge: 'App', color: '#6366f1', icon: '⚡' };

  return (
    <div className="sales-os-root">
      {/* Global In-App Navigation Bar */}
      <header className="app-topbar">
        <div className="app-topbar-left">
          {/* Odoo-style Apps Launcher Switcher Button */}
          <button
            className="app-launcher-btn"
            onClick={() => setActiveApp(null)}
            title="Return to Sales OS App Launcher"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7"></rect>
              <rect x="14" y="3" width="7" height="7"></rect>
              <rect x="14" y="14" width="7" height="7"></rect>
              <rect x="3" y="14" width="7" height="7"></rect>
            </svg>
            <span>Apps</span>
          </button>

          <a href="/sobadmin" className="sales-admin-back" title="Return to SOB Business Dashboard">
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
            <span>SOB Admin</span>
          </a>

          <div className="app-current-indicator">
            <span>{currentMeta.icon}</span>
            <span style={{ color: '#fff', fontWeight: 800 }}>{currentMeta.title}</span>
            <span
              className="app-current-pill"
              style={{
                color: currentMeta.color,
                background: `${currentMeta.color}22`,
                border: `1px solid ${currentMeta.color}44`,
              }}
            >
              {currentMeta.badge}
            </span>
          </div>
        </div>

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
          APP 1 & 2: KNOCKLOG (RESIDENTIAL & COMMERCIAL)
          ======================================================== */}
      {(activeApp === 'residential' || activeApp === 'commercial') && (
        <div className="sales-workspace-field">
          <div className="sales-field-desktop-wrapper">
            <div style={{ paddingBottom: '70px', minHeight: 'calc(100vh - 54px)', boxSizing: 'border-box' }}>
              <div style={{ display: fieldTab === 'KNOCK' ? 'block' : 'none', height: '100%' }}>
                <Logger
                  user={user}
                  repName={repName}
                  onLogout={onLogout}
                  isActive={fieldTab === 'KNOCK'}
                  initialSalesMode={activeApp === 'commercial' ? 'commercial' : 'residential'}
                />
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
          APP 3: PHONE SALES OS (Inside Sales Workstation)
          ======================================================== */}
      {activeApp === 'phone' && (
        <div className="sales-workspace-phone">
          <PhoneTab user={user} repName={repName} isActive={activeApp === 'phone'} />
        </div>
      )}

      {/* ========================================================
          APP 4: TERRITORY MAP (Dedicated Full-Screen Map)
          ======================================================== */}
      {activeApp === 'map' && (
        <div style={{ width: '100%', height: 'calc(100vh - 54px)' }}>
          <MapTab user={user} repName={repName} isActive={activeApp === 'map'} />
        </div>
      )}

      {/* ========================================================
          APP 5: TEAM & LEADERBOARD (Dedicated Team Hub)
          ======================================================== */}
      {activeApp === 'team' && (
        <div style={{ maxWidth: 800, margin: '0 auto', width: '100%', padding: '20px 16px' }}>
          <TeamTab user={user} repName={repName} isActive={activeApp === 'team'} />
        </div>
      )}
    </div>
  );
}
