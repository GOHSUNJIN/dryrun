import { useState } from 'react'
import { motion } from 'framer-motion'
import { TrendingDown, TrendingUp, Award, Zap, Minus, RotateCcw, ArrowLeft, ChevronRight } from 'lucide-react'
import { DEBRIEF_MOMENTS } from '../data.js'

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

const FALLBACK_COACHING = {
  1: {
    momentType:  'weak',
    momentLabel: 'Weak Answer',
    asked:       'Morgan (Finance) challenged the payback claim',
    yourAnswer:  '"This pays for itself within a year."',
    whyShort:    'The answer restated the conclusion rather than showing the workings. Finance needs a line-by-line model, not an assertion.',
    betterAnswer: 'Acknowledge the gap directly: "You are right. I cited base salary only. The full year-one cost including benefits at 25% load, $18k in tooling and estimated $30k AWS infrastructure is $336k. Against $200k in saved labour and $140k in avoided re-reporting risk, the payback is 18 months. I will have a three-year TCO model before the meeting."',
  },
  2: {
    momentType:  'strong',
    momentLabel: 'Strong Answer',
    asked:       'Jordan (Ops) asked about the existing manual process owner',
    yourAnswer:  '"We ran a pilot last quarter with Ops. The analyst who owns the process helped scope it."',
    whyShort:    'Named a real pilot, cited a specific stakeholder and turned a potential HR concern into a positive story.',
    betterAnswer: 'This answer was effective. Reinforce it in the real meeting by having the analyst name and a one-line quote ready in case Legal asks about data consent.',
  },
}

const PERSONA_FILTER_OPTIONS = ['All personas', 'Finance', 'Legal', 'Operations', 'Fact-Checker']

export default function Debrief({ navigate, session }) {
  const [selected, setSelected] = useState(1)
  const [filter, setFilter]     = useState('All personas')
  const [compare, setCompare]   = useState(false)

  const moments = session?.reportData?.moments?.length
    ? session.reportData.moments
    : DEBRIEF_MOMENTS

  const getCoaching = (momentId) => {
    if (session?.reportData?.moments?.length) {
      const m = session.reportData.moments.find(m => m.id === momentId)
      if (m) {
        return {
          momentType:  m.type,
          momentLabel: m.tag,
          asked:       m.asked,
          yourAnswer:  m.your_answer,
          whyShort:    m.why,
          betterAnswer: m.better,
        }
      }
    }
    return FALLBACK_COACHING[momentId] || FALLBACK_COACHING[1]
  }

  const coaching    = getCoaching(selected)
  const MomentIcon  = MARKER_ICONS[coaching.momentType] || Minus
  const momentColor = MARKER_COLORS[coaching.momentType] || '#9B9BAB'

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{
        padding: '16px 28px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        background: 'var(--bg-surface)',
        flexShrink: 0,
      }}>
        <button
          onClick={() => navigate('report')}
          style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8125rem', color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-ui)' }}
        >
          <ArrowLeft size={14} /> Report
        </button>
        <div style={{ width: 1, height: 16, background: 'var(--border)' }} />
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.125rem', fontWeight: 600, color: 'var(--text-primary)' }}>
          Session Debrief: {session?.proposalName || 'Data Engineering Hires'}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
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
            {PERSONA_FILTER_OPTIONS.map(f => (
              <button
                key={f}
                className={`timeline-filter-btn ${filter === f ? 'active' : ''}`}
                onClick={() => setFilter(f)}
              >{f}</button>
            ))}
          </div>

          <div className="compare-toggle" onClick={() => setCompare(c => !c)}>
            <div className={`toggle-track ${compare ? 'on' : ''}`}>
              <div className="toggle-thumb" />
            </div>
            <span className="compare-label">Compare with previous rehearsal</span>
          </div>

          {moments.map(m => {
            const Icon  = MARKER_ICONS[m.type] || Minus
            const color = MARKER_COLORS[m.type] || '#9B9BAB'
            return (
              <div
                key={m.id}
                className={`timeline-item ${selected === m.id ? 'selected' : ''}`}
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
          <motion.div
            key={selected}
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
                background: 'var(--bg-base)',
                border: '1px solid var(--border)',
                borderLeft: `3px solid ${momentColor}`,
                borderRadius: '0 var(--r-md) var(--r-md) 0',
                padding: '12px 16px',
                fontStyle: 'italic',
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
                <RotateCcw size={14} /> Practise this moment
              </button>
              <button className="btn btn-secondary">
                Next weak point
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
