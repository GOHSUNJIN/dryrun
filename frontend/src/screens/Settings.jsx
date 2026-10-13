import { useState } from 'react'
import { ExternalLink, Check } from 'lucide-react'
import { loadProfile, saveProfile, exportSessions, deleteAllSessions, loadVoiceSettings, saveVoiceSettings } from '../utils/storage.js'

const NAV = ['Profile', 'Rehearsal defaults', 'Voice', 'Integrations', 'Privacy']

const INTEGRATIONS = [
  { icon: '📁', name: 'Google Drive',    desc: 'Import proposals from Drive'      },
  { icon: '📝', name: 'Google Docs',     desc: 'Export session reports to Docs'   },
  { icon: '📅', name: 'Google Calendar', desc: 'Sync upcoming meetings'           },
]

export default function Settings() {
  const init = loadProfile()
  const initVoice = loadVoiceSettings()
  const [activeSection, setActiveSection] = useState('Profile')
  const [name, setName]           = useState(init.name)
  const [role, setRole]           = useState(init.role)
  const [savedFeedback, setSavedFeedback] = useState(false)
  const [defaultMode, setDefaultMode] = useState('Type')
  const [toughness, setToughness] = useState('Balanced')
  const [turnLimit, setTurnLimit] = useState('15')
  const [voiceEnabled, setVoiceEnabled] = useState(initVoice.enabled)
  const [voiceRate, setVoiceRate]       = useState(String(initVoice.rate))

  const handleSaveProfile = () => {
    saveProfile(name, role)
    setSavedFeedback(true)
    setTimeout(() => setSavedFeedback(false), 2000)
  }

  const handleDeleteAll = () => {
    if (window.confirm('This will permanently delete all rehearsal data. This cannot be undone.')) {
      deleteAllSessions()
    }
  }

  const comingSoonNote = (text) => (
    <div style={{
      padding: '11px 16px',
      borderRadius: 8,
      background: 'var(--bg-hover)',
      border: '1px solid var(--border)',
      color: 'var(--text-muted)',
      fontSize: '0.8125rem',
      marginBottom: 20,
    }}>
      {text}
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

        <div>
          {activeSection === 'Profile' && (
            <div className="settings-section">
              <div className="settings-section-title">Profile</div>
              <div className="settings-row">
                <div><div className="settings-label">Display name</div></div>
                <input className="settings-input" value={name} onChange={e => setName(e.target.value)} />
              </div>
              <div className="settings-row">
                <div>
                  <div className="settings-label">Job role</div>
                  <div className="settings-sublabel">Used to contextualise panel feedback</div>
                </div>
                <input className="settings-input" value={role} onChange={e => setRole(e.target.value)} />
              </div>
              <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12 }}>
                {savedFeedback && (
                  <span style={{ fontSize: '0.8125rem', color: '#059669', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Check size={13} /> Saved
                  </span>
                )}
                <button className="btn btn-primary" onClick={handleSaveProfile}>Save profile</button>
              </div>
            </div>
          )}

          {activeSection === 'Rehearsal defaults' && (
            <div className="settings-section">
              <div className="settings-section-title">Rehearsal defaults</div>
              <div className="settings-row">
                <div>
                  <div className="settings-label">Default mode</div>
                  <div className="settings-sublabel">Applied when starting a new rehearsal</div>
                </div>
                <select className="settings-select" value={defaultMode} onChange={e => setDefaultMode(e.target.value)}>
                  <option>Type</option>
                  <option>Hybrid</option>
                </select>
              </div>
              <div className="settings-row">
                <div>
                  <div className="settings-label">Turn limit</div>
                  <div className="settings-sublabel">Maximum turns before session auto-ends</div>
                </div>
                <select className="settings-select" value={turnLimit} onChange={e => setTurnLimit(e.target.value)}>
                  {['10', '15', '20', '25', '30'].map(v => <option key={v}>{v}</option>)}
                </select>
              </div>
              <div className="settings-row">
                <div>
                  <div className="settings-label">Panel toughness</div>
                  <div className="settings-sublabel">How hard the panel pushes back by default</div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {['Supportive', 'Balanced', 'Tough'].map(t => (
                    <button
                      key={t}
                      onClick={() => setToughness(t)}
                      style={{
                        padding: '7px 14px', borderRadius: 6, fontSize: '0.8125rem', fontWeight: 500,
                        cursor: 'pointer', fontFamily: 'var(--font-ui)', border: '1.5px solid',
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

          {activeSection === 'Voice' && (
            <div className="settings-section">
              <div className="settings-section-title">Voice settings</div>
              <div className="settings-row">
                <div>
                  <div className="settings-label">Panel voices</div>
                  <div className="settings-sublabel">Panel members read their challenges aloud during rehearsal</div>
                </div>
                <button
                  onClick={() => {
                    const next = !voiceEnabled
                    setVoiceEnabled(next)
                    saveVoiceSettings({ enabled: next, rate: Number(voiceRate) })
                    if (!next) window.speechSynthesis?.cancel()
                  }}
                  style={{
                    padding: '7px 16px', borderRadius: 6, fontSize: '0.8125rem', fontWeight: 600,
                    cursor: 'pointer', fontFamily: 'var(--font-ui)', border: '1.5px solid',
                    borderColor: voiceEnabled ? '#059669' : 'var(--border)',
                    background: voiceEnabled ? 'rgba(5,150,105,0.1)' : 'transparent',
                    color: voiceEnabled ? '#059669' : 'var(--text-secondary)',
                    transition: 'all 0.15s ease', whiteSpace: 'nowrap',
                  }}
                >{voiceEnabled ? 'On' : 'Off'}</button>
              </div>
              <div className="settings-row">
                <div>
                  <div className="settings-label">Speaking speed</div>
                  <div className="settings-sublabel">Multiplier applied to all panel voices</div>
                </div>
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
              </div>
              <div className="settings-section-title" style={{ marginTop: 24, fontSize: '0.75rem' }}>Persona voices</div>
              {[
                { label: 'Morgan (Finance)', desc: 'Low pitch, measured pace' },
                { label: 'Alex (Legal)',     desc: 'Neutral pitch, deliberate pace' },
                { label: 'Jordan (Ops)',     desc: 'Low pitch, direct pace' },
                { label: 'Sam (Fact-check)', desc: 'Slightly higher pitch, careful pace' },
              ].map(({ label, desc }) => (
                <div key={label} className="settings-row" style={{ opacity: 0.6 }}>
                  <div>
                    <div className="settings-label">{label}</div>
                    <div className="settings-sublabel">{desc}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeSection === 'Integrations' && (
            <div className="settings-section">
              <div className="settings-section-title">Integrations</div>
              {comingSoonNote('Google integrations are planned for the next release. Connect Drive to import proposals directly into Dry Run.')}
              {INTEGRATIONS.map(int => (
                <div key={int.name} className="integration-row" style={{ opacity: 0.45 }}>
                  <div className="integration-icon">{int.icon}</div>
                  <div className="integration-info">
                    <div className="integration-name">{int.name}</div>
                    <div className="integration-status">{int.desc}</div>
                  </div>
                  <button className="btn btn-secondary btn-sm" disabled>Connect</button>
                </div>
              ))}
            </div>
          )}

          {activeSection === 'Privacy' && (
            <>
              <div className="settings-section">
                <div className="settings-section-title">Data and privacy</div>
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
                  <button className="btn btn-secondary btn-sm" onClick={exportSessions}>
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
                  <button className="btn-danger" onClick={handleDeleteAll}>Delete all sessions</button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
