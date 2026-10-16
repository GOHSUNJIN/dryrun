import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Check, X, Copy, RotateCcw, BookOpen, ExternalLink, Loader, Home, FileText, Trash2 } from 'lucide-react'
import { PERSONAS } from '../data.js'
import { exportToGoogleDoc } from '../utils/google.js'
import ToastStack, { useToast } from '../components/Toast.jsx'
import { nextSessionName, deleteSession, loadCustomPersonas } from '../utils/storage.js'


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

  useEffect(() => {
    if (!session?.proposalText && !session?.reportData) navigate('home')
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleDelete = () => {
    if (!session?.id) return
    if (!window.confirm('Delete this run? This cannot be undone.')) return
    deleteSession(session.id)
    navigate('past')
  }

  const rehearseAgain = () => navigate('new', {
    proposalText:  session?.proposalText || '',
    documentName:  session?.documentName || session?.proposalName || '',
    meetingName:   nextSessionName(session?.proposalName || ''),
    linkedMeeting: session?.linkedMeeting || '',
    personaIds:    session?.personaIds || [],
    toughness:     session?.config?.toughness || '',
    turnLimit:     session?.config?.turnLimit || '',
  })

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

  const allPersonas = [...PERSONAS, ...loadCustomPersonas()]
  const personas = session?.personaIds?.length
    ? allPersonas
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
      showToast('Could not copy. Check browser clipboard permissions.', 'error')
    })
  }

  return (
    <div className="page">
      <ToastStack toasts={toasts} />
      <motion.div variants={container} initial="hidden" animate="show">
        <motion.div variants={item}>
          <div className="report-hero">
            <div className="report-hero-label">Session complete · {reportDate}</div>
            <div className="report-hero-title">
              Here is what to prepare<br />before the real meeting.
            </div>
            <div className="report-hero-sub">
              {condMet} of {condTotal} conditions met · {turns} turns · {duration} · {proposalName}
            </div>
            <div className="report-actions">
              <button className="btn btn-secondary btn-sm" style={{ background: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.12)', color: '#E8E5DF' }} onClick={() => navigate('debrief')}>
                <BookOpen size={13} /> Full Debrief
              </button>
              <button className="btn btn-secondary btn-sm" style={{ background: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.12)', color: '#E8E5DF' }} onClick={rehearseAgain}>
                <RotateCcw size={13} /> Rehearse Again
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
                {copied ? <><Check size={13} /> Copied!</> : <><Copy size={13} /> Copy Report</>}
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
                    ? <><ExternalLink size={13} /> Retry Export</>
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
              <span style={{ fontWeight: 600 }}>AI Report Unavailable</span>
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
              <div className="section-label" style={{ marginBottom: 16 }}>Top Weak Points to Address</div>
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
                  {w.fix && (
                    <div className="weak-point-fix-block">
                      <div className="weak-point-fix-label">How to Fix</div>
                      <div className="weak-point-fix">{w.fix}</div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          {activeTab === 'proposal' && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 14,
              padding: '18px 22px',
              background: 'var(--bg-surface)', border: '1px solid var(--border)',
              borderRadius: 12,
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: 8, flexShrink: 0,
                background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <FileText size={18} style={{ color: 'var(--text-muted)' }} />
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{
                  fontFamily: 'var(--font-ui)', fontSize: '0.9375rem', fontWeight: 500,
                  color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {session?.documentName || proposalName}
                </div>
                <div style={{ fontFamily: 'var(--font-ui)', fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: 2 }}>
                  {session.proposalText.trim().split(/\s+/).filter(Boolean).length} words · used in this session
                </div>
              </div>
            </div>
          )}
        </motion.div>

        <motion.div variants={item}>
          <div className="report-bottom-actions">
            <button className="btn btn-primary btn-lg" onClick={() => navigate('debrief')}>
              <BookOpen size={16} /> Open Full Debrief
            </button>
            <button className="btn btn-secondary btn-lg" onClick={rehearseAgain}>
              <RotateCcw size={16} /> Rehearse Again
            </button>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-ghost btn-lg" style={{ flex: 1 }} onClick={() => navigate('home')}>
                <Home size={16} /> Home
              </button>
              {session?.id && (
                <button
                  className="btn btn-ghost btn-lg"
                  onClick={handleDelete}
                  style={{ flex: 1, color: '#EF4444', borderColor: 'rgba(239,68,68,0.25)' }}
                >
                  <Trash2 size={16} /> Delete Run
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  )
}
