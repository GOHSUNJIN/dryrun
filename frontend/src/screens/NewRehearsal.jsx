import { useState, useRef, useEffect, Fragment, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Upload, FileText, Check, ArrowRight, ArrowLeft, X, Loader, FolderOpen, Folder, ChevronRight, ChevronLeft } from 'lucide-react'
import { PERSONAS } from '../data.js'
import { loadRehearsalDefaults, loadSessions, loadLocalMeetings, loadCalEvents, loadLastPanel, saveLastPanel, loadCustomPersonas } from '../utils/storage.js'
import { fetchWithRetry } from '../utils/api.js'
import { listDriveItems, listDriveDocs, fetchDocText, isSignedIn } from '../utils/google.js'

const STEPS = ['Upload Proposal', 'Choose Panel', 'Configure and Launch']

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

const MAX_PANEL = 5

function keywordDetectPanel(text) {
  const t = text.toLowerCase()
  const scores = {}
  const hit = (id, w = 1) => { scores[id] = (scores[id] || 0) + w }

  // Business - Finance
  if (/\bbudget\b|\bcost\b|\broi\b|\bpayback\b|break.even|return on investment/.test(t)) hit('finance', 2)
  if (/\brevenue\b|forecast|\bprofit\b|\bopex\b|\bcapex\b|financial model|cash flow|p&l/.test(t)) hit('finance', 1)

  // Business - Legal
  if (/\blegal\b|contract\b|liability|indemnity|intellectual property|\bip\b|jurisdiction|compliance/.test(t)) hit('legal', 2)
  if (/\bnda\b|non-disclosure|copyright|trademark|patent|terms of service|regulatory requirement/.test(t)) hit('legal', 1)

  // Business - Ops
  if (/timeline|milestone|rollout|go-live|delivery date|handover|process owner|operational/.test(t)) hit('ops', 2)
  if (/implementation|workflow|logistics|resource allocation|capacity plan|supply chain/.test(t)) hit('ops', 1)

  // Business - HR
  if (/headcount|hiring|\bstaff\b|talent|workforce|change management|redundan|people plan/.test(t)) hit('hr', 2)
  if (/training|team structure|employee|culture|performance management|onboarding.*staff/.test(t)) hit('hr', 1)

  // Business - Tech
  if (/technical|software|\bapi\b|engineer|architecture|integration|infrastructure|security|system/.test(t)) hit('tech', 2)
  if (/database|\bcloud\b|scalability|platform|tech stack|deployment|devops|automation/.test(t)) hit('tech', 1)

  // Business - Marketing
  if (/marketing|brand|\blaunch\b|go-to-market|campaign|positioning|target audience/.test(t)) hit('marketing', 2)
  if (/\bseo\b|social media|content strategy|\bpr\b|communications|demand generation/.test(t)) hit('marketing', 1)

  // Business - Board
  if (/\bboard\b|strategy\b|strategic|shareholder|executive|portfolio|competing initiative/.test(t)) hit('board', 2)
  if (/vision|long.term|governance|c-suite|\bceo\b|\bcfo\b|\bcto\b|steering committee/.test(t)) hit('board', 1)

  // Fact check
  if (/cited source|evidence.based|fact.check|statistic|data shows|according to|study found/.test(t)) hit('factcheck', 2)
  if (/\bsource\b|reference|quantitative|benchmark|verified|research finding/.test(t)) hit('factcheck', 1)

  // Sustainability
  if (/sustainability|carbon|esg|environmental|climate|net.zero|scope [123]/.test(t)) hit('sustainability', 2)
  if (/emissions|\bgreen\b|renewable|social impact|responsible|circular economy/.test(t)) hit('sustainability', 1)

  // CX
  if (/customer success|churn|customer experience|\bcx\b|user adoption/.test(t)) hit('cx', 2)
  if (/user satisfaction|\bnps\b|customer journey|support ticket|retention|loyalty/.test(t)) hit('cx', 1)

  // DPO
  if (/\bdpo\b|personal data|data subject|gdpr|lawful basis|data processing/.test(t)) hit('dpo', 2)
  if (/privacy|data protection|\bcookies\b|\bconsent\b|\bpii\b|data breach/.test(t)) hit('dpo', 1)

  // Event
  if (/\bevent\b|venue|conference|ceremony|attendee|gala|exhibition/.test(t)) hit('event_director', 2)
  if (/event budget|per.pax|per head|event cost|catering|event spend/.test(t)) hit('event_finance', 2)
  if (/safety|emergency|first aid|evacuation|health and safety|capacity limit/.test(t)) hit('event_safety', 1)
  if (/programme|run.of.show|speaker|performer|session plan|agenda/.test(t)) hit('event_programme', 1)

  // Academic
  if (/\bresearch\b|thesis|dissertation|methodology|literature review|hypothesis|\bstudy\b/.test(t)) hit('supervisor', 2)
  if (/research question|data collection|qualitative|quantitative study|\bsurvey\b|interview method/.test(t)) hit('supervisor', 1)
  if (/originality|knowledge gap|contribution to.*field|novel finding/.test(t)) hit('examiner', 2)
  if (/departmental standard|institutional guideline|internal examiner/.test(t)) hit('internal_examiner', 2)
  if (/ethics|informed consent|\bbias\b|harm to participants|ethical approval/.test(t)) hit('ethicist', 2)
  if (/real.world application|industry adoption|practitioner|implementation beyond/.test(t)) hit('industry_mentor', 1)
  if (/grant|research funder|funding body|impact pathway|dissemination|research council/.test(t)) hit('research_funder', 2)

  // Startup
  if (/\bstartup\b|pitch deck|seed round|series [abc]|unit economics|\brunway\b|\bvaluation\b|venture capital/.test(t)) hit('vc', 2)
  if (/addressable market|\btam\b|\bsam\b|\bsom\b|investor|raise funding|term sheet/.test(t)) hit('vc', 1)
  if (/\bmvp\b|product roadmap|feature priorit|backlog|user stor|product.market fit/.test(t)) hit('product_manager', 2)
  if (/user research|prototype|iteration|\bsprint\b|agile|product vision|use case/.test(t)) hit('product_manager', 1)
  if (/acquisition cost|\bcac\b|\bltv\b|retention rate|growth model|conversion funnel|viral/.test(t)) hit('growth', 2)
  if (/growth rate|user growth|\btraffic\b|paid acquisition|organic growth/.test(t)) hit('growth', 1)

  // Policy
  if (/public policy|legislation|\bgovernment\b|public sector|policy brief|regulatory framework/.test(t)) hit('policy_analyst', 2)
  if (/policy consultation|public interest|\bminister\b|parliament|civil service/.test(t)) hit('policy_analyst', 1)
  if (/regulatory approval|licensing requirement|certification|enforcement|regulator\b|compliance timeline/.test(t)) hit('regulator', 2)
  if (/community impact|stakeholder consultation|vulnerable group|equitable access|affected community/.test(t)) hit('community_rep', 2)

  return Object.entries(scores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_PANEL)
    .map(([id]) => id)
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
  const [step, setStep]           = useState(navPayload.proposalText ? 1 : 0)
  const [proposalText, setProposalText] = useState(navPayload.proposalText || '')
  const [uploaded, setUploaded]   = useState(Boolean(navPayload.proposalText))
  const [proposalName, setProposalName] = useState(navPayload.meetingName || '')
  const [documentName, setDocumentName] = useState(navPayload.documentName || '')
  const [drag, setDrag]           = useState(false)
  const [selected, setSelected]   = useState(() => (navPayload.personaIds?.length ? navPayload.personaIds : null) || loadLastPanel() || ['general'])
  const [panelCategory, setPanelCategory] = useState('all')
  const [panelPage, setPanelPage] = useState(0)
  const [recommended, setRecommended] = useState([])
  const [toughness, setToughness] = useState(navPayload.toughness || defaults.toughness)
  const [turnLimit, setTurnLimit] = useState(parseInt(navPayload.turnLimit) || parseInt(defaults.turnLimit) || 15)
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
  const [customPersonas] = useState(() => loadCustomPersonas())

  useEffect(() => {
    if (!isSignedIn()) return
    listDriveDocs().then(docs => setRecentDocs(docs.slice(0, 5))).catch(err => console.warn('[Drive] recent docs failed:', err.message))
  }, [])

  const togglePersona = (id) => {
    setSelected(s => {
      if (s.includes(id)) return s.filter(x => x !== id)
      if (s.length >= MAX_PANEL) return s
      return [...s, id]
    })
  }

  const [fileError, setFileError] = useState('')
  const [extractionStage, setExtractionStage] = useState('')
  const [pasteMode, setPasteMode] = useState(false)
  const [pasteText, setPasteText] = useState('')

  function cleanText(raw) {
    const lines = raw.split('\n')
    const freq = {}
    for (const line of lines) {
      const t = line.trim()
      if (t.length > 0 && t.length < 60) freq[t] = (freq[t] || 0) + 1
    }
    return lines
      .filter(line => {
        const t = line.trim()
        if (!t) return true
        if (/^\d{1,4}$/.test(t)) return false
        // Only strip short lines that repeat 5+ times (true headers/footers, not content)
        if (t.length < 60 && freq[t] >= 5) return false
        return true
      })
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  }

  function fileToArrayBuffer(file) {
    if (typeof file.arrayBuffer === 'function') return file.arrayBuffer()
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.onerror = reject
      reader.readAsArrayBuffer(file)
    })
  }

  function fileToText(file) {
    if (typeof file.text === 'function') return file.text()
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.onerror = reject
      reader.readAsText(file)
    })
  }

  const readFile = useCallback(async (file) => {
    setFileError('')
    setExtractionStage('Reading file...')
    const ext = file.name.split('.').pop().toLowerCase()
    setDocumentName(file.name.replace(/\.[^/.]+$/, ''))

    try {
      let text = ''

      if (ext === 'pdf') {
        const { getDocument, GlobalWorkerOptions } = await import('pdfjs-dist')
        GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).href
        const arrayBuffer = await fileToArrayBuffer(file)
        const pdf = await getDocument({ data: arrayBuffer }).promise
        const pageCount = pdf.numPages

        // Try text-layer extraction first
        const pageTexts = []
        for (let i = 1; i <= pageCount; i++) {
          const page = await pdf.getPage(i)
          const content = await page.getTextContent()
          pageTexts.push(
            content.items.map(item => item.str + (item.hasEOL ? '\n' : '')).join('')
          )
        }
        const rawText = pageTexts.join('\n\n')
        const wordsPerPage = rawText.trim().split(/\s+/).filter(Boolean).length / pageCount

        if (wordsPerPage < 30) {
          // Image-based PDF or scanned document: use Gemini vision
          setExtractionStage('Scanned document detected. Using AI to read...')
          const MAX_PAGES = Math.min(pageCount, 10)
          const base64Pages = []
          for (let i = 1; i <= MAX_PAGES; i++) {
            const page = await pdf.getPage(i)
            const viewport = page.getViewport({ scale: 1.5 })
            const canvas = document.createElement('canvas')
            canvas.width = viewport.width
            canvas.height = viewport.height
            await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise
            base64Pages.push(canvas.toDataURL('image/jpeg', 0.8).split(',')[1])
          }
          const res = await fetchWithRetry('/api/extract-document', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pages: base64Pages, filename: file.name }),
          })
          if (!res.ok) throw new Error(`Vision extraction failed (${res.status})`)
          const data = await res.json()
          if (data.error && !data.text) throw new Error(data.error)
          text = data.text || ''
        } else {
          text = cleanText(rawText)
        }

      } else if (ext === 'docx') {
        const mammoth = await import('mammoth')
        const arrayBuffer = await fileToArrayBuffer(file)
        const result = await mammoth.extractRawText({ arrayBuffer })
        text = cleanText(result.value)

      } else if (ext === 'pptx') {
        setExtractionStage('Extracting slides...')
        const JSZip = (await import('jszip')).default
        const arrayBuffer = await fileToArrayBuffer(file)
        const zip = await JSZip.loadAsync(arrayBuffer)
        const slideFiles = Object.keys(zip.files)
          .filter(n => /^ppt\/slides\/slide\d+\.xml$/.test(n))
          .sort((a, b) => {
            const na = parseInt(a.match(/\d+/)?.[0] || 0)
            const nb = parseInt(b.match(/\d+/)?.[0] || 0)
            return na - nb
          })
        const slides = []
        for (const name of slideFiles) {
          const xml = await zip.files[name].async('text')
          const matches = [...xml.matchAll(/<a:t(?:\s[^>]*)?>([^<]*)<\/a:t>/g)]
          const slideText = matches.map(m => m[1]).filter(Boolean).join(' ')
          if (slideText.trim()) slides.push(slideText.trim())
        }
        text = slides.join('\n\n')

      } else if (ext === 'doc') {
        setExtractionStage('')
        setFileError('Old .doc format is not supported. Open the file in Word and save as .docx, then upload again.')
        return

      } else {
        text = await fileToText(file)
      }

      if (!text.trim()) {
        setFileError('Could not extract any text from this file. Try saving it as a .txt or .docx and uploading again.')
        setExtractionStage('')
        return
      }

      setProposalText(text)
      setUploaded(true)
    } catch (err) {
      console.error('[readFile] extraction failed:', err)
      if (err?.message?.toLowerCase().includes('failed to fetch') || err?.message?.toLowerCase().includes('dynamically imported')) {
        setFileError('Page needs a refresh. Press Ctrl+Shift+R (or Cmd+Shift+R on Mac) and try uploading again.')
      } else {
        setFileError('Failed to read the file. ' + (err.message || 'Make sure it is not password-protected or corrupted.'))
      }
    } finally {
      setExtractionStage('')
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
      setDriveError('Failed to load document. Try again.')
      setDriveOpen(true)
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
        const res = await fetchWithRetry('/api/session/detect-panel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ proposal_text: proposalText, available_ids: allIds }),
        })
        if (res.ok) {
          const data = await res.json()
          if (data.persona_ids?.length) {
            setSelected(data.persona_ids)
            setRecommended(data.persona_ids)
            setPanelCategory('all')
            setPanelPage(0)
          } else {
            const fallback = keywordDetectPanel(proposalText)
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
            setSelected(['general'])
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
          setSelected(['general'])
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
    const customPersonaDefs = {}
    for (const p of customPersonas) {
      if (selected.includes(p.id)) {
        customPersonaDefs[p.id] = {
          name:           p.name,
          role:           p.role,
          speaking_style: p.speaking_style || '',
          cares:          Array.isArray(p.cares) ? p.cares.join(', ') : (p.cares || ''),
          conditions:     p.conditions || [],
        }
      }
    }
    const sessionBase = {
      proposalText:      proposalText,
      proposalName:      proposalName || 'Untitled proposal',
      documentName:      documentName || '',
      personaIds:        selected,
      config,
      startTime:         Date.now(),
      linkedMeeting,
      customPersonaDefs,
    }

    saveLastPanel(selected)
    const cachedFactCheck = selected.includes('factcheck') ? loadFactCheckCache(proposalText) : ''
    try {
      const res = await fetchWithRetry('/api/session/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proposal_text:   proposalText,
          persona_ids:     selected,
          config,
          fact_check:      cachedFactCheck,
          custom_personas: customPersonaDefs,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail || `API error ${res.status}`)
      }

      const data = await res.json()
      if (data.fact_check) saveFactCheckCache(proposalText, data.fact_check)
      resetSession()
      updateSession({ ...sessionBase, transcript: data.messages || [], conditions: data.conditions || {}, factCheckNotes: data.fact_check || '', demoMode: !!data.demo, demoReason: data.demo_reason || '' })
      navigate('room')
    } catch (err) {
      console.error('[session/start] Request failed  -  entering demo mode:', err.message)
      resetSession()
      updateSession({ ...sessionBase, transcript: [], conditions: {}, factCheckNotes: '', demoMode: true, demoReason: 'connection_failed' })
      navigate('room')
    }
  }

  return (
    <div className="setup-container">
      <button
        onClick={() => navigate('home')}
        style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8125rem', color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', marginBottom: 28, fontFamily: 'var(--font-ui)' }}
      >
        <ArrowLeft size={14} /> Back to Home
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
                <div className="step-title">Upload Your Proposal</div>
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
                      className={`upload-zone ${drag ? 'drag-over' : ''} ${extractionStage ? 'drag-over' : ''}`}
                      onDragOver={e => { e.preventDefault(); setDrag(true) }}
                      onDragLeave={() => setDrag(false)}
                      onDrop={e => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) readFile(f) }}
                      onClick={() => !extractionStage && fileInputRef.current?.click()}
                      style={{ cursor: extractionStage ? 'default' : 'pointer' }}
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".txt,.md,.pdf,.doc,.docx,.pptx,text/plain,text/markdown,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                        style={{ display: 'none' }}
                        onChange={e => { const f = e.target.files[0]; if (f) readFile(f) }}
                      />
                      {extractionStage ? (
                        <>
                          <div className="upload-icon"><Loader size={22} style={{ animation: 'spin 1s linear infinite' }} /></div>
                          <div className="upload-primary">{extractionStage}</div>
                          <div className="upload-secondary">This may take a moment for large documents</div>
                        </>
                      ) : (
                        <>
                          <div className="upload-icon"><Upload size={22} /></div>
                          <div className="upload-primary">Drop your file here, or click to browse</div>
                          <div className="upload-secondary">PDF, DOCX, PPTX, TXT or Markdown</div>
                        </>
                      )}
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

                    {!pasteMode ? (
                      <button
                        onClick={() => { setPasteMode(true); setFileError('') }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8125rem', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', padding: '4px 0', textDecoration: 'underline' }}
                      >
                        or paste text directly
                      </button>
                    ) : (
                      <div style={{ width: '100%' }}>
                        <textarea
                          autoFocus
                          value={pasteText}
                          onChange={e => setPasteText(e.target.value)}
                          placeholder="Paste your proposal text here..."
                          autoComplete="off"
                          autoCorrect="off"
                          autoCapitalize="off"
                          spellCheck="false"
                          style={{
                            width: '100%', minHeight: 160, padding: '12px 14px', boxSizing: 'border-box',
                            fontFamily: 'var(--font-ui)', fontSize: '0.875rem', lineHeight: 1.6,
                            border: '1px solid var(--border)', borderRadius: 8, resize: 'vertical',
                            background: 'var(--bg-surface)', color: 'var(--text-primary)', outline: 'none',
                          }}
                        />
                        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                          <button
                            className="btn btn-primary btn-sm"
                            disabled={pasteText.trim().split(/\s+/).filter(Boolean).length < 20}
                            onClick={() => {
                              const text = pasteText.trim()
                              setProposalText(text)
                              setDocumentName('Pasted text')
                              setUploaded(true)
                              setPasteMode(false)
                              setPasteText('')
                            }}
                          >
                            Use this text
                          </button>
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => { setPasteMode(false); setPasteText('') }}
                          >
                            Cancel
                          </button>
                        </div>
                        {pasteText.trim().split(/\s+/).filter(Boolean).length < 20 && pasteText.length > 0 && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 6 }}>
                            Keep going - need at least 20 words for a useful session.
                          </div>
                        )}
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
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
                  <div className="step-title" style={{ margin: 0 }}>Choose Your Panel</div>
                  <div style={{
                    fontFamily: 'var(--font-ui)', fontSize: '0.8125rem', fontWeight: 600,
                    color: selected.length >= MAX_PANEL ? 'var(--app-accent)' : 'var(--text-muted)',
                  }}>
                    {selected.length}/{MAX_PANEL}
                  </div>
                </div>
                <div className="step-desc">
                  Select up to {MAX_PANEL} roles.{selected.length >= MAX_PANEL ? ' Deselect one to swap.' : ''}
                </div>

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
                    ...(customPersonas.length > 0 ? [{ key: 'custom', label: 'Custom' }] : []),
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
                      We Recommend These Panelists for Your Proposal
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: 'auto', whiteSpace: 'nowrap', flexShrink: 0 }}>
                      {recommended.length} selected
                    </span>
                  </div>
                )}

                {(() => {
                  const PANEL_PAGE_SIZE = 6
                  const allPersonas = [
                    ...PERSONAS,
                    ...customPersonas.map(p => ({ ...p, category: 'custom' })),
                  ]
                  const filtered = allPersonas
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
                          const isDisabled = !isSelected && selected.length >= MAX_PANEL
                          return (
                            <div
                              key={p.id}
                              className={`role-card ${isSelected ? 'selected' : ''}`}
                              style={{
                                color: p.color,
                                background: isSelected ? `${p.color}0d` : undefined,
                                opacity: isDisabled ? 0.38 : 1,
                                cursor: isDisabled ? 'not-allowed' : 'pointer',
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
                <div className="step-title">Configure Your Session</div>
                <div className="step-desc">Set how hard the panel pushes and how long your session runs.</div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 28, marginTop: 8 }}>
                  <div>
                    <div className="question-label">Panel toughness</div>
                    <div className="toughness-cards">
                      {[
                        { value: 'Supportive', desc: 'Constructive and encouraging' },
                        { value: 'Balanced',   desc: 'Firm but fair' },
                        { value: 'Tough',      desc: 'Hard challenges, minimal concessions' },
                      ].map(({ value, desc }) => (
                        <button
                          key={value}
                          className={`toughness-card${toughness === value ? ' selected' : ''}`}
                          onClick={() => setToughness(value)}
                        >
                          <div className="toughness-card-name">{value}</div>
                          <div className="toughness-card-desc">{desc}</div>
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
