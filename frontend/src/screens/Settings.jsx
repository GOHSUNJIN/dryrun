import { useState } from 'react'
import { ExternalLink, Check, Zap, Loader, User, Sliders, Volume2, Link2, Shield, ChevronRight } from 'lucide-react'
import { useToast } from '../components/Toast.jsx'
import ToastStack from '../components/Toast.jsx'
import { loadProfile, saveProfile, exportSessions, deleteAllSessions, loadVoiceSettings, saveVoiceSettings, loadRehearsalDefaults, saveRehearsalDefaults, loadCalEvents, clearCalEvents } from '../utils/storage.js'
import { signIn, isSignedIn, signOut } from '../utils/google.js'

const NAV = [
  { id: 'Profile',            label: 'Profile',             icon: User    },
  { id: 'Rehearsal Defaults', label: 'Rehearsal Defaults',  icon: Sliders },
  { id: 'Voice',              label: 'Voice',               icon: Volume2 },
  { id: 'Integrations',       label: 'Integrations',        icon: Link2   },
  { id: 'Privacy',            label: 'Privacy',             icon: Shield  },
]

const INTEGRATIONS = [
  { icon: '📁', name: 'Google Drive',    desc: 'Import proposals directly from Drive'  },
  { icon: '📝', name: 'Google Docs',     desc: 'Export session reports to a new Doc'   },
  { icon: '📅', name: 'Google Calendar', desc: 'Sync upcoming meetings to your Home screen' },
]


function Row({ label, sublabel, children, last }) {
  return (
    <div className="settings-row" style={{ borderBottom: last ? 'none' : '1px solid var(--border-light)' }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-primary)' }}>{label}</div>
        {sublabel && (
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 3, maxWidth: 360, lineHeight: 1.5 }}>{sublabel}</div>
        )}
      </div>
      {children && <div style={{ flexShrink: 0 }}>{children}</div>}
    </div>
  )
}

