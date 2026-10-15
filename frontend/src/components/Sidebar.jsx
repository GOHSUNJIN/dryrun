import { Home, PlusCircle, Clock, Users, Settings, ChevronRight, UserCircle2 } from 'lucide-react'
import { loadProfile } from '../utils/storage.js'

const NAV_ITEMS = [
  { id: 'home',     label: 'Home',          shortLabel: 'Home',     icon: Home     },
  { id: 'past',     label: 'Past Sessions', shortLabel: 'Past',     icon: Clock    },
  { id: 'library',  label: 'Panel Library', shortLabel: 'Panel',    icon: Users    },
  { id: 'settings', label: 'Settings',      shortLabel: 'Settings', icon: Settings },
]

export function MobileHeader() {
  return (
    <header className="mobile-header">
      <div className="mobile-header-logo">
        <div className="sidebar-logo-mark" style={{ width: 24, height: 24 }}>
          <svg width="12" height="12" viewBox="0 0 20 20" fill="none">
            <rect x="2" y="8" width="6" height="10" rx="1.5" fill="#1C1917" opacity="0.9"/>
            <rect x="12" y="2" width="6" height="16" rx="1.5" fill="#1C1917"/>
          </svg>
        </div>
        <span className="mobile-header-wordmark">Dry Run</span>
      </div>
    </header>
  )
}

export function MobileNav({ current, navigate }) {
  const [left, right] = [NAV_ITEMS.slice(0, 2), NAV_ITEMS.slice(2)]
  return (
    <nav className="mobile-nav">
      {left.map(({ id, shortLabel, icon: Icon }) => (
        <button key={id} className={`mobile-nav-item ${current === id ? 'active' : ''}`} onClick={() => navigate(id)}>
          <Icon size={20} strokeWidth={current === id ? 2.2 : 1.8} />
          <span>{shortLabel}</span>
        </button>
      ))}
      <button className="mobile-nav-new" onClick={() => navigate('new')} aria-label="New rehearsal">
        <PlusCircle size={22} />
      </button>
      {right.map(({ id, shortLabel, icon: Icon }) => (
        <button key={id} className={`mobile-nav-item ${current === id ? 'active' : ''}`} onClick={() => navigate(id)}>
          <Icon size={20} strokeWidth={current === id ? 2.2 : 1.8} />
          <span>{shortLabel}</span>
        </button>
      ))}
    </nav>
  )
}

export default function Sidebar({ current, navigate }) {
  const profile    = loadProfile()
  const hasProfile = Boolean(profile.name)

  return (
    <aside className="sidebar">
      <button
        className="sidebar-logo"
        onClick={() => navigate('home')}
        style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}
      >
        <div className="sidebar-logo-mark">
          <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
            <rect x="2" y="8" width="6" height="10" rx="1.5" fill="#1C1917" opacity="0.9"/>
            <rect x="12" y="2" width="6" height="16" rx="1.5" fill="#1C1917"/>
          </svg>
        </div>
        <span className="sidebar-logo-text">Dry Run</span>
      </button>

      <div style={{ padding: '14px 12px 6px' }}>
        <button className="sidebar-new-btn" onClick={() => navigate('new')}>
          <PlusCircle size={14} />
          New Rehearsal
        </button>
      </div>

      <nav className="sidebar-nav">
        <div className="sidebar-section-label">Workspace</div>
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
          <button key={id} className={`sidebar-item ${current === id ? 'active' : ''}`} onClick={() => navigate(id)}>
            <Icon size={15} strokeWidth={current === id ? 2.2 : 1.8} />
            {label}
          </button>
        ))}
      </nav>

      <button
        className="sidebar-footer"
        onClick={() => navigate('settings')}
        style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
      >
        {hasProfile ? (
          <div className="sidebar-avatar">{profile.initial}</div>
        ) : (
          <div className="sidebar-avatar sidebar-avatar-empty">
            <UserCircle2 size={16} />
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          {hasProfile ? (
            <>
              <div className="sidebar-user-name">{profile.name}</div>
              <div className="sidebar-user-role">{profile.role || 'Settings'}</div>
            </>
          ) : (
            <>
              <div className="sidebar-user-name">Set up profile</div>
              <div className="sidebar-user-role">Add your name and role</div>
            </>
          )}
        </div>
        <ChevronRight size={13} style={{ color: 'var(--sidebar-icon)', flexShrink: 0 }} />
      </button>
    </aside>
  )
}
