import React from 'react';
import './launchpadStyles.css';

export default function SalesLaunchpad({ repName, user, onSelectApp, onLogout }) {
  const APPS = [
    {
      id: 'residential',
      title: 'KnockLog (Residential)',
      badge: 'Field Canvassing',
      badgeColor: '#10b981',
      badgeBg: 'rgba(16, 185, 129, 0.15)',
      cardGlow: 'rgba(16, 185, 129, 0.35)',
      iconBg: 'linear-gradient(135deg, #10b981, #059669)',
      desc: 'Door-to-door residential canvassing, street house # stepper, soft-wash & bin pitch.',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
          <polyline points="9 22 9 12 15 12 15 22"></polyline>
        </svg>
      )
    },
    {
      id: 'commercial',
      title: 'KnockLog (Commercial)',
      badge: 'Commercial B2B',
      badgeColor: '#c084fc',
      badgeBg: 'rgba(192, 132, 252, 0.15)',
      cardGlow: 'rgba(139, 92, 246, 0.35)',
      iconBg: 'linear-gradient(135deg, #8b5cf6, #6d28d9)',
      desc: 'Business & plaza canvassing, facility types, company contacts, and gatekeeper tracking.',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="4" y="2" width="16" height="20" rx="2" ry="2"></rect>
          <line x1="9" y1="22" x2="9" y2="22.01"></line>
          <line x1="15" y1="22" x2="15" y2="22.01"></line>
          <line x1="8" y1="6" x2="8.01" y2="6"></line>
          <line x1="16" y1="6" x2="16.01" y2="6"></line>
          <line x1="8" y1="10" x2="8.01" y2="10"></line>
          <line x1="16" y1="10" x2="16.01" y2="10"></line>
          <line x1="8" y1="14" x2="8.01" y2="14"></line>
          <line x1="16" y1="14" x2="16.01" y2="14"></line>
          <line x1="8" y1="18" x2="8.01" y2="18"></line>
          <line x1="16" y1="18" x2="16.01" y2="18"></line>
        </svg>
      )
    },
    {
      id: 'phone',
      title: 'Phone Sales OS',
      badge: 'Inside Sales CRM',
      badgeColor: '#fb923c',
      badgeBg: 'rgba(251, 146, 60, 0.15)',
      cardGlow: 'rgba(249, 115, 22, 0.35)',
      iconBg: 'linear-gradient(135deg, #f97316, #ea580c)',
      desc: '122 lead queue, click-to-call dialer, script teleprompter, and objection battle-cards.',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
        </svg>
      )
    },
    {
      id: 'map',
      title: 'Territory Map',
      badge: 'Satellite GPS',
      badgeColor: '#22d3ee',
      badgeBg: 'rgba(34, 211, 238, 0.15)',
      cardGlow: 'rgba(6, 182, 212, 0.35)',
      iconBg: 'linear-gradient(135deg, #06b6d4, #0891b2)',
      desc: 'Full-screen satellite territory map, pinned doors, heatmaps & route coverage.',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"></polygon>
          <line x1="8" y1="2" x2="8" y2="18"></line>
          <line x1="16" y1="6" x2="16" y2="22"></line>
        </svg>
      )
    },
    {
      id: 'team',
      title: 'Team & Leaderboard',
      badge: 'Rep Rankings',
      badgeColor: '#fbbf24',
      badgeBg: 'rgba(251, 191, 36, 0.15)',
      cardGlow: 'rgba(245, 158, 11, 0.35)',
      iconBg: 'linear-gradient(135deg, #f59e0b, #d97706)',
      desc: 'Real-time sales leaderboard, field knocking rankings, and commission totals.',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path>
          <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path>
          <path d="M4 22h16"></path>
          <path d="M10 14.66V17c0 .55-.45 1-1 1H7v4h10v-4h-2c-.55 0-1-.45-1-1v-2.34"></path>
          <path d="M18 2H6v7a6 6 0 0 0 12 0V2z"></path>
        </svg>
      )
    },
    {
      id: 'admin',
      title: 'SOB Admin Portal',
      badge: 'Operations Hub',
      badgeColor: '#818cf8',
      badgeBg: 'rgba(129, 140, 248, 0.15)',
      cardGlow: 'rgba(99, 102, 241, 0.35)',
      iconBg: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
      desc: 'Operations command, cleaner dispatch, jobs schedule, equipment, and finance.',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
        </svg>
      ),
      isExternal: true,
      href: '/sobadmin'
    }
  ];

  return (
    <div className="launchpad-root">
      {/* Top Bar */}
      <header className="launchpad-topbar">
        <div className="launchpad-topbar-left">
          <a href="/sobadmin" className="launchpad-admin-link">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
            <span>SOB Admin</span>
          </a>

          <div className="launchpad-brand">
            <span>Sea of Blue</span>
            <span className="launchpad-brand-tag">Sales OS</span>
          </div>
        </div>

        <div className="launchpad-topbar-right">
          <div className="launchpad-user-pill">
            <div className="launchpad-user-avatar">
              {(repName || 'M').charAt(0).toUpperCase()}
            </div>
            <span>{repName || 'Malik'}</span>
          </div>
          <button
            onClick={onLogout}
            style={{ background: 'transparent', border: 'none', color: '#64748b', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* Main App Grid Canvas */}
      <main className="launchpad-canvas">
        <div className="launchpad-header">
          <h1 className="launchpad-title">Sales OS Suite</h1>
          <p className="launchpad-subtitle">
            Select a dedicated workspace to begin field canvassing, inside phone sales, or territory mapping.
          </p>
        </div>

        <div className="launchpad-grid">
          {APPS.map(app => {
            if (app.isExternal) {
              return (
                <a
                  key={app.id}
                  href={app.href}
                  className="launchpad-card"
                  style={{ textDecoration: 'none', '--card-glow': app.cardGlow }}
                >
                  <div className="launchpad-icon-squircle" style={{ background: app.iconBg }}>
                    {app.icon}
                  </div>
                  <div className="launchpad-card-title">{app.title}</div>
                  <span
                    className="launchpad-card-badge"
                    style={{ color: app.badgeColor, background: app.badgeBg, border: `1px solid ${app.badgeColor}33` }}
                  >
                    {app.badge}
                  </span>
                  <div className="launchpad-card-desc">{app.desc}</div>
                </a>
              );
            }

            return (
              <div
                key={app.id}
                className="launchpad-card"
                style={{ '--card-glow': app.cardGlow }}
                onClick={() => onSelectApp(app.id)}
              >
                <div className="launchpad-icon-squircle" style={{ background: app.iconBg }}>
                  {app.icon}
                </div>
                <div className="launchpad-card-title">{app.title}</div>
                <span
                  className="launchpad-card-badge"
                  style={{ color: app.badgeColor, background: app.badgeBg, border: `1px solid ${app.badgeColor}33` }}
                >
                  {app.badge}
                </span>
                <div className="launchpad-card-desc">{app.desc}</div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
