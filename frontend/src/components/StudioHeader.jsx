import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { logout } from '../lib/auth';
import ClipoMark from './ClipoMark';

const NAV_ITEMS = [
  { id: 'create', label: 'Create', icon: 'spark' },
  { id: 'library', label: 'Library', icon: 'library' },
  { id: 'settings', label: 'Settings', icon: 'settings' },
];

const Icon = ({ type }) => {
  const paths = {
    spark: <path d="m12 3 1.5 4.5L18 8l-4.5 1.5L12 14l-1.5-4.5L6 8l4.5-1.5z" />,
    library: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.1 2.1-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56v.1h-3v-.1a1.7 1.7 0 0 0-1.03-1.56 1.7 1.7 0 0 0-1.88.34l-.06.06-2.1-2.1.06-.06a1.7 1.7 0 0 0 .34-1.88 1.7 1.7 0 0 0-1.56-1.03h-.1v-3h.1a1.7 1.7 0 0 0 1.56-1.03 1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.1-2.1.06.06a1.7 1.7 0 0 0 1.88.34h.06a1.7 1.7 0 0 0 1.03-1.56v-.1h3v.1a1.7 1.7 0 0 0 1.03 1.56 1.7 1.7 0 0 0 1.88-.34l.06-.06 2.1 2.1-.06.06a1.7 1.7 0 0 0-.34 1.88 1.7 1.7 0 0 0 1.56 1.03h.1v3h-.1a1.7 1.7 0 0 0-1.56 1.03Z" /></>,
  };
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[type]}
    </svg>
  );
};

export default function StudioHeader({ activeTab = 'create', onNavigate, rightSlot = null }) {
  const { user } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setMenuOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  const handleNav = (tab) => {
    setMenuOpen(false);
    setProfileOpen(false);
    if (onNavigate) onNavigate(tab);
  };

  return (
    <header className="app-header">
      <a className="app-logo" href="/" onClick={(e) => { e.preventDefault(); handleNav('create'); }}>
        <span><ClipoMark /></span>Clipo
      </a>

      <nav className="app-nav" aria-label="Primary">
        {NAV_ITEMS.map((item) => (
          <a
            key={item.id}
            className={`app-nav-link ${activeTab === item.id ? 'is-active' : ''}`}
            href={`#${item.id}`}
            onClick={(e) => { e.preventDefault(); handleNav(item.id); }}
            aria-current={activeTab === item.id ? 'page' : undefined}
          >
            <Icon type={item.icon} />
            <span>{item.label}</span>
          </a>
        ))}
      </nav>

      <div className="header-actions">
        <span className="local-badge"><i />Local-first</span>
        <a className="results-quiet" href="/report">Report</a>
        {user && (
          <div
            className="user-menu"
            onMouseEnter={() => setProfileOpen(true)}
            onMouseLeave={() => setProfileOpen(false)}
          >
            <img
              className="user-avatar"
              src={user.picture}
              alt={user.name}
              referrerPolicy="no-referrer"
              onClick={() => handleNav('profile')}
              style={{ cursor: 'pointer' }}
            />
            {profileOpen && (
              <div
                className="user-dropdown"
                onMouseEnter={() => setProfileOpen(true)}
                onMouseLeave={() => setProfileOpen(false)}
                role="menu"
              >
                <div className="user-dropdown-header">
                  <img src={user.picture} alt="" referrerPolicy="no-referrer" />
                  <div>
                    <strong>{user.name}</strong>
                    <span>{user.email}</span>
                  </div>
                </div>
                <div className="user-dropdown-divider" />
                <button onClick={() => handleNav('profile')}>Profile</button>
                <button onClick={() => handleNav('settings')}>Settings</button>
                <div className="user-dropdown-divider" />
                <button className="danger" onClick={logout}>Sign out</button>
              </div>
            )}
          </div>
        )}
        <button
          className={`mobile-menu-toggle ${menuOpen ? 'is-open' : ''}`}
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
          aria-expanded={menuOpen}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
            {menuOpen ? (
              <>
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </>
            ) : (
              <>
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </>
            )}
          </svg>
        </button>
        {rightSlot}
      </div>

      {/* Mobile menu panel */}
      <div className={`app-mobile-menu ${menuOpen ? 'is-open' : ''}`} role="dialog" aria-label="Mobile menu">
        <nav className="app-mobile-nav">
          {NAV_ITEMS.map((item) => (
            <a
              key={item.id}
              className={`app-mobile-link ${activeTab === item.id ? 'is-active' : ''}`}
              href={`#${item.id}`}
              onClick={(e) => { e.preventDefault(); handleNav(item.id); }}
              aria-current={activeTab === item.id ? 'page' : undefined}
            >
              <Icon type={item.icon} />
              <span>{item.label}</span>
              {activeTab === item.id && <span className="app-mobile-active-dot" aria-hidden="true" />}
            </a>
          ))}
        </nav>
        <div className="mobile-header-actions">
          <a className="results-quiet" href="/report" onClick={() => setMenuOpen(false)}>Report</a>
        </div>
      </div>
    </header>
  );
}
