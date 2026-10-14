import { useState, useRef, Fragment } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Upload, FileText, Check, ArrowRight, ArrowLeft, X, Loader, FolderOpen, Folder, ChevronRight } from 'lucide-react'
import { PERSONAS } from '../data.js'
import { loadCustomPersonas, loadRehearsalDefaults, loadSessions } from '../utils/storage.js'
import { listDriveItems, fetchDocText } from '../utils/google.js'

const STEPS = ['Upload proposal', 'Choose panel', 'Configure and launch']


function buildCustomDefs(customPersonas) {
  const defs = {}
  for (const p of customPersonas) {
    defs[p.id] = { name: p.name, role: p.role, speaking_style: p.speaking_style || '', cares: (p.cares || []).join(', '), conditions: p.conditions || [] }
  }
  return defs
}

export default function NewRehearsal({ navigate, session, updateSession, resetSession, navPayload = {} }) {
  const customPersonas = loadCustomPersonas()
  const allPersonas    = [...PERSONAS, ...customPersonas]
  const defaults       = loadRehearsalDefaults()
  const autoName = useRef(navPayload.meetingName || `Rehearsal ${loadSessions().length + 1}`)
  const [step, setStep]           = useState(0)
  const [uploaded, setUploaded]   = useState(false)
  const [proposalText, setProposalText] = useState('')
  const [proposalName, setProposalName] = useState(autoName.current)
  const [drag, setDrag]           = useState(false)
  const [selected, setSelected]   = useState(['finance', 'legal', 'ops', 'factcheck'])
  const [toughness, setToughness] = useState(defaults.toughness)
  const [turnLimit, setTurnLimit] = useState(15)
  const [industry, setIndustry]   = useState('')
  const [companySize, setCompanySize] = useState('')
  const [focus, setFocus]         = useState('')
  const [launching, setLaunching] = useState(false)
  const [driveOpen, setDriveOpen]       = useState(false)
  const [driveLoading, setDriveLoading] = useState(false)
  const [driveItems, setDriveItems]     = useState([])
  const [driveStack, setDriveStack]     = useState([])
  const fileInputRef = useRef(null)

  const togglePersona = (id) => {
    setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id])
  }

  const readFile = (file) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      setProposalText(e.target.result)
      setProposalName(prev => prev === autoName.current ? file.name.replace(/\.[^.]+$/, '') : prev)
      setUploaded(true)
    }
    reader.readAsText(file)
  }

  const openDrivePicker = async () => {
    setDriveLoading(true)
    setDriveStack([])
    try {
      const items = await listDriveItems('root')
      setDriveItems(items)
      setDriveOpen(true)
    } catch (err) {
      console.error('[Drive] failed to open picker:', err)
    } finally {
      setDriveLoading(false)
    }
  }

  const navigateDriveFolder = async (folder) => {
    setDriveLoading(true)
    try {
      const items = await listDriveItems(folder.id)
      setDriveItems(items)
      setDriveStack(prev => [...prev, { id: folder.id, name: folder.name }])
    } catch (err) {
      console.error('[Drive] folder nav failed:', err)
    } finally {
      setDriveLoading(false)
    }
  }

  const navigateDriveTo = async (stackIndex) => {
    const newStack = driveStack.slice(0, stackIndex)
    const folderId = newStack[newStack.length - 1]?.id || 'root'
    setDriveLoading(true)
    try {
      const items = await listDriveItems(folderId)
      setDriveItems(items)
      setDriveStack(newStack)
    } catch (err) {
      console.error('[Drive] breadcrumb nav failed:', err)
    } finally {
      setDriveLoading(false)
    }
  }

  const selectDriveFile = async (file) => {
    setDriveOpen(false)
    setDriveLoading(true)
    try {
      const text = await fetchDocText(file.id)
      setProposalText(text)
      setProposalName(prev => prev === autoName.current ? file.name : prev)
      setUploaded(true)
    } catch (err) {
      console.error('[Drive] failed to fetch doc:', err)
    } finally {
      setDriveLoading(false)
    }
  }

