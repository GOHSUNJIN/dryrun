import { useState, useRef, useEffect, Fragment, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Upload, FileText, Check, ArrowRight, ArrowLeft, X, Loader, FolderOpen, Folder, ChevronRight, ChevronLeft } from 'lucide-react'
import { PERSONAS } from '../data.js'
import { loadRehearsalDefaults, loadSessions, loadLocalMeetings, loadCalEvents, loadLastPanel, saveLastPanel } from '../utils/storage.js'
import { listDriveItems, listDriveDocs, fetchDocText, isSignedIn } from '../utils/google.js'

const STEPS = ['Upload proposal', 'Choose panel', 'Configure and launch']

const FC_CACHE_PREFIX = 'dryrun_fc_'
const FC_CACHE_TTL = 24 * 60 * 60 * 1000

function hashProposal(text) {
  let h = 0
  for (let i = 0; i < Math.min(text.length, 2000); i++) {
    h = Math.imul(31, h) + text.charCodeAt(i) | 0
  }
  return String(Math.abs(h))
}

function loadFactCheckCache(text) {
  try {
    const entry = JSON.parse(localStorage.getItem(FC_CACHE_PREFIX + hashProposal(text)) || 'null')
    if (entry && Date.now() < entry.expiresAt) return entry.value
  } catch {}
  return ''
}

function saveFactCheckCache(text, value) {
  if (!value) return
  try {
    localStorage.setItem(FC_CACHE_PREFIX + hashProposal(text), JSON.stringify({ value, expiresAt: Date.now() + FC_CACHE_TTL }))
  } catch {}
}

function keywordDetectPanel(text) {
  const t = text.toLowerCase()
  const hits = new Set()

  // Business
  if (/budget|cost\b|roi\b|payback|salary|spend|opex|capex|financial forecast|revenue/.test(t)) hits.add('finance')
  if (/legal\b|contract|liability|indemnity|intellectual property|\bip\b|jurisdiction/.test(t)) hits.add('legal')
  if (/timeline|milestone|rollout|go-live|delivery date|handover|disruption risk|process owner/.test(t)) hits.add('ops')
  if (/headcount|hiring|staff\b|talent|workforce|change management|redundan|people plan/.test(t)) hits.add('hr')
  if (/technical|software|api\b|engineer|architecture|integration|infrastructure|security|system/.test(t)) hits.add('tech')
  if (/marketing|brand|launch|go-to-market|campaign|positioning|audience/.test(t)) hits.add('marketing')
  if (/board|strategy\b|strategic|shareholder|executive|portfolio|competing initiative/.test(t)) hits.add('board')
  if (/verified claim|cited source|evidence.based|fact.check|statistic|quantitative claim/.test(t)) hits.add('factcheck')
  if (/sustainability|carbon|esg|environmental|climate|net.zero|scope [123]/.test(t)) hits.add('sustainability')
  if (/customer success|churn|onboarding|adoption|customer experience|\bcx\b/.test(t)) hits.add('cx')
  if (/\bdpo\b|personal data|data subject|gdpr|data minimis|lawful basis|data processing/.test(t)) hits.add('dpo')

  // Event
  if (/\bevent\b|venue|conference|ceremony|attendee|gala|exhibition/.test(t)) hits.add('event_director')
  if (/event budget|per.pax|per head|event cost|catering cost|event spend/.test(t)) hits.add('event_finance')
  if (/safety|emergency|first aid|evacuation|health and safety|capacity limit/.test(t)) hits.add('event_safety')
  if (/programme|run.of.show|speaker|performer|session plan|dry run|agenda/.test(t)) hits.add('event_programme')

  // Academic
  if (/\bresearch\b|thesis|dissertation|methodology|literature review|hypothesis|\bstudy\b/.test(t)) hits.add('supervisor')
  if (/conclusion|originality|knowledge gap|contribution to.*field|novel finding/.test(t)) hits.add('examiner')
  if (/departmental standard|institutional guideline|internal examiner|abstract.*conclusion/.test(t)) hits.add('internal_examiner')
  if (/ethics|informed consent|bias|harm to participants|vulnerable|ethical approval/.test(t)) hits.add('ethicist')
  if (/real.world application|industry adoption|practitioner|implementation beyond/.test(t)) hits.add('industry_mentor')
  if (/grant|research funder|funding body|impact pathway|dissemination plan|research council/.test(t)) hits.add('research_funder')

  // Startup
  if (/\bstartup\b|pitch deck|seed round|series [abc]|unit economics|\brunway\b|\bvaluation\b|addressable market|\btam\b|venture capital/.test(t)) hits.add('vc')
  if (/\bmvp\b|product roadmap|feature priorit|backlog|user stor|product.market fit/.test(t)) hits.add('product_manager')
  if (/acquisition cost|\bcac\b|\bltv\b|retention rate|growth model|conversion funnel|viral/.test(t)) hits.add('growth')

  // Policy
  if (/public policy|legislation|\bgovernment\b|public sector|policy brief|regulatory framework|policy consultation/.test(t)) hits.add('policy_analyst')
  if (/regulatory approval|licensing requirement|certification|enforcement|regulator\b|compliance timeline/.test(t)) hits.add('regulator')
  if (/community impact|stakeholder consultation|vulnerable group|equitable access|affected community/.test(t)) hits.add('community_rep')

  return [...hits].slice(0, 4)
}

