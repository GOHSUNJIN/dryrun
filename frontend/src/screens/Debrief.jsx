import { useState } from 'react'
import { motion } from 'framer-motion'
import { TrendingDown, TrendingUp, Award, Zap, Minus, RotateCcw, ArrowLeft, ChevronRight, Home } from 'lucide-react'
import { PERSONAS } from '../data.js'
import { nextSessionName } from '../utils/storage.js'

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

  const rehearseAgain = () => navigate('new', {
    proposalText:  session?.proposalText || '',
    documentName:  session?.documentName || session?.proposalName || '',
    meetingName:   nextSessionName(session?.proposalName || ''),
    linkedMeeting: session?.linkedMeeting || '',
    personaIds:    session?.personaIds || [],
    toughness:     session?.config?.toughness || '',
    turnLimit:     session?.config?.turnLimit || '',
  })

  const isDemoReport    = Boolean(session?.reportData?.demo) || !session?.reportData?.moments?.length
  const presenterTurns  = (session?.transcript || []).filter(m => m.speaker === 'presenter').length
  const moments         = session?.reportData?.moments || []

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

  const debriefHeader = (
    <div className="debrief-header">
      <button className="debrief-back-btn" onClick={() => navigate('report')}>
        <ArrowLeft size={14} /> Report
      </button>
      <div className="debrief-header-divider" />
      <div className="debrief-header-title">
        Session Debrief: {session?.proposalName || 'Untitled proposal'}
      </div>
      {isDemoReport && (
        <div className="debrief-demo-badge">
          AI Analysis Not Generated
        </div>
      )}
      <div className="debrief-header-actions">
        <button className="btn btn-secondary btn-sm" onClick={rehearseAgain}>
          <RotateCcw size={12} /> Rehearse Again
        </button>
      </div>
    </div>
  )

  const noTurnsKnown = presenterTurns === 0 && Array.isArray(session?.transcript)

  if (moments.length === 0) {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {debriefHeader}
        <div className="debrief-empty-state">
          <div className="debrief-empty-icon">{noTurnsKnown ? '🎙️' : '📊'}</div>
          <div className="debrief-empty-title">
            {noTurnsKnown ? 'No session recorded' : 'Analysis unavailable'}
          </div>
          <div className="debrief-empty-desc">
            {noTurnsKnown
              ? 'Answer at least one question during rehearsal, then end the session to unlock your debrief.'
              : 'AI was not able to generate a debrief for this session.'}
          </div>
          <div className="debrief-empty-actions">
            <button className="btn btn-primary" onClick={rehearseAgain}>
              <RotateCcw size={14} /> Rehearse Again
            </button>
            <button className="btn btn-secondary" onClick={() => navigate('home')}>
              <Home size={14} /> Home
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {debriefHeader}

      <div className="debrief-layout" style={{ flex: 1 }}>
        {/* Left: Timeline */}
        <div className="debrief-timeline">
          <div className="timeline-header">
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              Key Moments
            </div>
          </div>

          <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
            <button
              className={`timeline-filter-btn ${filterPersonaId === null ? 'active' : ''}`}
              onClick={() => setFilterPersonaId(null)}
            >All Personas</button>
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
              No moments match this filter.
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
            <div className="debrief-empty-state">
              <div className="debrief-empty-icon">💬</div>
              <div className="debrief-empty-title">Select a moment</div>
              <div className="debrief-empty-desc">
                {filteredMoments.length === 0
                  ? 'No moments match the selected filter. Try a different persona.'
                  : 'Pick a moment from the timeline to see coaching.'}
              </div>
            </div>
          ) : (
          <motion.div
            key={effectiveSelected}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
          >
            <div style={{ marginBottom: 4 }}>
              <div
                className="coaching-moment-tag"
                style={{ background: `${momentColor}14`, color: momentColor, border: `1px solid ${momentColor}28` }}
              >
                <MomentIcon size={12} />
                {coaching.momentLabel}
              </div>
            </div>

            <div style={{
              background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 20px',
            }}>
              <div style={{ fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.08em', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 10 }}>
                What the Panel Asked
              </div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', fontStyle: 'italic', lineHeight: 1.55, color: 'var(--text-primary)' }}>
                {coaching.asked}
              </div>
            </div>

            <div style={{
              background: 'var(--bg-surface)', border: '1px solid var(--border)',
              borderLeft: `3px solid ${momentColor}`,
              borderRadius: '0 12px 12px 0', padding: '14px 18px',
            }}>
              <div style={{ fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.08em', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>
                What You Said
              </div>
              <div style={{ fontStyle: 'italic', fontSize: '0.9375rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
                {coaching.yourAnswer}
              </div>
            </div>

            <div style={{
              background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 18px',
            }}>
              <div style={{ fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.08em', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>
                {coaching.momentType === 'strong' ? 'Why It Worked' : 'Why It Fell Short'}
              </div>
              <div style={{ fontSize: '0.9375rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                {coaching.whyShort}
              </div>
            </div>

            <div style={{
              background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 18px',
            }}>
              <div style={{ fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.08em', color: momentColor, textTransform: 'uppercase', marginBottom: 8 }}>
                {coaching.momentType === 'strong' ? 'How to Build on It' : 'Try Saying This Instead'}
              </div>
              <div style={{ fontSize: '0.9375rem', color: 'var(--text-primary)', lineHeight: 1.6 }}>
                {coaching.betterAnswer}
              </div>
            </div>

            <div className="coaching-actions">
              <button className="btn btn-primary" onClick={rehearseAgain}>
                <RotateCcw size={14} /> Rehearse Again
              </button>
              <button
                className="btn btn-secondary"
                onClick={nextWeakPoint}
                disabled={filteredMoments.filter(m => m.type === 'weak').length === 0}
              >
                Next Weak Point
              </button>
              <button className="btn btn-ghost" onClick={() => navigate('home')}>
                <Home size={14} /> Home
              </button>
            </div>
          </motion.div>
          )}
        </div>
      </div>
    </div>
  )
}
