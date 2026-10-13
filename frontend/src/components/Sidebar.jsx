import { Home, PlusCircle, Clock, Users, Settings, ChevronRight } from 'lucide-react'

const NAV_ITEMS = [
  { id: 'home',     label: 'Home',           icon: Home       },
  { id: 'past',     label: 'Past Sessions',  icon: Clock      },
  { id: 'library',  label: 'Panel Library',  icon: Users      },
  { id: 'settings', label: 'Settings',       icon: Settings   },
]

function getProfile() {
  try {
    const p = JSON.parse(localStorage.getItem('dryrun_profile') || '{}')
    return {
      name:    p.name || 'Sun Jin',
      role:    p.role || 'Product Manager',
      initial: (p.name || 'Sun Jin').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase(),
    }
  } catch { return { name: 'Sun Jin', role: 'Product Manager', initial: 'SJ' } }
}

export default function Sidebar({ current, navigate }) {
  const profile = getProfile()

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-logo-mark">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <rect x="1" y="4" width="5" height="9" rx="1" fill="#1C1917" opacity="0.9"/>
            <rect x="8" y="1" width="5" height="12" rx="1" fill="#1C1917" opacity="0.9"/>
          </svg>
        </div>
        <span className="sidebar-logo-text">Dry Run</span>
      </div>

      <div style={{ padding: '14px 12px 6px' }}>
        <button
          onClick={() => navigate('new')}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 8,
            padding: '9px 12px', background: 'rgba(242,179,91,0.10)',
            border: '1px solid rgba(242,179,91,0.22)', borderRadius: 8,
            color: '#F2B35B', fontSize: '0.8125rem', fontWeight: 600,
            cursor: 'pointer', fontFamily: 'var(--font-ui)', transition: 'all 0.15s ease',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(242,179,91,0.18)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(242,179,91,0.10)' }}
        >
          <PlusCircle size={14} />
          New rehearsal
        </button>
      </div>

      <nav className="sidebar-nav">
        <div className="sidebar-section-label">Workspace</div>
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            className={`sidebar-item ${current === id ? 'active' : ''}`}
            onClick={() => navigate(id)}
          >
            <Icon size={15} strokeWidth={current === id ? 2.2 : 1.8} />
            {label}
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-avatar">{profile.initial}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="sidebar-user-name">{profile.name}</div>
          <div className="sidebar-user-role">{profile.role}</div>
        </div>
        <ChevronRight size={13} style={{ color: 'var(--sidebar-icon)', flexShrink: 0 }} />
      </div>
    </aside>
  )
}