function categoryOfPersona(id) {
  if (['supervisor', 'examiner', 'internal_examiner', 'ethicist', 'industry_mentor', 'research_funder'].includes(id)) return 'academic'
  if (id.startsWith('event_')) return 'event'
  if (['vc', 'product_manager', 'growth'].includes(id)) return 'startup'
  if (['policy_analyst', 'community_rep', 'regulator'].includes(id)) return 'policy'
  return 'business'
}

export default function NewRehearsal({ navigate, session, updateSession, resetSession, navPayload = {} }) {
  const defaults       = loadRehearsalDefaults()
  const [step, setStep]           = useState(0)
  const [proposalText, setProposalText] = useState(navPayload.proposalText || '')
  const [uploaded, setUploaded]   = useState(Boolean(navPayload.proposalText))
  const [proposalName, setProposalName] = useState(navPayload.meetingName || '')
  const [documentName, setDocumentName] = useState('')
  const [drag, setDrag]           = useState(false)
  const [selected, setSelected]   = useState(() => loadLastPanel() || ['general'])
  const [panelCategory, setPanelCategory] = useState('all')
  const [panelPage, setPanelPage] = useState(0)
  const [recommended, setRecommended] = useState([])
  const [toughness, setToughness] = useState(defaults.toughness)
  const [turnLimit, setTurnLimit] = useState(parseInt(defaults.turnLimit) || 15)
  const [linkedMeeting, setLinkedMeeting] = useState(navPayload.linkedMeeting || '')
  const [launching, setLaunching]     = useState(false)
  const [detectingPanel, setDetectingPanel] = useState(false)
  const [driveOpen, setDriveOpen]       = useState(false)
  const [driveLoading, setDriveLoading] = useState(false)
  const [driveError, setDriveError]     = useState(null)
  const [driveItems, setDriveItems]     = useState([])
  const [driveStack, setDriveStack]     = useState([])
  const [recentDocs, setRecentDocs]     = useState([])
  const fileInputRef = useRef(null)

  useEffect(() => {
    if (!isSignedIn()) return
    listDriveDocs().then(docs => setRecentDocs(docs.slice(0, 5))).catch(() => {})
  }, [])

  const togglePersona = (id) => {
    setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id])
  }

  const [fileError, setFileError] = useState('')

  const readFile = useCallback(async (file) => {
    setFileError('')
    const ext = file.name.split('.').pop().toLowerCase()
    setDocumentName(file.name.replace(/\.[^/.]+$/, ''))

    try {
      let text = ''

      if (ext === 'pdf') {
        const { getDocument, GlobalWorkerOptions } = await import('pdfjs-dist')
        GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).href
        const arrayBuffer = await file.arrayBuffer()
        const pdf = await getDocument({ data: arrayBuffer }).promise
        const pages = []
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i)
          const content = await page.getTextContent()
          pages.push(content.items.map(item => item.str).join(' '))
        }
        text = pages.join('\n\n')
      } else if (ext === 'docx') {
        const mammoth = await import('mammoth')
        const arrayBuffer = await file.arrayBuffer()
        const result = await mammoth.extractRawText({ arrayBuffer })
        text = result.value
      } else {
        // txt, md, and anything else treated as plain text
        text = await file.text()
      }

      if (!text.trim()) {
        setFileError('Could not extract text from this file. Try copying the content into a .txt file.')
        return
      }

      setProposalText(text)
      setUploaded(true)
    } catch (err) {
      console.error('[readFile] extraction failed:', err)
      setFileError('Failed to read the file. Make sure it is not password-protected or corrupted.')
    }
  }, [])

  const openDrivePicker = async () => {
    setDriveLoading(true)
    setDriveError(null)
    setDriveStack([])
    try {
      const items = await listDriveItems('root')
      setDriveItems(items)
      setDriveOpen(true)
    } catch (err) {
      console.error('[Drive] failed to open picker:', err)
      setDriveError('Could not connect to Drive. Check your connection and try again.')
      setDriveOpen(true)
    } finally {
      setDriveLoading(false)
    }
  }

  const navigateDriveFolder = async (folder) => {
    setDriveLoading(true)
    setDriveError(null)
    try {
      const items = await listDriveItems(folder.id)
      setDriveItems(items)
      setDriveStack(prev => [...prev, { id: folder.id, name: folder.name }])
    } catch (err) {
      console.error('[Drive] folder nav failed:', err)
      setDriveError('Failed to open folder. Try again.')
    } finally {
      setDriveLoading(false)
    }
  }

  const navigateDriveTo = async (stackIndex) => {
    const newStack = driveStack.slice(0, stackIndex)
    const folderId = newStack[newStack.length - 1]?.id || 'root'
    setDriveLoading(true)
    setDriveError(null)
    try {
      const items = await listDriveItems(folderId)
      setDriveItems(items)
      setDriveStack(newStack)
    } catch (err) {
      console.error('[Drive] breadcrumb nav failed:', err)
      setDriveError('Failed to navigate. Try again.')
    } finally {
      setDriveLoading(false)
    }
  }

  const selectDriveFile = async (file) => {
    setDriveOpen(false)
    setDriveLoading(true)
    setDocumentName(file.name)
    try {
      const text = await fetchDocText(file.id)
      setProposalText(text)
      setUploaded(true)
    } catch (err) {
      console.error('[Drive] failed to fetch doc:', err)
    } finally {
      setDriveLoading(false)
    }
  }

  const canContinue = () => {
    if (step === 0) return uploaded && proposalName.trim().length > 0
    if (step === 1) return selected.length >= 1
    return true
  }

  const handleNext = async () => {
    if (step === 0 && proposalText) {
      setDetectingPanel(true)
      try {
        const allIds = PERSONAS.map(p => p.id)
        console.log('[detect-panel] sending request with available_ids:', allIds)
        const res = await fetch('/api/session/detect-panel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ proposal_text: proposalText, available_ids: allIds }),
        })
        if (res.ok) {
          const data = await res.json()
          console.log('[detect-panel] AI suggested:', data.persona_ids)
          if (data.persona_ids?.length) {
            setSelected(data.persona_ids)
            setRecommended(data.persona_ids)
            setPanelCategory('all')
            setPanelPage(0)
          } else {
            const fallback = keywordDetectPanel(proposalText)
            console.log('[detect-panel] AI returned empty  -  keyword fallback:', fallback)
            if (fallback.length) {
              setSelected(fallback)
              setRecommended(fallback)
              setPanelCategory('all')
              setPanelPage(0)
            } else {
              setSelected(['general'])
              setRecommended([])
            }
          }
        } else {
          const fallback = keywordDetectPanel(proposalText)
          console.warn('[detect-panel] API returned', res.status, ' -  keyword fallback:', fallback)
          if (fallback.length) {
            setSelected(fallback)
            setRecommended(fallback)
            setPanelCategory('all')
            setPanelPage(0)
          } else {
            setSelected([])
            setRecommended([])
          }
        }
      } catch (err) {
        const fallback = keywordDetectPanel(proposalText)
        console.warn('[detect-panel] failed:', err.message, ' -  keyword fallback:', fallback)
        if (fallback.length) {
          setSelected(fallback)
          setRecommended(fallback)
          setPanelCategory('all')
          setPanelPage(0)
        } else {
          setSelected([])
          setRecommended([])
        }
      } finally {
        setDetectingPanel(false)
      }
    }
    setStep(s => s + 1)
  }

  const enterRoom = async () => {
    setLaunching(true)

    const config      = { toughness, turnLimit }
    const sessionBase = {
      proposalText:  proposalText,
      proposalName:  proposalName || 'Untitled proposal',
      personaIds:    selected,
      config,
      startTime:     Date.now(),
      linkedMeeting,
    }

    saveLastPanel(selected)
    const cachedFactCheck = selected.includes('factcheck') ? loadFactCheckCache(proposalText) : ''
    if (cachedFactCheck) console.log('[session/start] using cached fact_check, skipping server call')
    try {
      const res = await fetch('/api/session/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proposal_text: proposalText,
          persona_ids:   selected,
          config,
          fact_check:    cachedFactCheck,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail || `API error ${res.status}`)
      }

      const data = await res.json()
      if (data.fact_check) saveFactCheckCache(proposalText, data.fact_check)
      console.log('[session/start] response:', {
        demo:             data.demo || false,
        demo_reason:      data.demo_reason || null,
        openings_count:   (data.messages || []).length,
        conditions_count: Object.keys(data.conditions || {}).length,
        has_fact_check:   Boolean(data.fact_check),
        fact_check_cached: Boolean(cachedFactCheck),
        openings:         (data.messages || []).map(m => ({ speaker: m.speaker, text: m.text?.slice(0, 60) + '...' })),
      })
      if (data.demo) console.warn('[session/start] AI unavailable, running in demo mode. Reason:', data.demo_reason || 'unknown')
      if (!data.messages?.length) console.warn('[session/start] No opening messages returned  -  room will fall back to demo transcript for matching persona IDs')
      resetSession()
      updateSession({ ...sessionBase, transcript: data.messages || [], conditions: data.conditions || {}, factCheckNotes: data.fact_check || '', demoMode: !!data.demo })
      navigate('room')
    } catch (err) {
      console.error('[session/start] Request failed  -  entering demo mode:', err.message)
      resetSession()
      updateSession({ ...sessionBase, transcript: [], conditions: {}, factCheckNotes: '', demoMode: true })
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
                  <div className="question-label">Rehearsal name</div>
                  <input
                    className="settings-input"
                    value={proposalName}
                    onChange={e => setProposalName(e.target.value)}
                    placeholder="Your rehearsal name"
                    style={{ width: '100%', boxSizing: 'border-box', marginTop: 8 }}
                  />
                </div>

                {(() => {
                  const local = loadLocalMeetings()
                  const cal   = (loadCalEvents() || []).map(m => ({ id: m.id || m.name, name: m.name || m.summary }))
                  const all   = [...local, ...cal]
                  return (
                    <div style={{ marginBottom: 24 }}>
                      <div className="question-label">
                        Link to meeting&nbsp;
                        <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(optional)</span>
                      </div>
                      {all.length === 0 ? (
                        <div style={{
                          marginTop: 8, padding: '10px 14px',
                          border: '1px dashed var(--border)', borderRadius: 8,
                          fontSize: '0.8125rem', color: 'var(--text-muted)',
                        }}>
                          No upcoming meetings. Add them from the Home screen.
                        </div>
                      ) : (
                        <select
                          className="question-select"
                          value={linkedMeeting}
                          onChange={e => setLinkedMeeting(e.target.value)}
                          style={{ width: '100%', marginTop: 8 }}
                        >
                          <option value="">No meeting linked</option>
                          {all.map(m => (
                            <option key={m.id} value={m.name}>{m.name}</option>
                          ))}
                        </select>
                      )}
                    </div>
                  )
                })()}

                {recentDocs.length > 0 && !uploaded && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <FolderOpen size={12} style={{ color: 'var(--app-accent)' }} /> Recent from Drive
                      </span>
                      <button
                        onClick={() => setRecentDocs([])}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.6875rem', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', padding: 0 }}
                      >
                        Clear
                      </button>
                    </div>
                    {recentDocs.map(doc => (
                      <button
                        key={doc.id}
                        onClick={() => selectDriveFile(doc)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          width: '100%', padding: '8px 12px', marginBottom: 4,
                          background: 'var(--bg-surface)', border: '1px solid var(--border)',
                          borderRadius: 7, cursor: 'pointer', textAlign: 'left',
                          fontFamily: 'var(--font-ui)', transition: 'background 0.1s ease',
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-surface)'}
                      >
                        <FileText size={13} style={{ color: '#4285F4', flexShrink: 0 }} />
                        <span style={{ fontSize: '0.8125rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{doc.name}</span>
                        {doc.modifiedTime && (
                          <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', flexShrink: 0 }}>
                            {new Date(doc.modifiedTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}

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
                      <div className="upload-secondary">TXT, Markdown, DOCX or PDF</div>
                    </div>
                    {fileError && (
                      <div style={{ marginTop: 10, padding: '10px 14px', background: 'rgba(220,38,38,0.07)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: 8, fontSize: '0.8125rem', color: '#DC2626' }}>
                        {fileError}
                      </div>
                    )}
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
                            ) : driveError ? (
                              <div style={{ padding: '16px', fontSize: '0.8125rem', color: '#DC2626', textAlign: 'center' }}>
                                {driveError}
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
                        <div className="file-name">{documentName || 'Uploaded document'}</div>
                        <div className="file-size">{proposalText.trim().split(/\s+/).filter(Boolean).length} words</div>
                      </div>
                      <button
                        onClick={() => { setUploaded(false); setProposalText(''); setDocumentName('') }}
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
                <div className="step-desc">Select the roles who will challenge you. Minimum 1.</div>

                {documentName && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16, marginTop: 2 }}>
                    <FileText size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {documentName}
                    </span>
                  </div>
                )}

                {/* Category tabs */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 16, marginTop: 4, flexWrap: 'wrap' }}>
                  {[
                    { key: 'all',      label: 'All' },
                    { key: 'business', label: 'Business' },
                    { key: 'startup',  label: 'Startup' },
                    { key: 'event',    label: 'Event Planning' },
                    { key: 'academic', label: 'Academic' },
                    { key: 'policy',   label: 'Policy' },
                  ].map(({ key, label }) => (
                    <button
                      key={key}
                      onClick={() => { setPanelCategory(key); setPanelPage(0) }}
                      style={{
                        padding: '6px 14px', borderRadius: 20, fontSize: '0.8125rem', fontWeight: 600,
                        cursor: 'pointer', fontFamily: 'var(--font-ui)', border: '1.5px solid',
                        borderColor: panelCategory === key ? 'var(--text-primary)' : 'var(--border)',
                        background: panelCategory === key ? 'var(--text-primary)' : 'transparent',
                        color: panelCategory === key ? 'white' : 'var(--text-secondary)',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {recommended.length > 0 && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 14px', marginBottom: 14,
                    background: 'rgba(180,83,9,0.05)', border: '1px solid rgba(180,83,9,0.18)',
                    borderRadius: 9,
                  }}>
                    <div style={{
                      width: 6, height: 6, borderRadius: '50%',
                      background: 'var(--app-accent)', flexShrink: 0,
                    }} />
                    <span style={{ fontSize: '0.8125rem', color: 'var(--app-accent)', fontWeight: 600 }}>
                      We recommend these panelists for your proposal
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
                      {recommended.length} selected
                    </span>
                  </div>
                )}

                {(() => {
                  const PANEL_PAGE_SIZE = 6
                  const filtered = PERSONAS
                    .filter(p => panelCategory === 'all' || p.category === panelCategory || p.id === 'general')
                    .sort((a, b) => {
                      const as = selected.includes(a.id), bs = selected.includes(b.id)
                      return as === bs ? 0 : as ? -1 : 1
                    })
                  const totalPages = Math.ceil(filtered.length / PANEL_PAGE_SIZE)
                  const pageItems = filtered.slice(panelPage * PANEL_PAGE_SIZE, (panelPage + 1) * PANEL_PAGE_SIZE)
                  return (
                    <>
                      <div className="role-cards-grid">
                        {pageItems.map(p => {
                          const isSelected = selected.includes(p.id)
                          const caresText = Array.isArray(p.cares) ? p.cares[0] : (p.cares || '')
                          const isRecommended = recommended.includes(p.id)
                          return (
                            <div
                              key={p.id}
                              className={`role-card ${isSelected ? 'selected' : ''}`}
                              style={{
                                color: p.color,
                                background: isSelected ? `${p.color}0d` : undefined,
                              }}
                              onClick={() => togglePersona(p.id)}
                            >
                              <div
                                className="role-card-avatar"
                                style={{
                                  background: isSelected ? p.color : `${p.color}1a`,
                                  color: isSelected ? 'white' : p.color,
                                }}
                              >
                                {p.initial}
                              </div>
                              <div className="role-card-body">
                                <div className="role-card-title">{p.role}</div>
                                <div className="role-card-cares">{caresText}</div>
                              </div>
                              {isSelected ? (
                                <div className="role-card-check">
                                  <Check size={10} color="white" />
                                </div>
                              ) : isRecommended ? (
                                <div className="role-card-rec-dot" style={{ background: p.color }} />
                              ) : null}
                            </div>
                          )
                        })}
                      </div>
                      {totalPages > 1 && (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => setPanelPage(p => Math.max(0, p - 1))}
                            disabled={panelPage === 0}
                            style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                          >
                            <ChevronLeft size={13} /> Prev
                          </button>
                          <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                            {panelPage + 1} / {totalPages}
                          </span>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => setPanelPage(p => Math.min(totalPages - 1, p + 1))}
                            disabled={panelPage >= totalPages - 1}
                            style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                          >
                            Next <ChevronRight size={13} />
                          </button>
                        </div>
                      )}
                    </>
                  )
                })()}
              </>
            )}

            {/* Step 2: Configure */}
            {step === 2 && (
              <>
                <div className="step-title">Configure your session</div>
                <div className="step-desc">Set how hard the panel pushes and how long your session runs.</div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 28, marginTop: 8 }}>
                  <div>
                    <div className="question-label">Panel toughness</div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                      {[
                        { value: 'Supportive', desc: 'Constructive and encouraging' },
                        { value: 'Balanced',   desc: 'Firm but fair' },
                        { value: 'Tough',      desc: 'Hard challenges, minimal concessions' },
                      ].map(({ value, desc }) => (
                        <button
                          key={value}
                          onClick={() => setToughness(value)}
                          style={{
                            flex: 1, padding: '12px 14px', borderRadius: 8, textAlign: 'left',
                            cursor: 'pointer', fontFamily: 'var(--font-ui)', border: '1.5px solid',
                            borderColor: toughness === value ? 'var(--text-primary)' : 'var(--border)',
                            background: toughness === value ? 'var(--text-primary)' : 'transparent',
                            color: toughness === value ? 'white' : 'var(--text-secondary)',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <div style={{ fontWeight: 600, fontSize: '0.8125rem', marginBottom: 3 }}>{value}</div>
                          <div style={{ fontSize: '0.6875rem', opacity: 0.7, lineHeight: 1.3 }}>{desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="question-label">Turn limit</div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                      {[5, 10, 15, 20, 25].map(n => (
                        <button
                          key={n}
                          onClick={() => setTurnLimit(n)}
                          style={{
                            padding: '9px 14px', borderRadius: 8, fontSize: '0.875rem', fontWeight: 600,
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
            onClick={handleNext}
            disabled={!canContinue() || detectingPanel}
            style={{ opacity: (canContinue() && !detectingPanel) ? 1 : 0.4, cursor: (canContinue() && !detectingPanel) ? 'pointer' : 'not-allowed' }}
          >
            {detectingPanel ? <><Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> Analysing...</> : <>Continue <ArrowRight size={14} /></>}
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