export default function Settings() {
  const init         = loadProfile()
  const initVoice    = loadVoiceSettings()
  const initDefaults = loadRehearsalDefaults()
  const { toasts, show: showToast } = useToast()

  const [activeSection, setActiveSection] = useState('Profile')
  const [name, setName]           = useState(init.name)
  const [role, setRole]           = useState(init.role)
  const [savedProfile, setSavedProfile]   = useState(false)
  const [savedDefaults, setSavedDefaults] = useState(false)
  const [toughness, setToughness]         = useState(initDefaults.toughness)
  const [turnLimit, setTurnLimit]         = useState(initDefaults.turnLimit)
  const [voiceEnabled, setVoiceEnabled]   = useState(initVoice.enabled)
  const [voiceRate, setVoiceRate]         = useState(String(initVoice.rate))
  const [googleConnected, setGoogleConnected] = useState(() => isSignedIn() || loadCalEvents() !== null)
  const [googleConnecting, setGoogleConnecting] = useState(false)

  const handleSaveProfile = () => {
    saveProfile(name, role)
    setSavedProfile(true)
    setTimeout(() => setSavedProfile(false), 2000)
  }

  const handleSaveDefaults = () => {
    saveRehearsalDefaults({ toughness, turnLimit })
    setSavedDefaults(true)
    setTimeout(() => setSavedDefaults(false), 2000)
  }

  const handleGoogleConnect = async () => {
    setGoogleConnecting(true)
    try {
      await signIn()
      setGoogleConnected(true)
      showToast('Connected to Google')
    } catch (err) {
      console.error('[Settings] Google sign-in failed:', err)
      showToast('Sign-in failed. Try again.', 'error')
    } finally {
      setGoogleConnecting(false)
    }
  }

  const handleGoogleDisconnect = () => {
    signOut()
    clearCalEvents()
    setGoogleConnected(false)
  }

  const handleDeleteAll = () => {
    if (window.confirm('This will permanently delete all rehearsal data. This cannot be undone.')) {
      deleteAllSessions()
    }
  }

  const toggleVoice = () => {
    const next = !voiceEnabled
    setVoiceEnabled(next)
    saveVoiceSettings({ enabled: next, rate: Number(voiceRate) })
    if (!next) window.speechSynthesis?.cancel()
  }

  const activeNav = NAV.find(n => n.id === activeSection)

  const ToggleBtn = ({ on, onClick }) => (
    <button onClick={onClick} style={{
      padding: '7px 18px', borderRadius: 6, fontSize: '0.8125rem', fontWeight: 600,
      cursor: 'pointer', fontFamily: 'var(--font-ui)', border: '1.5px solid',
      borderColor: on ? '#059669' : 'var(--border)',
      background:  on ? 'rgba(5,150,105,0.08)' : 'var(--bg-base)',
      color:       on ? '#059669' : 'var(--text-secondary)',
      transition: 'all 0.15s ease', whiteSpace: 'nowrap',
    }}>{on ? 'On' : 'Off'}</button>
  )

  const SegmentedBtn = ({ options, value, onChange }) => (
    <div style={{ display: 'flex', gap: 4, background: 'var(--bg-base)', padding: 3, borderRadius: 8, border: '1px solid var(--border)' }}>
      {options.map(opt => (
        <button key={opt} onClick={() => onChange(opt)} style={{
          padding: '6px 14px', borderRadius: 6, fontSize: '0.8125rem', fontWeight: 500,
          cursor: 'pointer', fontFamily: 'var(--font-ui)', border: 'none',
          background:  value === opt ? 'var(--bg-surface)' : 'transparent',
          color:       value === opt ? 'var(--text-primary)' : 'var(--text-muted)',
          boxShadow:   value === opt ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
          transition: 'all 0.15s ease',
        }}>{opt}</button>
      ))}
    </div>
  )

  return (
    <div className="page" style={{ maxWidth: 1000 }}>
      <ToastStack toasts={toasts} />
      <div className="page-header" style={{ marginBottom: 32 }}>
        <div className="page-title">Settings</div>
      </div>

      <div className="settings-layout">

        {/* Left nav */}
        <div className="settings-nav" style={{ top: 24 }}>
          {NAV.map(n => {
            const Icon = n.icon
            const isActive = activeSection === n.id
            return (
              <button
                key={n.id}
                onClick={() => setActiveSection(n.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '9px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
                  fontFamily: 'var(--font-ui)', fontSize: '0.875rem', fontWeight: isActive ? 600 : 500,
                  textAlign: 'left',
                  background: isActive ? 'var(--bg-surface)' : 'transparent',
                  color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                  boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.08), 0 0 0 1px var(--border)' : 'none',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--bg-hover)' }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
              >
                <Icon size={15} style={{ color: isActive ? 'var(--app-accent)' : 'var(--text-muted)', flexShrink: 0 }} />
                {n.label}
                {isActive && <ChevronRight size={13} style={{ marginLeft: 'auto', color: 'var(--text-muted)' }} />}
              </button>
            )
          })}
        </div>

        {/* Right content */}
        <div style={{ minWidth: 0 }}>

          {activeSection === 'Profile' && (
            <div className="settings-section">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, paddingBottom: 16, borderBottom: '1px solid var(--border-light)' }}>
                <User size={16} style={{ color: 'var(--app-accent)' }} />
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.0625rem', fontWeight: 600, color: 'var(--text-primary)' }}>Profile</div>
              </div>
              <Row label="Display name" sublabel="How your name appears in session reports">
                <input
                  className="settings-input"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Your full name"
                />
              </Row>
              <Row label="Job role" sublabel="Used to contextualise panel feedback" last>
                <input
                  className="settings-input"
                  value={role}
                  onChange={e => setRole(e.target.value)}
                  placeholder="Your job title"
                />
              </Row>
              <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12 }}>
                {savedProfile && (
                  <span style={{ fontSize: '0.8125rem', color: '#059669', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Check size={13} /> Saved
                  </span>
                )}
                <button className="btn btn-primary" onClick={handleSaveProfile}>Save Profile</button>
              </div>
            </div>
          )}

          {activeSection === 'Rehearsal Defaults' && (
            <div className="settings-section">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, paddingBottom: 16, borderBottom: '1px solid var(--border-light)' }}>
                <Sliders size={16} style={{ color: 'var(--app-accent)' }} />
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.0625rem', fontWeight: 600, color: 'var(--text-primary)' }}>Rehearsal Defaults</div>
              </div>
              <Row label="Turn limit" sublabel="Maximum turns before the session auto-ends">
                <select className="settings-select" value={turnLimit} onChange={e => setTurnLimit(e.target.value)}>
                  {['5', '10', '15', '20', '25'].map(v => <option key={v}>{v}</option>)}
                </select>
              </Row>
              <Row label="Panel toughness" sublabel="How hard the panel pushes back by default" last>
                <SegmentedBtn options={['Supportive', 'Balanced', 'Tough']} value={toughness} onChange={setToughness} />
              </Row>
              <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12 }}>
                {savedDefaults && (
                  <span style={{ fontSize: '0.8125rem', color: '#059669', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Check size={13} /> Saved
                  </span>
                )}
                <button className="btn btn-primary" onClick={handleSaveDefaults}>Save Defaults</button>
              </div>
            </div>
          )}

          {activeSection === 'Voice' && (
            <div className="settings-section">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, paddingBottom: 16, borderBottom: '1px solid var(--border-light)' }}>
                <Volume2 size={16} style={{ color: 'var(--app-accent)' }} />
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.0625rem', fontWeight: 600, color: 'var(--text-primary)' }}>Voice</div>
              </div>
              <Row label="Panel voices" sublabel="Panel members read their challenges aloud during rehearsal">
                <ToggleBtn on={voiceEnabled} onClick={toggleVoice} />
              </Row>
              <Row label="Speaking speed" sublabel="Multiplier applied to all panel voices" last>
                <select
                  className="settings-select"
                  value={voiceRate}
                  onChange={e => {
                    setVoiceRate(e.target.value)
                    saveVoiceSettings({ enabled: voiceEnabled, rate: Number(e.target.value) })
                  }}
                >
                  <option value="0.8">Slow (0.8x)</option>
                  <option value="1">Normal (1x)</option>
                  <option value="1.2">Slightly faster (1.2x)</option>
                  <option value="1.5">Fast (1.5x)</option>
                </select>
              </Row>

            </div>
          )}

          {activeSection === 'Integrations' && (
            <div className="settings-section">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, paddingBottom: 16, borderBottom: '1px solid var(--border-light)' }}>
                <Link2 size={16} style={{ color: 'var(--app-accent)' }} />
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.0625rem', fontWeight: 600, color: 'var(--text-primary)' }}>Integrations</div>
              </div>

              {googleConnected ? (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '11px 14px', borderRadius: 8, marginBottom: 20,
                  background: 'rgba(5,150,105,0.06)', border: '1px solid rgba(5,150,105,0.18)',
                }}>
                  <Check size={14} style={{ color: '#059669', flexShrink: 0 }} />
                  <div style={{ fontSize: '0.8125rem', color: '#059669', lineHeight: 1.5, flex: 1 }}>
                    Connected to Google. Drive import, Docs export and Calendar sync are active.
                  </div>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={handleGoogleDisconnect}
                    style={{ color: '#DC2626', borderColor: 'rgba(220,38,38,0.25)', whiteSpace: 'nowrap', flexShrink: 0 }}
                  >
                    Disconnect
                  </button>
                </div>
              ) : (
                <div style={{
                  display: 'flex', alignItems: 'flex-start', gap: 12,
                  padding: '12px 14px', borderRadius: 8, marginBottom: 20,
                  background: 'var(--bg-hover)', border: '1px solid var(--border)',
                }}>
                  <Zap size={14} style={{ color: 'var(--text-muted)', marginTop: 2, flexShrink: 0 }} />
                  <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                    One Google sign-in unlocks all three integrations. Connect below to get started.
                  </div>
                </div>
              )}

              {INTEGRATIONS.map((int, i) => (
                <div key={int.name} style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '14px 0',
                  borderBottom: i < INTEGRATIONS.length - 1 ? '1px solid var(--border-light)' : 'none',
                }}>
                  <div style={{
                    width: 38, height: 38, borderRadius: 9, background: 'var(--bg-hover)',
                    border: '1px solid var(--border)', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontSize: '1.1rem', flexShrink: 0,
                  }}>{int.icon}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>{int.name}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 2 }}>{int.desc}</div>
                  </div>
                  {googleConnected ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.8125rem', fontWeight: 600, color: '#059669' }}>
                      <Check size={13} /> Connected
                    </span>
                  ) : (
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={handleGoogleConnect}
                      disabled={googleConnecting}
                    >
                      {googleConnecting
                        ? <><Loader size={12} style={{ animation: 'spin 1s linear infinite' }} /> Connecting...</>
                        : 'Connect'
                      }
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {activeSection === 'Privacy' && (
            <>
              <div className="settings-section" style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, paddingBottom: 16, borderBottom: '1px solid var(--border-light)' }}>
                  <Shield size={16} style={{ color: 'var(--app-accent)' }} />
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.0625rem', fontWeight: 600, color: 'var(--text-primary)' }}>Data and Privacy</div>
                </div>
                <Row label="Data storage" sublabel="Session transcripts and reports are stored locally in your browser. No data is sent to external servers unless you connect an integration." />
                <Row label="Export all session data" sublabel="Download a full JSON archive of your sessions" last>
                  <button className="btn btn-secondary btn-sm" onClick={exportSessions} style={{ gap: 6 }}>
                    <ExternalLink size={12} /> Export
                  </button>
                </Row>
              </div>

              <div className="settings-section" style={{ borderColor: 'rgba(220,38,38,0.18)' }}>
                <div style={{
                  fontFamily: 'var(--font-display)', fontSize: '1.0625rem', fontWeight: 600,
                  color: '#DC2626', marginBottom: 4, paddingBottom: 16,
                  borderBottom: '1px solid rgba(220,38,38,0.12)',
                }}>Danger zone</div>
                <Row label="Delete all sessions" sublabel="Permanently removes all rehearsal data. This cannot be undone." last>
                  <button className="btn-danger" onClick={handleDeleteAll}>Delete all</button>
                </Row>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  )
}
