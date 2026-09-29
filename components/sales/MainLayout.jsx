import { useState } from 'react';
import Logger from './Logger';
import PhoneTab from './phone/PhoneTab';
import HistoryTab from './history/HistoryTab';
import MapTab from './map/MapTab';
import TeamTab from './team/TeamTab';
import './historyStyles.css';

export default function MainLayout({ user, repName, onLogout }) {
  const [activeTab, setActiveTab] = useState('KNOCK');

  return (
    <div className="app-layout">
      <div className="app-content" style={{ paddingBottom: activeTab === 'MAP' || activeTab === 'TEAM' ? '64px' : '70px', minHeight: '100vh', boxSizing: 'border-box' }}>
        <div style={{ display: activeTab === 'KNOCK' ? 'block' : 'none', height: '100%' }}>
          <Logger user={user} repName={repName} onLogout={onLogout} isActive={activeTab === 'KNOCK'} />
        </div>
        <div style={{ display: activeTab === 'PHONE' ? 'block' : 'none', height: '100%' }}>
          <PhoneTab user={user} repName={repName} isActive={activeTab === 'PHONE'} />
        </div>
        <div style={{ display: activeTab === 'MAP' ? 'block' : 'none', height: '100%', width: '100%' }}>
          <MapTab user={user} repName={repName} isActive={activeTab === 'MAP'} />
        </div>
        <div style={{ display: activeTab === 'TEAM' ? 'block' : 'none', height: '100%', width: '100%' }}>
          <TeamTab user={user} repName={repName} isActive={activeTab === 'TEAM'} />
        </div>
        <div style={{ display: activeTab === 'HISTORY' ? 'block' : 'none', height: '100%' }}>
          <HistoryTab user={user} repName={repName} isActive={activeTab === 'HISTORY'} />
        </div>
      </div>

      <nav className="bottom-nav">
        {/* Knock */}
        <button
          id="nav-knock"
          className={`nav-btn ${activeTab === 'KNOCK' ? 'active' : ''}`}
          onClick={() => setActiveTab('KNOCK')}
        >
          <div className="nav-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
              <circle cx="12" cy="10" r="3"></circle>
            </svg>
          </div>
          <span>Knock</span>
        </button>

        {/* Phone Sales */}
        <button
          id="nav-phone"
          className={`nav-btn ${activeTab === 'PHONE' ? 'active' : ''}`}
          onClick={() => setActiveTab('PHONE')}
        >
          <div className="nav-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
            </svg>
          </div>
          <span>Phone</span>
        </button>

        {/* Map */}
        <button
          id="nav-map"
          className={`nav-btn ${activeTab === 'MAP' ? 'active' : ''}`}
          onClick={() => setActiveTab('MAP')}
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

        {/* Team Hub */}
        <button
          id="nav-team"
          className={`nav-btn ${activeTab === 'TEAM' ? 'active' : ''}`}
          onClick={() => setActiveTab('TEAM')}
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

        {/* History */}
        <button
          id="nav-history"
          className={`nav-btn ${activeTab === 'HISTORY' ? 'active' : ''}`}
          onClick={() => setActiveTab('HISTORY')}
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
  );
}
