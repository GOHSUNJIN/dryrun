import { useState } from 'react'
import { motion } from 'framer-motion'
import { Check, X, Copy, RotateCcw, BookOpen, ExternalLink, Loader } from 'lucide-react'
import { PERSONAS } from '../data.js'
import { exportToGoogleDoc } from '../utils/google.js'

const FALLBACK_WEAK_POINTS = [
  {
    label: 'Finance',
    issue: 'Payback period cited without full TCO',
    fix: 'Prepare a three-year total cost of ownership model that includes benefits, tooling, infrastructure and a 15% contingency. Present year-by-year cash flow rather than just year one.',
  },
  {
    label: 'Legal',
    issue: 'No data privacy or compliance plan',
    fix: 'Identify whether personal employee data will be accessed, confirm GDPR/CCPA scope with your DPO and include a vendor DPA checklist in the proposal appendix.',
  },
  {
    label: 'Operations',
    issue: 'Transition ownership gap unaddressed',
    fix: 'Name the person currently responsible for the manual reporting process and document a handoff plan with a 30-day parallel-run period before decommissioning the old workflow.',
  },
]

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1 } },
}
const item = {
  hidden: { opacity: 0, y: 14 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
}

export default function Report({ navigate, session }) {
  const [copied, setCopied] = useState(false)
  const [activeTab, setActiveTab] = useState('conditions')
  const [exporting, setExporting] = useState(false)
  const [docUrl, setDocUrl] = useState(null)

  const hasRealReport = Boolean(session?.reportData?.weak_points?.length)
  const weakPoints    = hasRealReport ? session.reportData.weak_points : FALLBACK_WEAK_POINTS

  const conditions   = session?.conditions || {}
  const condMet      = Object.values(conditions).filter(Boolean).length
  const condTotal    = Object.keys(conditions).length || 11
  const turns        = session?.transcript?.filter(m => m.speaker === 'presenter').length || 6
  const proposalName = session?.proposalName || 'Data Engineering Hires'

  // Snapshot both values once on mount so they don't drift if the page stays open
  const [duration] = useState(() =>
    session?.duration ||
    (session?.startTime
      ? `${Math.floor((Date.now() - session.startTime) / 60000)} min`
      : '')
  )
  const [reportDate] = useState(() =>
    new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  )

  const personas = session?.personaIds?.length
    ? PERSONAS
        .filter(p => session.personaIds.includes(p.id))
        .map(p => ({
          ...p,
          conditions: (p.conditions || []).map(c => ({ ...c, met: conditions[c.id] || false })),
        }))
    : PERSONAS

  const handleExportToDoc = async () => {
    if (docUrl) { window.open(docUrl, '_blank'); return }
    setExporting(true)
    try {
      const url = await exportToGoogleDoc(proposalName, weakPoints, personas, conditions)
      setDocUrl(url)
      window.open(url, '_blank')
    } catch (err) {
      console.error('[Docs] export failed:', err)
    } finally {
      setExporting(false)
    }
  }

  const copyReport = () => {
    const lines = [
      `Session Report: ${proposalName}`,
      `${condMet}/${condTotal} conditions met  |  ${turns} turns  |  ${duration}`,
      '',
      'CONDITIONS',
      ...personas.flatMap(p =>
        (p.conditions || []).map(c => `${c.met ? '[MET]' : '[   ]'} ${p.name} (${p.role}): ${c.text}`)
      ),
      '',
      'WEAK POINTS',
      ...weakPoints.map(w => `${w.label}: ${w.issue}\nFix: ${w.fix}`),
    ]
    navigator.clipboard.writeText(lines.join('\n')).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="page">
      <motion.div variants={container} initial="hidden" animate="show">
        <motion.div variants={item}>
          <div className="report-hero">
            <div className="report-hero-label">Session complete · {reportDate}</div>
            <div className="report-hero-title">
              "Here is what to prepare<br />before the real meeting."
            </div>
            <div className="report-hero-sub">
              {condMet} of {condTotal} conditions met · {turns} turns · {duration} · {proposalName}
            </div>
            <div className="report-actions">
              <button className="btn btn-secondary btn-sm" style={{ background: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.12)', color: '#E8E5DF' }} onClick={() => navigate('debrief')}>
                <BookOpen size={13} /> Open full debrief
              </button>
              <button className="btn btn-secondary btn-sm" style={{ background: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.12)', color: '#E8E5DF' }} onClick={() => navigate('room')}>
                <RotateCcw size={13} /> Rehearse again
              </button>
              <button
                className="btn btn-secondary btn-sm"
                onClick={copyReport}
                style={{
                  background:   copied ? 'rgba(5,150,105,0.18)' : 'rgba(255,255,255,0.08)',
                  borderColor:  copied ? 'rgba(5,150,105,0.4)'  : 'rgba(255,255,255,0.12)',
                  color:        copied ? '#34D399' : '#E8E5DF',
                  transition: 'all 0.2s ease',
                }}
              >
                {copied ? <><Check size={13} /> Copied!</> : <><Copy size={13} /> Copy report</>}
              </button>
              <button
                className="btn btn-secondary btn-sm"
                onClick={handleExportToDoc}
                disabled={exporting}
                style={{ background: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.12)', color: '#E8E5DF' }}
              >
                {exporting
                  ? <><Loader size={13} style={{ animation: 'spin 1s linear infinite' }} /> Exporting...</>
                  : docUrl
                    ? <><ExternalLink size={13} /> Open in Docs</>
                    : <><ExternalLink size={13} /> Export to Docs</>
                }
              </button>
            </div>
          </div>
        </motion.div>

        <motion.div variants={item}>
          <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
            {[
              { id: 'conditions', label: 'Conditions' },
              { id: 'coaching',   label: 'Coaching' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  padding: '8px 16px', border: 'none', background: 'none', cursor: 'pointer',
                  fontFamily: 'var(--font-ui)', fontSize: '0.875rem', fontWeight: 500,
                  color: activeTab === tab.id ? 'var(--text-primary)' : 'var(--text-muted)',
                  borderBottom: activeTab === tab.id ? '2px solid var(--text-primary)' : '2px solid transparent',
                  marginBottom: -1, transition: 'color 0.15s ease',
                }}
              >{tab.label}</button>
            ))}
          </div>

          {activeTab === 'conditions' && (
            <>
              {personas.map(p => {
                const metCount = p.conditions.filter(c => c.met).length
                return (
                  <div key={p.id} className="report-persona-section">
                    <div className="report-persona-header">
                      <div className="report-persona-pip" style={{ background: p.color }} />
                      <div className="report-persona-name">
                        {p.name}{' '}
                        <span style={{ fontFamily: 'var(--font-ui)', fontSize: '0.875rem', fontWeight: 400, color: 'var(--text-secondary)' }}>
                          · {p.role}
                        </span>
                      </div>
                      <div className="report-cond-count">{metCount}/{p.conditions.length} conditions met</div>
                    </div>
                    <div className="report-conditions">
                      {(p.conditions || []).map(c => (
                        <div key={c.id} className="report-condition">
                          <div className={`report-cond-icon ${c.met ? 'met' : 'unmet'}`}>
                            {c.met ? <Check size={11} /> : <X size={11} />}
                          </div>
                          <span className={`report-cond-text ${c.met ? '' : 'unmet'}`}>{c.text}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </>
          )}

          {activeTab === 'coaching' && (
            <div className="weak-points-section">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <div className="section-label" style={{ marginBottom: 0 }}>Top weak points to address</div>
                {!hasRealReport && (
                  <span style={{
                    fontSize: '0.6875rem', fontWeight: 600, padding: '3px 8px', borderRadius: 99,
                    background: 'rgba(245,158,11,0.1)', color: '#D97706',
                    textTransform: 'uppercase', letterSpacing: '0.05em',
                  }}>
                    Sample data
                  </span>
                )}
              </div>
              {weakPoints.map((w, i) => (
                <div key={i} className="weak-point-card">
                  <div className="weak-point-label">{w.label}</div>
                  <div className="weak-point-issue">{w.issue}</div>
                  <div className="weak-point-fix-label">Suggested fix</div>
                  <div className="weak-point-fix">{w.fix}</div>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        <motion.div variants={item}>
          <div style={{ display: 'flex', gap: 10, marginTop: 32, paddingTop: 24, borderTop: '1px solid var(--border)' }}>
            <button className="btn btn-primary btn-lg" onClick={() => navigate('debrief')}>
              <BookOpen size={16} /> Open full debrief
            </button>
            <button className="btn btn-secondary btn-lg" onClick={() => navigate('room')}>
              <RotateCcw size={16} /> Rehearse again
            </button>
            <button className="btn btn-ghost btn-lg" onClick={() => navigate('home')}>
              Home
            </button>
          </div>
        </motion.div>
      </motion.div>
    </div>
  )
}
