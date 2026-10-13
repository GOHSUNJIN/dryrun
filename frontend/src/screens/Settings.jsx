import { useState } from 'react'
import { ExternalLink } from 'lucide-react'

const NAV = ['Profile', 'Rehearsal defaults', 'Voice', 'Integrations', 'Privacy']

const INTEGRATIONS = [
  { icon: '📁', name: 'Google Drive',    desc: 'Import proposals from Drive',      connected: true  },
  { icon: '📝', name: 'Google Docs',     desc: 'Export session reports to Docs',   connected: false },
  { icon: '📅', name: 'Google Calendar', desc: 'Sync upcoming meetings',           connected: false },
]

export default function Settings() {
  const [activeSection, setActiveSection] = useState('Profile')
  const [name, setName]               = useState('Sun Jin')
  const [role, setRole]               = useState('Product Manager')
  const [defaultMode, setDefaultMode] = useState('Type')
  const [toughness, setToughness]     = useState('Balanced')
  const [turnLimit, setTurnLimit]     = useState('15')
  const [integrations, setIntegrations] = useState(INTEGRATIONS)

  const toggleIntegration = (i) => {
    setIntegrations(prev => prev.map((int, idx) =>
      idx === i ? { ...int, connected: !int.connected } : int
    ))
  }

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">Settings</div>
      </div>

      <div className="settings-layout">
        {/* Left nav */}
        <div className="settings-nav">
          {NAV.map(n => (
            <button
              key={n}
              className={`settings-nav-item ${activeSection === n ? 'active' : ''}`}
              onClick={() => setActiveSection(n)}
            >{n}</button>
          ))}
        </div>

        {/* Right content */}
        <div>
          {/* Profile */}
          {activeSection === 'Profile' && (
            <div className="settings-section">
              <div className="settings-section-title">Profile</div>
              <div className="settings-row">
                <div>
                  <div className="settings-label">Display name</div>
                </div>
                <input
                  className="settings-input"
                  value={name}
                  onChange={e => setName(e.target.value)}
                />
              </div>
              <div className="settings-row">
                <div>
                  <div className="settings-label">Job role</div>
                  <div className="settings-sublabel">Used to contextualise panel feedback</div>
                </div>
                <input
                  className="settings-input"
                  value={role}
                  onChange={e => setRole(e.target.value)}
                />
              </div>
              <div className="settings-row">
                <div>
                  <div className="settings-label">Email</div>
                </div>
                <input className="settings-input" value="gohsunjin@gmail.com" readOnly style={{ opacity: 0.6 }} />
              </div>
              <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
                <button className="btn btn-primary">Save profile</button>
              </div>
            </div>
          )}

          {/* Rehearsal defaults */}
          {activeSection === 'Rehearsal defaults' && (
            <div className="settings-section">
              <div className="settings-section-title">Rehearsal defaults</div>
              <div className="settings-row">
                <div>
                  <div className="settings-label">Default mode</div>
                  <div className="settings-sublabel">Applied when starting a new rehearsal</div>
                </div>
                <select
                  className="settings-select"
                  value={defaultMode}
                  onChange={e => setDefaultMode(e.target.value)}
                >
                  <option>Type</option>
                  <option>Hybrid</option>
                  <option>Voice</option>
                </select>
              </div>
              <div className="settings-row">
                <div>
                  <div className="settings-label">Turn limit</div>
                  <div className="settings-sublabel">Maximum turns before session auto-ends</div>
                </div>
                <select
                  className="settings-select"
                  value={turnLimit}
                  onChange={e => setTurnLimit(e.target.value)}
                >
                  {['10','15','20','25','30'].map(v => <option key={v}>{v}</option>)}
                </select>
              </div>
              <div className="settings-row">
                <div>
                  <div className="settings-label">Panel toughness</div>
                  <div className="settings-sublabel">How hard the panel pushes back</div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {['Supportive', 'Balanced', 'Tough'].map(t => (
                    <button
                      key={t}
                      onClick={() => setToughness(t)}
                      style={{
                        padding: '7px 14px',
                        borderRadius: 6,
                        fontSize: '0.8125rem',
                        fontWeight: 500,
                        cursor: 'pointer',
                        fontFamily: 'var(--font-ui)',
                        border: '1.5px solid',
                        borderColor: toughness === t ? 'var(--text-primary)' : 'var(--border)',
                        background: toughness === t ? 'var(--text-primary)' : 'transparent',
                        color: toughness === t ? 'white' : 'var(--text-secondary)',
                        transition: 'all 0.15s ease',
                      }}
                    >{t}</button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Voice */}
          {activeSection === 'Voice' && (
            <div className="settings-section">
              <div className="settings-section-title">Voice settings</div>
              {[
                { label: 'Morgan (Finance)', voice: 'Professional , measured' },
                { label: 'Alex (Legal)',     voice: 'Precise , deliberate' },
                { label: 'Jordan (Ops)',     voice: 'Direct , brisk' },
                { label: 'Sam (Fact-check)', voice: 'Neutral , clear' },
              ].map(({ label, voice }) => (
                <div key={label} className="settings-row">
                  <div>
                    <div className="settings-label">{label}</div>
                    <div className="settings-sublabel">{voice}</div>
                  </div>
                  <select className="settings-select">
                    <option>Professional , measured</option>
                    <option>Authoritative , clipped</option>
                    <option>Warm , clear</option>
                  </select>
                </div>
              ))}
              <div className="settings-row">
                <div>
                  <div className="settings-label">Speaking speed</div>
                </div>
                <select className="settings-select">
                  <option>Normal (1×)</option>
                  <option>Slightly faster (1.2×)</option>
                  <option>Fast (1.5×)</option>
                </select>
              </div>
            </div>
          )}

          {/* Integrations */}
          {activeSection === 'Integrations' && (
            <div className="settings-section">
              <div className="settings-section-title">Integrations</div>
              {integrations.map((int, i) => (
                <div key={int.name} className="integration-row">
                  <div className="integration-icon">{int.icon}</div>
                  <div className="integration-info">
                    <div className="integration-name">{int.name}</div>
                    <div className="integration-status">{int.desc}</div>
                  </div>
                  <button
                    className={int.connected ? 'btn btn-secondary btn-sm' : 'btn btn-accent btn-sm'}
                    onClick={() => toggleIntegration(i)}
                  >
                    {int.connected ? 'Disconnect' : 'Connect'}
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Privacy */}
          {activeSection === 'Privacy' && (
            <>
              <div className="settings-section">
                <div className="settings-section-title">Data & privacy</div>
                <div className="settings-row">
                  <div>
                    <div className="settings-label">Data storage</div>
                    <div className="settings-sublabel" style={{ maxWidth: 380 }}>
                      Session transcripts and reports are stored locally in your browser. No data is sent to external servers unless you connect an integration.
                    </div>
                  </div>
                </div>
                <div className="settings-row">
                  <div>
                    <div className="settings-label">Export all session data</div>
                    <div className="settings-sublabel">Download a full JSON archive of your sessions</div>
                  </div>
                  <button className="btn btn-secondary btn-sm">
                    <ExternalLink size={12} /> Export
                  </button>
                </div>
              </div>

              <div className="settings-section danger-zone">
                <div className="settings-section-title">Danger zone</div>
                <div className="settings-row">
                  <div>
                    <div className="settings-label">Delete all sessions</div>
                    <div className="settings-sublabel">Permanently removes all rehearsal data. This cannot be undone.</div>
                  </div>
                  <button className="btn-danger">Delete all sessions</button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
