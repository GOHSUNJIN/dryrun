import { useState } from 'react'
import { motion } from 'framer-motion'
import { TrendingDown, TrendingUp, Award, Zap, Minus, RotateCcw, ArrowLeft, ChevronRight } from 'lucide-react'
import { PERSONAS } from '../data.js'

const MARKER_ICONS = {
  strong:  TrendingUp,
  weak:    TrendingDown,
  cond:    Award,
  clash:   Zap,
  neutral: Minus,
}

const MARKER_COLORS = {
  strong:  '#059669',
  weak:    '#DC2626',
  cond:    '#F59E0B',
  clash:   '#9061F9',
  neutral: '#9B9BAB',
}

export default function Debrief({ navigate, session }) {
  const [selected, setSelected]       = useState(1)
  const [filterPersonaId, setFilterPersonaId] = useState(null)

  const sessionPersonas  = session?.personaIds?.length
    ? PERSONAS.filter(p => session.personaIds.includes(p.id))
    : PERSONAS

  const matchesPersona = (m, personaId) => {
    const p = sessionPersonas.find(p => p.id === personaId)
    if (!p) return false
    const text     = `${m.excerpt} ${m.asked || ''} ${m.tag} ${m.turn}`.toLowerCase()
    const keywords = [p.id, ...p.name.toLowerCase().split(/\s+/), ...p.role.toLowerCase().split(/\s+/)].filter(k => k.length > 2)
    return keywords.some(k => text.includes(k))
  }

  const isDemoReport = Boolean(session?.reportData?.demo) || !session?.reportData?.moments?.length
  const moments = session?.reportData?.moments || []

  const filteredMoments = filterPersonaId === null
    ? moments
    : moments.filter(m => matchesPersona(m, filterPersonaId))

  const selectedInFiltered = filteredMoments.find(m => m.id === selected)
  const effectiveSelected  = selectedInFiltered ? selected : (filteredMoments[0]?.id ?? 1)

  const getCoaching = (momentId) => {
    const m = moments.find(m => m.id === momentId)
    if (m) return { momentType: m.type, momentLabel: m.tag, asked: m.asked, yourAnswer: m.your_answer, whyShort: m.why, betterAnswer: m.better }
    return null
  }

  const nextWeakPoint = () => {
    const weakMoments = filteredMoments.filter(m => m.type === 'weak')
    if (!weakMoments.length) return
    const currentIdx = weakMoments.findIndex(m => m.id === effectiveSelected)
    const nextIdx = (currentIdx + 1) % weakMoments.length
    setSelected(weakMoments[nextIdx].id)
  }

  const coaching    = getCoaching(effectiveSelected)
  const MomentIcon  = MARKER_ICONS[coaching?.momentType] || Minus
  const momentColor = MARKER_COLORS[coaching?.momentType] || '#9B9BAB'

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{
        padding: '16px 28px', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 16,
        background: 'var(--bg-surface)', flexShrink: 0,
      }}>
        <button
          onClick={() => navigate('report')}
          style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8125rem', color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-ui)' }}
        >
          <ArrowLeft size={14} /> Report
        </button>
        <div style={{ width: 1, height: 16, background: 'var(--border)' }} />
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.125rem', fontWeight: 600, color: 'var(--text-primary)' }}>
          Session debrief: {session?.proposalName || 'Untitled proposal'}
        </div>
        {isDemoReport && (
          <div style={{
            marginLeft: 12, padding: '4px 10px', borderRadius: 6,
            background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)',
            fontSize: '0.75rem', color: '#D97706', fontWeight: 500, whiteSpace: 'nowrap',
          }}>
            AI analysis not generated
          </div>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate('home')} style={{ color: 'var(--text-muted)', borderColor: 'var(--border)' }}>
            Home
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate('room')}>
            <RotateCcw size={12} /> Rehearse again
          </button>
        </div>
      </div>

      <div className="debrief-layout" style={{ flex: 1 }}>
        {/* Left: Timeline */}
        <div className="debrief-timeline">
          <div className="timeline-header">
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              Key moments
            </div>
          </div>

          <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
            <button
              className={`timeline-filter-btn ${filterPersonaId === null ? 'active' : ''}`}
              onClick={() => setFilterPersonaId(null)}
            >All personas</button>
            {sessionPersonas.map(p => (
              <button
                key={p.id}
                className={`timeline-filter-btn ${filterPersonaId === p.id ? 'active' : ''}`}
                onClick={() => setFilterPersonaId(p.id)}
              >{p.role}</button>
            ))}
          </div>

          {filteredMoments.length === 0 ? (
            <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              {moments.length === 0
                ? 'No moments available for this session.'
                : 'No moments match this filter.'}
            </div>
          ) : filteredMoments.map(m => {
            const Icon  = MARKER_ICONS[m.type] || Minus
            const color = MARKER_COLORS[m.type] || '#9B9BAB'
            return (
              <div
                key={m.id}
                className={`timeline-item ${effectiveSelected === m.id ? 'selected' : ''}`}
                onClick={() => setSelected(m.id)}
              >
                <div className={`timeline-marker ${m.type}`}><Icon size={13} /></div>
                <div className="timeline-content">
                  <div className="timeline-turn">{m.turn}</div>
                  <div className="timeline-excerpt">{m.excerpt}</div>
                  <div className="timeline-tag" style={{ color }}>{m.tag}</div>
                </div>
                <ChevronRight size={13} style={{ color: 'var(--text-muted)', flexShrink: 0, marginTop: 4 }} />
              </div>
            )
          })}
        </div>

        {/* Right: Coaching */}
        <div className="debrief-coaching">
          {!coaching ? (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              height: '100%', textAlign: 'center', padding: '48px 32px',
              color: 'var(--text-muted)', fontSize: '0.875rem', lineHeight: 1.6,
            }}>
              Session debrief not available. AI was not able to generate analysis for this session.<br />
              <button className="btn btn-secondary" style={{ marginTop: 24 }} onClick={() => navigate('room')}>
                <RotateCcw size={14} /> Rehearse again
              </button>
            </div>
          ) : (
          <motion.div
            key={effectiveSelected}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
          >
            <div
              className="coaching-moment-tag"
              style={{ background: `${momentColor}14`, color: momentColor, border: `1px solid ${momentColor}28` }}
            >
              <MomentIcon size={12} />
              {coaching.momentLabel}
            </div>

            <div className="coaching-question">What the panel asked</div>
            <div className="coaching-quote">{coaching.asked}</div>

            <div className="coaching-section">
              <div className="coaching-section-title">What you said</div>
              <div className="coaching-body" style={{
                background: 'var(--bg-base)', border: '1px solid var(--border)',
                borderLeft: `3px solid ${momentColor}`,
                borderRadius: '0 var(--r-md) var(--r-md) 0',
                padding: '12px 16px', fontStyle: 'italic',
              }}>
                {coaching.yourAnswer}
              </div>
            </div>

            <div className="coaching-section">
              <div className="coaching-section-title">
                {coaching.momentType === 'strong' ? 'Why it worked' : 'Why it fell short'}
              </div>
              <div className="coaching-body">{coaching.whyShort}</div>
            </div>

            <div className="coaching-section">
              <div className="coaching-section-title">
                {coaching.momentType === 'strong' ? 'How to build on it' : 'A stronger answer to try'}
              </div>
              <div className="coaching-better-answer">
                <p>{coaching.betterAnswer}</p>
              </div>
            </div>

            <div className="coaching-actions">
              <button className="btn btn-primary" onClick={() => navigate('room')}>
                <RotateCcw size={14} /> Rehearse again
              </button>
              <button
                className="btn btn-secondary"
                onClick={nextWeakPoint}
                disabled={filteredMoments.filter(m => m.type === 'weak').length === 0}
              >
                Next weak point
              </button>
            </div>
          </motion.div>
          )}
        </div>
      </div>
    </div>
  )
}
