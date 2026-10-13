import { motion } from 'framer-motion'
import { ArrowRight, Calendar, Clock, ChevronRight } from 'lucide-react'
import { PAST_SESSIONS, WEAK_SPOTS, UPCOMING_MEETINGS, PERSONAS } from '../data.js'
import { loadSessions } from '../utils/storage.js'

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
}
const item = {
  hidden: { opacity: 0, y: 12 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning,'
  if (h < 17) return 'Good afternoon,'
  return 'Good evening,'
}

function loadRecentSessions() {
  const stored = loadSessions()
  if (stored.length) {
    return {
      sessions: stored.slice(0, 3).map(s => ({ ...s, proposal: s.proposal || 'Untitled proposal' })),
      isReal: true,
    }
  }
  return {
    sessions: PAST_SESSIONS.flatMap(g => g.sessions.map(s => ({ ...s, proposal: g.proposal }))).slice(0, 3),
    isReal: false,
  }
}

export default function Home({ navigate }) {
  const { sessions: recent, isReal } = loadRecentSessions()

  return (
    <div className="page" style={{ maxWidth: 1080, padding: '40px 48px' }}>
      <motion.div variants={container} initial="hidden" animate="show">
        <motion.div variants={item}>
          <div className="home-greeting">
            {getGreeting()}<br />
            <em>Ready to rehearse?</em>
          </div>
          <button className="home-hero-btn" onClick={() => navigate('new')}>
            Start a new rehearsal
            <ArrowRight size={16} />
          </button>
        </motion.div>

        <div className="home-grid" style={{ marginTop: 48 }}>
          {/* Upcoming meetings */}
          <motion.div variants={item}>
            <div className="section-label">Upcoming meetings</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {UPCOMING_MEETINGS.map((m, i) => (
                <div key={i} className="meeting-card" onClick={() => navigate('new')}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                    <div className="meeting-name">{m.name}</div>
                    <span style={{
                      fontSize: '0.6875rem', fontWeight: 600, padding: '3px 8px',
                      background: m.daysLeft <= 5 ? 'rgba(245,158,11,0.1)' : 'var(--bg-hover)',
                      color: m.daysLeft <= 5 ? '#D97706' : 'var(--text-muted)',
                      borderRadius: 99, whiteSpace: 'nowrap', flexShrink: 0,
                    }}>
                      {m.daysLeft}d away
                    </span>
                  </div>
                  <div className="meeting-date">
                    <Calendar size={12} style={{ color: 'var(--text-muted)' }} />
                    {m.date}
                  </div>
                  <button className="meeting-rehearse-btn" onClick={e => { e.stopPropagation(); navigate('new') }}>
                    Rehearse now
                  </button>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Recent sessions */}
          <motion.div variants={item}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div className="section-label" style={{ marginBottom: 0 }}>Recent sessions</div>
              <button
                onClick={() => navigate('past')}
                style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', color: 'var(--text-muted)', cursor: 'pointer', background: 'none', border: 'none', fontFamily: 'var(--font-ui)' }}
              >
                View all <ChevronRight size={12} />
              </button>
            </div>

            {!isReal ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{
                  padding: '12px 16px', borderRadius: 8,
                  background: 'var(--bg-hover)', border: '1px dashed var(--border)',
                  color: 'var(--text-muted)', fontSize: '0.8125rem', marginBottom: 4,
                }}>
                  No real sessions yet. These are sample sessions.{' '}
                  <button
                    onClick={() => navigate('new')}
                    style={{ color: 'var(--text-primary)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-ui)', fontSize: '0.8125rem', fontWeight: 600, padding: 0 }}
                  >
                    Start your first rehearsal.
                  </button>
                </div>
                {recent.map((s, idx) => <SessionCard key={idx} s={s} navigate={navigate} />)}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {recent.map((s, idx) => <SessionCard key={idx} s={s} navigate={navigate} />)}
              </div>
            )}
          </motion.div>

          {/* Weak spots */}
          <motion.div variants={item} style={{ gridColumn: '1 / -1' }}>
            <div className="section-label">Your recurring weak spots</div>
            <div className="weak-spots-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              {WEAK_SPOTS.map((w, i) => (
                <div key={i} className="weak-spot-item">
                  <div className="weak-spot-count">{w.count}</div>
                  <div>
                    <div className="weak-spot-text">{w.text}</div>
                    <div className="weak-spot-sub">{w.sub}</div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </motion.div>
    </div>
  )
}

function SessionCard({ s, navigate }) {
  const pct    = s.condTotal ? Math.round((s.condMet / s.condTotal) * 100) : 0
  const isGood = pct >= 60
  return (
    <div className="session-card" onClick={() => navigate('report')}>
      <div className="session-info">
        <div className="session-name">{s.proposal}</div>
        <div className="session-meta">
          <Clock size={11} style={{ display: 'inline', marginRight: 4, verticalAlign: -1 }} />
          {s.date} · {s.mode} · {s.duration}
        </div>
      </div>
      <div className="session-avatars">
        {(s.personaIds?.length
          ? PERSONAS.filter(p => s.personaIds.includes(p.id))
          : PERSONAS
        ).map((p, j) => (
          <div key={p.id} className="session-avatar-pip" style={{ background: p.color }}>{p.initial}</div>
        ))}
      </div>
      <span className={`conditions-met-badge ${isGood ? 'good' : 'partial'}`}>
        {s.condMet}/{s.condTotal} met
      </span>
    </div>
  )
}
