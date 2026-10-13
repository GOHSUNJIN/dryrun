import { useState } from 'react'
import { ExternalLink, Check, Zap } from 'lucide-react'
import { loadProfile, saveProfile, exportSessions, deleteAllSessions, loadVoiceSettings, saveVoiceSettings, loadRehearsalDefaults, saveRehearsalDefaults } from '../utils/storage.js'

const NAV = ['Profile', 'Rehearsal Defaults', 'Voice', 'Integrations', 'Privacy']

const INTEGRATIONS = [
  { icon: '📁', name: 'Google Drive',    desc: 'Import proposals from Drive'    },
  { icon: '📝', name: 'Google Docs',     desc: 'Export session reports to Docs' },
  { icon: '📅', name: 'Google Calendar', desc: 'Sync upcoming meetings'         },
]

const PERSONA_VOICES = [
  { label: 'Morgan', sub: 'Finance',    desc: 'Low pitch, measured pace'            },
  { label: 'Alex',   sub: 'Legal',      desc: 'Neutral pitch, deliberate pace'      },
  { label: 'Jordan', sub: 'Operations', desc: 'Low pitch, direct pace'              },
  { label: 'Sam',    sub: 'Fact-check', desc: 'Slightly higher pitch, careful pace' },
]

function Row({ label, sublabel, children, last }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '14px 0', borderBottom: last ? 'none' : '1px solid var(--border-light)',
      gap: 16,
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-primary)' }}>{label}</div>
        {sublabel && (
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 2, maxWidth: 380 }}>{sublabel}</div>
        )}
      </div>
      {children && <div style={{ flexShrink: 0 }}>{children}</div>}
    </div>
  )
}

function SectionTitle({ children, style }) {
  return (
    <div style={{
      fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 600,
      color: 'var(--text-primary)', marginBottom: 4, paddingBottom: 14,
      borderBottom: '1px solid var(--border-light)', ...style,
    }}>{children}</div>
  )
}

function SaveRow({ saved, onSave, label = 'Save' }) {
  return (
    <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12 }}>
      {saved && (
        <span style={{ fontSize: '0.8125rem', color: '#059669', display: 'flex', alignItems: 'center', gap: 4 }}>
          <Check size={13} /> Saved
        </span>
      )}
      <button className="btn btn-primary" onClick={onSave}>{label}</button>
    </div>
  )
}