const canContinue = () => {
    if (step === 0) return uploaded && proposalName.trim().length > 0
    if (step === 1) return selected.length >= 2
    return true
  }

  const enterRoom = async () => {
    setLaunching(true)

    const text = proposalText
    const config = { toughness, turnLimit, industry, companySize, focus }

    try {
      const res = await fetch('/api/session/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proposal_text: text,
          persona_ids: selected,
          config,
          custom_personas: buildCustomDefs(customPersonas.filter(p => selected.includes(p.id))),
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail || `API error ${res.status}`)
      }

      const data = await res.json()
      if (data.demo) console.error('[NewRehearsal] AI unavailable, demo mode. Reason:', data.demo_reason || 'unknown')
      resetSession()
      updateSession({
        proposalText: text,
        proposalName: proposalName || 'Untitled proposal',
        personaIds: selected,
        config,
        transcript: data.messages || [],
        conditions: data.conditions || {},
        factCheckNotes: data.fact_check || '',
        customPersonaDefs: buildCustomDefs(customPersonas.filter(p => selected.includes(p.id))),
        startTime: Date.now(),
        demoMode: !!data.demo,
      })
      navigate('room')
    } catch (err) {
      console.error('[NewRehearsal] session/start failed:', err)
      resetSession()
      updateSession({
        proposalText: text,
        proposalName: proposalName || 'Untitled proposal',
        personaIds: selected,
        config,
        transcript: [],
        conditions: {},
        factCheckNotes: '',
        customPersonaDefs: buildCustomDefs(customPersonas.filter(p => selected.includes(p.id))),
        startTime: Date.now(),
        demoMode: true,
      })
      navigate('room')
    }
  }

  return (
    <div className="setup-container">
      <button
        onClick={() => navigate('home')}
        style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8125rem', color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', marginBottom: 28, fontFamily: 'var(--font-ui)' }}
      >
        <ArrowLeft size={14} /> Back to home
      </button>

      {/* Step indicators */}
      <div className="setup-steps">
        {STEPS.map((label, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div className={`step-number ${i < step ? 'done' : i === step ? 'active' : ''}`}>
                {i < step ? <Check size={12} /> : i + 1}
              </div>
              <span className={`step-label ${i < step ? 'done' : i === step ? 'active' : ''}`}>
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && <div className="step-connector" style={{ flex: 1, maxWidth: 48, marginLeft: 12 }} />}
          </div>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -16 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
        >
          <div className="step-content">
            {/* Step 0: Upload */}
            {step === 0 && (
              <>
                <div className="step-title">Upload your proposal</div>
                <div className="step-desc">Drag in a PDF or text file, or import directly from Google Drive.</div>

                <div style={{ marginBottom: 24 }}>
                  <div className="question-label">Session name</div>
                  <input
                    className="settings-input"
                    value={proposalName}
                    onChange={e => setProposalName(e.target.value)}
                    placeholder="Name this session..."
                    style={{ width: '100%', boxSizing: 'border-box', marginTop: 8 }}
                  />
                </div>

                {!uploaded ? (
                  <>
                    <div
                      className={`upload-zone ${drag ? 'drag-over' : ''}`}
                      onDragOver={e => { e.preventDefault(); setDrag(true) }}
                      onDragLeave={() => setDrag(false)}
                      onDrop={e => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) readFile(f) }}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".txt,.md,.pdf,.doc,.docx"
                        style={{ display: 'none' }}
                        onChange={e => { const f = e.target.files[0]; if (f) readFile(f) }}
                      />
                      <div className="upload-icon"><Upload size={22} /></div>
                      <div className="upload-primary">Drop your file here, or click to browse</div>
                      <div className="upload-secondary">TXT, Markdown, Word or PDF</div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, marginTop: 16 }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={openDrivePicker}
                        disabled={driveLoading && !driveOpen}
                        style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                      >
                        {driveLoading && !driveOpen ? <Loader size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <FolderOpen size={13} />}
                        Import from Google Drive
                      </button>

                      {driveOpen && (
                        <div style={{
                          width: '100%',
                          border: '1px solid var(--border)', borderRadius: 10,
                          background: 'var(--bg-surface)',
                          boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
                          overflow: 'hidden',
                        }}>
                          <div style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '9px 14px', borderBottom: '1px solid var(--border)',
                            background: 'var(--bg-hover)', gap: 8,
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1, minWidth: 0, flexWrap: 'wrap' }}>
                              <button
                                onClick={() => navigateDriveTo(0)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, color: driveStack.length === 0 ? 'var(--text-primary)' : 'var(--app-accent)', padding: 0, fontFamily: 'var(--font-ui)' }}
                              >
                                My Drive
                              </button>
                              {driveStack.map((folder, i) => (
                                <Fragment key={folder.id}>
                                  <ChevronRight size={11} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                                  <button
                                    onClick={() => navigateDriveTo(i + 1)}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, color: i === driveStack.length - 1 ? 'var(--text-primary)' : 'var(--app-accent)', padding: 0, fontFamily: 'var(--font-ui)', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                                  >
                                    {folder.name}
                                  </button>
                                </Fragment>
                              ))}
                            </div>
                            <button onClick={() => setDriveOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2, display: 'flex', flexShrink: 0 }}>
                              <X size={13} />
                            </button>
                          </div>
                          <div style={{ maxHeight: 280, overflowY: 'auto' }}>
                            {driveLoading ? (
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
                                <Loader size={16} style={{ animation: 'spin 1s linear infinite', color: 'var(--text-muted)' }} />
                              </div>
                            ) : driveItems.length === 0 ? (
                              <div style={{ padding: '16px', fontSize: '0.8125rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                                No files found in this folder.
                              </div>
                            ) : driveItems.map((item, i) => (
                              <button
                                key={item.id}
                                onClick={() => item.isFolder ? navigateDriveFolder(item) : selectDriveFile(item)}
                                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                style={{
                                  display: 'flex', alignItems: 'center', gap: 10,
                                  width: '100%', padding: '9px 14px',
                                  background: 'transparent', border: 'none',
                                  borderBottom: i < driveItems.length - 1 ? '1px solid var(--border)' : 'none',
                                  cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font-ui)',
                                  color: 'var(--text-primary)', transition: 'background 0.1s ease',
                                }}
                              >
                                {item.isFolder
                                  ? <Folder size={14} style={{ color: '#F59E0B', flexShrink: 0 }} />
                                  : <FileText size={14} style={{ color: '#4285F4', flexShrink: 0 }} />
                                }
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontSize: '0.8125rem', fontWeight: item.isFolder ? 600 : 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {item.name}
                                  </div>
                                  {!item.isFolder && item.modifiedTime && (
                                    <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: 1 }}>
                                      {new Date(item.modifiedTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                    </div>
                                  )}
                                </div>
                                {item.isFolder && <ChevronRight size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                    </div>
                  </>
                ) : (
                  <>
                    <div className="upload-zone" style={{ padding: '24px', background: 'rgba(180,83,9,0.03)', borderColor: 'rgba(180,83,9,0.2)', borderStyle: 'solid', cursor: 'default' }}>
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 8 }}>
                        <Check size={16} style={{ color: '#059669', marginTop: 2 }} />
                        <span style={{ fontSize: '0.875rem', color: '#059669', fontWeight: 600 }}>File ready</span>
                      </div>
                      <div className="upload-secondary">Proposal loaded and ready for rehearsal.</div>
                    </div>
                    <div className="uploaded-file-card">
                      <div className="file-icon"><FileText size={18} /></div>
                      <div>
                        <div className="file-name">{proposalName || 'Sample proposal'}</div>
                        <div className="file-size">{proposalText.length} characters</div>
                      </div>
                      <button
                        onClick={() => { setUploaded(false); setProposalText(''); setProposalName('') }}
                        style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                      >
                        <X size={16} />
                      </button>
                    </div>
                  </>
                )}
              </>
            )}

            {/* Step 1: Panel */}
            {step === 1 && (
              <>
                <div className="step-title">Choose your panel</div>
                <div className="step-desc">Select the roles who will challenge you. Minimum 2.</div>
                <div className="role-cards-grid">
                  {allPersonas.map(p => {
                    const isSelected = selected.includes(p.id)
                    return (
                      <div
                        key={p.id}
                        className={`role-card ${isSelected ? 'selected' : ''}`}
                        style={{ color: p.color }}
                        onClick={() => togglePersona(p.id)}
                      >
                        <div className="role-card-header">
                          <div className="role-card-pip" style={{ background: p.color }} />
                          <div className="role-card-title">{p.role}</div>
                        </div>
                        <div className="role-card-cares">
                          Challenges {(Array.isArray(p.cares) ? p.cares[0] : p.cares || '').toLowerCase()}.
                        </div>
                        {isSelected && (
                          <div className="role-card-check">
                            <Check size={11} color="white" />
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </>
            )}

            {/* Step 2: Configure */}
            {step === 2 && (
              <>
                <div className="step-title">Configure your session</div>
                <div className="step-desc">Three quick questions then you are in the room.</div>

                <div className="quick-questions">
                  <div>
                    <div className="question-label">Company size</div>
                    <select className="question-select" value={companySize} onChange={e => setCompanySize(e.target.value)}>
                      <option value="">Select...</option>
                      <option>1 to 50 employees</option>
                      <option>51 to 200 employees</option>
                      <option>201 to 1,000 employees</option>
                      <option>1,000+ employees</option>
                    </select>
                  </div>
                  <div>
                    <div className="question-label">Industry</div>
                    <select className="question-select" value={industry} onChange={e => setIndustry(e.target.value)}>
                      <option value="">Select...</option>
                      <option>Technology</option>
                      <option>Finance and Fintech</option>
                      <option>Healthcare</option>
                      <option>Retail and E-commerce</option>
                      <option>Professional services</option>
                      <option>Other</option>
                    </select>
                  </div>
                  <div>
                    <div className="question-label">What does this panel care most about?</div>
                    <select className="question-select" value={focus} onChange={e => setFocus(e.target.value)}>
                      <option value="">Select...</option>
                      <option>Budget approval</option>
                      <option>Risk and compliance</option>
                      <option>Operational feasibility</option>
                      <option>Strategic alignment</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginTop: 8 }}>
                  <div>
                    <div className="question-label">Panel toughness</div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                      {['Supportive', 'Balanced', 'Tough'].map(t => (
                        <button
                          key={t}
                          onClick={() => setToughness(t)}
                          style={{
                            padding: '7px 12px', borderRadius: 6, fontSize: '0.8125rem', fontWeight: 500,
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

                  <div>
                    <div className="question-label">Turn limit</div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                      {[5, 10, 15, 20, 25].map(n => (
                        <button
                          key={n}
                          onClick={() => setTurnLimit(n)}
                          style={{
                            padding: '7px 11px', borderRadius: 6, fontSize: '0.8125rem', fontWeight: 500,
                            cursor: 'pointer', fontFamily: 'var(--font-ui)', border: '1.5px solid',
                            borderColor: turnLimit === n ? 'var(--text-primary)' : 'var(--border)',
                            background: turnLimit === n ? 'var(--text-primary)' : 'transparent',
                            color: turnLimit === n ? 'white' : 'var(--text-secondary)',
                            transition: 'all 0.15s ease',
                          }}
                        >{n}</button>
                      ))}
                    </div>
                  </div>
                </div>


              </>
            )}
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Navigation */}
      <div className="setup-nav">
        {step > 0 ? (
          <button className="btn btn-ghost" onClick={() => setStep(s => s - 1)}>
            <ArrowLeft size={14} /> Back
          </button>
        ) : <div />}

        {step < STEPS.length - 1 ? (
          <button
            className="btn btn-primary"
            onClick={() => setStep(s => s + 1)}
            disabled={!canContinue()}
            style={{ opacity: canContinue() ? 1 : 0.4, cursor: canContinue() ? 'pointer' : 'not-allowed' }}
          >
            Continue <ArrowRight size={14} />
          </button>
        ) : (
          <button
            className="enter-room-btn"
            onClick={enterRoom}
            disabled={launching}
            style={{ opacity: launching ? 0.7 : 1 }}
          >
            {launching ? (
              <>
                <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} />
                Preparing panel...
              </>
            ) : (
              <>
                Enter the room
                <ArrowRight size={16} />
              </>
            )}
          </button>
        )}
      </div>
    </div>
  )
}
