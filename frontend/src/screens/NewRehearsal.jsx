import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Upload, FileText, Check, ArrowRight, ArrowLeft, X, Loader } from 'lucide-react'
import { PERSONAS } from '../data.js'
import { loadCustomPersonas, loadRehearsalDefaults } from '../utils/storage.js'

const STEPS = ['Upload proposal', 'Choose panel', 'Configure and launch']

const SAMPLE_PROPOSAL = `Title: Data Engineering Team Hire

Summary: We propose hiring two senior data engineers at $120,000 per year each to automate our monthly sales reporting process, which currently consumes 30 hours of analyst time each month.

Business case: Our analytics team manually compiles sales data from three systems (Salesforce, AWS Redshift and our internal CRM) every month. This process takes 30 hours and is error-prone. In Q3 2024 an error caused incorrect figures to be presented to the board.

Proposed solution: Hire two senior data engineers to build an automated pipeline using Apache Airflow and dbt. The pipeline consolidates all three data sources into a single warehouse and generates the monthly report automatically.

Cost: $240,000 per year in base salary.
Expected savings: 30 analyst hours per month and elimination of reporting errors.
Timeline: 6 months from hire to full deployment.`

function buildCustomDefs(customPersonas) {
  const defs = {}
  for (const p of customPersonas) {
    defs[p.id] = { name: p.name, role: p.role, speaking_style: p.speaking_style || '', cares: (p.cares || []).join(', '), conditions: p.conditions || [] }
  }
  return defs
}

export default function NewRehearsal({ navigate, session, updateSession, resetSession }) {
  const customPersonas = loadCustomPersonas()
  const allPersonas    = [...PERSONAS, ...customPersonas]
  const defaults       = loadRehearsalDefaults()
  const [step, setStep]           = useState(0)
  const [uploaded, setUploaded]   = useState(false)
  const [proposalText, setProposalText] = useState('')
  const [proposalName, setProposalName] = useState('')
  const [drag, setDrag]           = useState(false)
  const [selected, setSelected]   = useState(['finance', 'legal', 'ops', 'factcheck'])
  const [toughness, setToughness] = useState(defaults.toughness)
  const [turnLimit, setTurnLimit] = useState(15)
  const [industry, setIndustry]   = useState('')
  const [companySize, setCompanySize] = useState('')
  const [focus, setFocus]         = useState('')
  const [launching, setLaunching] = useState(false)
  const fileInputRef = useRef(null)

  const togglePersona = (id) => {
    setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id])
  }

  const readFile = (file) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      setProposalText(e.target.result)
      setProposalName(file.name.replace(/\.[^.]+$/, ''))
      setUploaded(true)
    }
    reader.readAsText(file)
  }

  const useSampleProposal = () => {
    setProposalText(SAMPLE_PROPOSAL)
    setProposalName('Data Engineering Hires')
    setUploaded(true)
  }

  const canContinue = () => {
    if (step === 0) return uploaded
    if (step === 1) return selected.length >= 2
    return true
  }

  const enterRoom = async () => {
    setLaunching(true)
    resetSession()

    const text = proposalText || SAMPLE_PROPOSAL
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
      })
      navigate('room')
    } catch (err) {
      console.error('[NewRehearsal] session/start failed:', err)
      // AI unavailable, enter room in demo mode
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
                <div className="step-desc">Drag in a PDF or text file, or use the sample proposal to try the demo.</div>

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
                    <div style={{ textAlign: 'center', marginTop: 16 }}>
                      <button className="btn btn-secondary btn-sm" onClick={useSampleProposal}>
                        Use sample proposal
                      </button>
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