export default function Settings() {
  const init         = loadProfile()
  const initVoice    = loadVoiceSettings()
  const initDefaults = loadRehearsalDefaults()

  const [activeSection, setActiveSection] = useState('Profile')
  const [name, setName]           = useState(init.name)
  const [role, setRole]           = useState(init.role)
  const [savedProfile, setSavedProfile]   = useState(false)
  const [savedDefaults, setSavedDefaults] = useState(false)
  const [toughness, setToughness]         = useState(initDefaults.toughness)
  const [turnLimit, setTurnLimit]         = useState(initDefaults.turnLimit)
  const [voiceEnabled, setVoiceEnabled]   = useState(initVoice.enabled)
  const [voiceRate, setVoiceRate]         = useState(String(initVoice.rate))

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

  const ToggleBtn = ({ on, onClick }) => (
    <button onClick={onClick} style={{
      padding: '6px 16px', borderRadius: 6, fontSize: '0.8125rem', fontWeight: 600,
      cursor: 'pointer', fontFamily: 'var(--font-ui)', border: '1.5px solid',
      borderColor: on ? '#059669' : 'var(--border)',
      background:  on ? 'rgba(5,150,105,0.1)' : 'transparent',
      color:       on ? '#059669' : 'var(--text-secondary)',
      transition: 'all 0.15s ease', whiteSpace: 'nowrap',
    }}>{on ? 'On' : 'Off'}</button>
  )

  const SegmentedBtn = ({ options, value, onChange }) => (
    <div style={{ display: 'flex', gap: 6 }}>
      {options.map(opt => (
        <button key={opt} onClick={() => onChange(opt)} style={{
          padding: '6px 14px', borderRadius: 6, fontSize: '0.8125rem', fontWeight: 500,
          cursor: 'pointer', fontFamily: 'var(--font-ui)', border: '1.5px solid',
          borderColor: value === opt ? 'var(--text-primary)' : 'var(--border)',
          background:  value === opt ? 'var(--text-primary)' : 'transparent',
          color:       value === opt ? 'white' : 'var(--text-secondary)',
          transition: 'all 0.15s ease',
        }}>{opt}</button>
      ))}
    </div>
  )

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">Settings</div>
      </div>

      <div className="settings-layout">
        <div className="settings-nav">
          {NAV.map(n => (
            <button
              key={n}
              className={`settings-nav-item ${activeSection === n ? 'active' : ''}`}
              onClick={() => setActiveSection(n)}
            >{n}</button>
          ))}
        </div>

        <div style={{ minWidth: 0 }}>

          {activeSection === 'Profile' && (
            <div className="settings-section">
              <SectionTitle>Profile</SectionTitle>
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
                  placeholder="e.g. Product Manager"
                />
              </Row>
              <SaveRow saved={savedProfile} onSave={handleSaveProfile} label="Save profile" />
            </div>
          )}

          {activeSection === 'Rehearsal Defaults' && (
            <div className="settings-section">
              <SectionTitle>Rehearsal Defaults</SectionTitle>
              <Row label="Turn limit" sublabel="Maximum turns before the session auto-ends">
                <select className="settings-select" value={turnLimit} onChange={e => setTurnLimit(e.target.value)}>
                  {['5', '10', '15', '20', '25'].map(v => <option key={v}>{v}</option>)}
                </select>
              </Row>
              <Row label="Panel toughness" sublabel="How hard the panel pushes back by default" last>
                <SegmentedBtn options={['Supportive', 'Balanced', 'Tough']} value={toughness} onChange={setToughness} />
              </Row>
              <SaveRow saved={savedDefaults} onSave={handleSaveDefaults} label="Save defaults" />
            </div>
          )}

          {activeSection === 'Voice' && (
            <div className="settings-section">
              <SectionTitle>Voice settings</SectionTitle>
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
                  <option value="0.8">Slow (0.8×)</option>
                  <option value="1">Normal (1×)</option>
                  <option value="1.2">Slightly faster (1.2×)</option>
                  <option value="1.5">Fast (1.5×)</option>
                </select>
              </Row>

              <SectionTitle style={{ marginTop: 28, fontSize: '0.75rem', letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, borderBottom: '1px solid var(--border-light)', paddingBottom: 12, marginBottom: 0 }}>
                Persona voices
              </SectionTitle>
              {PERSONA_VOICES.map(({ label, sub, desc }, i) => (
                <div key={label} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '12px 0', opacity: 0.55,
                  borderBottom: i < PERSONA_VOICES.length - 1 ? '1px solid var(--border-light)' : 'none',
                }}>
                  <div>
                    <div style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-primary)' }}>
                      {label} <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>· {sub}</span>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 2 }}>{desc}</div>
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>System voice</span>
                </div>
              ))}
            </div>
          )}

          {activeSection === 'Integrations' && (
            <div className="settings-section">
              <SectionTitle>Integrations</SectionTitle>
              <div style={{
                display: 'flex', alignItems: 'flex-start', gap: 12,
                padding: '14px 16px', borderRadius: 8,
                background: 'var(--bg-hover)', border: '1px solid var(--border)',
                marginBottom: 20,
              }}>
                <Zap size={15} style={{ color: 'var(--text-muted)', marginTop: 1, flexShrink: 0 }} />
                <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  Google integrations are coming in the next release. Connect Drive to import proposals and Calendar to sync upcoming meetings.
                </div>
              </div>
              {INTEGRATIONS.map((int, i) => (
                <div key={int.name} style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '12px 0', opacity: 0.45,
                  borderBottom: i < INTEGRATIONS.length - 1 ? '1px solid var(--border-light)' : 'none',
                }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 8, background: 'var(--bg-hover)',
                    border: '1px solid var(--border)', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontSize: '1.1rem', flexShrink: 0,
                  }}>{int.icon}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-primary)' }}>{int.name}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 2 }}>{int.desc}</div>
                  </div>
                  <button className="btn btn-secondary btn-sm" disabled>Connect</button>
                </div>
              ))}
            </div>
          )}

          {activeSection === 'Privacy' && (
            <>
              <div className="settings-section">
                <SectionTitle>Data and privacy</SectionTitle>
                <Row label="Data storage" sublabel="Session transcripts and reports are stored locally in your browser. No data is sent to external servers unless you connect an integration." />
                <Row label="Export all session data" sublabel="Download a full JSON archive of your sessions" last>
                  <button className="btn btn-secondary btn-sm" onClick={exportSessions} style={{ gap: 6 }}>
                    <ExternalLink size={12} /> Export
                  </button>
                </Row>
              </div>

              <div className="settings-section" style={{ borderColor: 'rgba(220,38,38,0.2)' }}>
                <div style={{
                  fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 600,
                  color: '#DC2626', marginBottom: 4, paddingBottom: 14,
                  borderBottom: '1px solid rgba(220,38,38,0.15)',
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
