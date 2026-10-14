import { useState } from 'react'
import { motion } from 'framer-motion'
import { Check, X, Copy, RotateCcw, BookOpen, ExternalLink, Loader, ArrowLeft } from 'lucide-react'
import { PERSONAS } from '../data.js'
import { exportToGoogleDoc } from '../utils/google.js'
import { useToast } from '../components/Toast.jsx'
import ToastStack from '../components/Toast.jsx'


const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1 } },
}
const item = {
  hidden: { opacity: 0, y: 14 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
}

export default function Report({ navigate, session }) {
  const [copied, setCopied]       = useState(false)
  const [activeTab, setActiveTab] = useState('conditions')
  const [exporting, setExporting] = useState(false)
  const [docUrl, setDocUrl]       = useState(null)
  const [exportError, setExportError] = useState(null)
  const { toasts, show: showToast } = useToast()

  const isDemoReport  = Boolean(session?.reportData?.demo) || !session?.reportData?.weak_points?.length
  const hasRealReport = !isDemoReport
  const weakPoints    = hasRealReport ? session.reportData.weak_points : []

  const conditions   = session?.conditions || {}
  const condMet      = Object.values(conditions).filter(Boolean).length
  const condTotal    = Object.keys(conditions).length
  const turns        = session?.transcript?.filter(m => m.speaker === 'presenter').length ?? 0
  const proposalName = session?.proposalName || 'Untitled proposal'

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
    setExportError(null)
    try {
      const url = await exportToGoogleDoc(proposalName, weakPoints, personas, conditions)
      setDocUrl(url)
      window.open(url, '_blank')
      showToast('Report exported to Google Docs')
    } catch (err) {
      console.error('[Docs] export failed:', err)
      setExportError('Export failed. Sign in to Google and try again.')
      showToast('Export failed. Sign in to Google and try again.', 'error')
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
    navigator.clipboard.writeText(lines.join('\n')).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      showToast('Report copied to clipboard')
    }).catch(() => {
      showToast('Could not copy — check browser clipboard permissions', 'error')
    })
  }

  return (
    <div className="page">
      <ToastStack toasts={toasts} />
      <button
        onClick={() => navigate('home')}
        style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8125rem', color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', marginBottom: 20, fontFamily: 'var(--font-ui)', padding: 0 }}
      >
        <ArrowLeft size={14} /> Home
      </button>
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
                title="Requires a Google account. You will be prompted to sign in if needed."
                style={{
                  background: exportError ? 'rgba(220,38,38,0.1)' : 'rgba(255,255,255,0.08)',
                  borderColor: exportError ? 'rgba(220,38,38,0.3)' : 'rgba(255,255,255,0.12)',
                  color: exportError ? '#F87171' : '#E8E5DF',
                }}
              >
                {exporting
                  ? <><Loader size={13} style={{ animation: 'spin 1s linear infinite' }} /> Exporting...</>
                  : exportError
                    ? <><ExternalLink size={13} /> Retry export</>
                    : docUrl
                      ? <><ExternalLink size={13} /> Open in Docs</>
                      : <><ExternalLink size={13} /> Export to Docs</>
                }
              </button>
            </div>
          </div>
        </motion.div>

        {isDemoReport && (
          <motion.div variants={item}>
            <div style={{
              marginBottom: 16, padding: '10px 16px', borderRadius: 8,
              background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)',
              fontSize: '0.8125rem', color: '#D97706',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <span style={{ fontWeight: 600 }}>AI report unavailable</span>
. Coaching was not generated for this session.
            </div>
          </motion.div>
        )}

        <motion.div variants={item}>
          <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
            {[
              { id: 'conditions', label: 'Conditions' },
              { id: 'coaching',   label: 'Coaching' },
              ...(session?.proposalText ? [{ id: 'proposal', label: 'Proposal' }] : []),
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
              <div className="section-label" style={{ marginBottom: 16 }}>Top weak points to address</div>
              {weakPoints.length === 0 ? (
                <div style={{
                  padding: '32px 24px', borderRadius: 10, textAlign: 'center',
                  background: 'var(--bg-surface)', border: '1px solid var(--border)',
                  color: 'var(--text-muted)', fontSize: '0.875rem', lineHeight: 1.6,
                }}>
                  AI coaching was not generated for this session.<br />
                  Start a new rehearsal with the AI service available to receive personalised coaching.
                </div>
              ) : weakPoints.map((w, i) => (
                <div key={i} className="weak-point-card">
                  <div className="weak-point-label">{w.label}</div>
                  <div className="weak-point-issue">{w.issue}</div>
                  <div className="weak-point-fix-label">Suggested fix</div>
                  <div className="weak-point-fix">{w.fix}</div>
                </div>
              ))}
            </div>
          )}
          {activeTab === 'proposal' && (
            <div style={{
              whiteSpace: 'pre-wrap', fontSize: '0.875rem', lineHeight: 1.75,
              color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)',
              background: 'var(--bg-surface)', border: '1px solid var(--border)',
              borderRadius: 10, padding: '20px 24px', maxHeight: 480, overflowY: 'auto',
            }}>
              {session.proposalText}
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
