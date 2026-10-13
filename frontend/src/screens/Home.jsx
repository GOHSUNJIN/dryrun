import { useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, Calendar, Clock, ChevronRight, Loader, Plus } from 'lucide-react'
import { WEAK_SPOTS, UPCOMING_MEETINGS, PERSONAS } from '../data.js'
import { loadSessions } from '../utils/storage.js'
import { fetchCalendarEvents } from '../utils/google.js'

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

const rowCard = (hovered) => ({
  display: 'flex', alignItems: 'center', gap: 12,
  padding: '12px 16px', marginBottom: 8,
  borderRadius: 8, border: '1px solid var(--border)',
  background: hovered ? 'var(--bg-hover)' : 'var(--bg-card)',
  cursor: 'pointer', transition: 'background 0.15s ease',
})

export default function Home({ navigate }) {
  const stored = loadSessions()
  const recent = stored.slice(0, 4).map(s => ({ ...s, proposal: s.proposal || 'Untitled proposal' }))

  const [calEvents, setCalEvents]       = useState(null)
  const [calLoading, setCalLoading]     = useState(false)
  const [hoveredMeeting, setHoveredMeeting] = useState(null)
  const [hoveredSession, setHoveredSession] = useState(null)

  const connectCalendar = async () => {
    setCalLoading(true)
    try {
      const events = await fetchCalendarEvents()
      setCalEvents(events)
    } catch (err) {
      console.error('[Calendar] failed:', err)
      setCalEvents([])
    } finally {
      setCalLoading(false)
    }
  }

  const meetings = calEvents !== null ? calEvents : UPCOMING_MEETINGS

  return (
    <div className="page" style={{ maxWidth: 1080, padding: '40px 48px' }}>
      <motion.div variants={container} initial="hidden" animate="show">

        {/* Hero */}
        <motion.div variants={item} style={{ marginBottom: 44 }}>
          <div style={{ width: 24, height: 3, background: 'var(--app-accent)', borderRadius: 2, marginBottom: 18 }} />
          <div className="home-greeting">
            {getGreeting()} Sun Jin.<br />
            <em>Ready to rehearse?</em>
          </div>
          <button className="home-hero-btn" onClick={() => navigate('new')} style={{ marginTop: 20 }}>
            Start a new rehearsal <ArrowRight size={15} />
          </button>
        </motion.div>

        {/* Two-column grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>

          {/* Upcoming meetings */}
          <motion.div variants={item}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div className="section-label" style={{ marginBottom: 0 }}>Upcoming meetings</div>
              {calEvents === null && (
                <button
                  onClick={connectCalendar}
                  disabled={calLoading}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    fontSize: '0.75rem', color: 'var(--text-muted)', cursor: 'pointer',
                    background: 'none', border: 'none', fontFamily: 'var(--font-ui)',
                    opacity: calLoading ? 0.6 : 1,
                  }}
                >
                  {calLoading
                    ? <><Loader size={11} style={{ animation: 'spin 1s linear infinite' }} /> Connecting...</>
                    : <><Calendar size={11} /> Connect Calendar</>
                  }
                </button>
              )}
            </div>

            {meetings.length === 0 ? (
              <div style={{ ...rowCard(false), cursor: 'default' }}>
                <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>No meetings in the next 7 days.</span>
              </div>
            ) : meetings.map((m, i) => (
              <div
                key={i}
                onClick={() => navigate('new')}
                onMouseEnter={() => setHoveredMeeting(i)}
                onMouseLeave={() => setHoveredMeeting(null)}
                style={rowCard(hoveredMeeting === i)}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-primary)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{m.name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Calendar size={10} style={{ flexShrink: 0 }} />
                    {m.date}
                  </div>
                </div>
                <span style={{
                  fontSize: '0.6875rem', fontWeight: 600, padding: '2px 7px', borderRadius: 99,
                  background: m.daysLeft <= 5 ? 'rgba(245,158,11,0.1)' : 'var(--bg-hover)',
                  color: m.daysLeft <= 5 ? '#D97706' : 'var(--text-muted)',
                  whiteSpace: 'nowrap', flexShrink: 0,
                }}>{m.daysLeft}d</span>
                <ArrowRight
                  size={13}
                  style={{
                    color: hoveredMeeting === i ? 'var(--app-accent)' : 'var(--border)',
                    flexShrink: 0, transition: 'color 0.15s ease',
                  }}
                />
              </div>
            ))}
          </motion.div>

          {/* Recent sessions */}
          <motion.div variants={item}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div className="section-label" style={{ marginBottom: 0 }}>Recent sessions</div>
              {recent.length > 0 && (
                <button
                  onClick={() => navigate('past')}
                  style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', color: 'var(--text-muted)', cursor: 'pointer', background: 'none', border: 'none', fontFamily: 'var(--font-ui)' }}
                >
                  View all <ChevronRight size={12} />
                </button>
              )}
            </div>

            {recent.length === 0 ? (
              <div style={{ ...rowCard(false), cursor: 'default', flexDirection: 'column', alignItems: 'flex-start', gap: 10 }}>
                <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>No sessions yet.</div>
                <button
                  onClick={() => navigate('new')}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    fontSize: '0.8125rem', fontWeight: 600, color: 'var(--app-accent)',
                    background: 'rgba(180,83,9,0.06)', border: '1px solid rgba(180,83,9,0.15)',
                    borderRadius: 6, padding: '7px 12px', cursor: 'pointer',
                    fontFamily: 'var(--font-ui)',
                  }}
                >
                  <Plus size={13} /> Start your first rehearsal
                </button>
              </div>
            ) : recent.map((s, idx) => {
              const pct     = s.condTotal ? Math.round((s.condMet / s.condTotal) * 100) : 0
              const isGood  = pct >= 60
              const personas = s.personaIds?.length
                ? PERSONAS.filter(p => s.personaIds.includes(p.id))
                : PERSONAS
              return (
                <div
                  key={idx}
                  onClick={() => navigate('past')}
                  onMouseEnter={() => setHoveredSession(idx)}
                  onMouseLeave={() => setHoveredSession(null)}
                  style={rowCard(hoveredSession === idx)}
                >
                  <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
                    {personas.map(p => (
                      <div key={p.id} style={{
                        width: 20, height: 20, borderRadius: '50%',
                        background: p.color, display: 'flex', alignItems: 'center',
                        justifyContent: 'center', fontSize: '0.5625rem', fontWeight: 700,
                        color: 'white', fontFamily: 'var(--font-ui)',
                      }}>{p.initial}</div>
                    ))}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-primary)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>{s.proposal}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 3 }}>
                      <Clock size={10} style={{ flexShrink: 0 }} />
                      {s.date} · {s.duration}
                    </div>
                  </div>
                  <span style={{
                    fontSize: '0.6875rem', fontWeight: 600, padding: '2px 7px', borderRadius: 99,
                    background: isGood ? 'rgba(5,150,105,0.08)' : 'rgba(245,158,11,0.08)',
                    color: isGood ? '#059669' : '#D97706',
                    whiteSpace: 'nowrap', flexShrink: 0,
                  }}>{s.condMet}/{s.condTotal}</span>
                  <ArrowRight
                    size={13}
                    style={{
                      color: hoveredSession === idx ? 'var(--app-accent)' : 'var(--border)',
                      flexShrink: 0, transition: 'color 0.15s ease',
                    }}
                  />
                </div>
              )
            })}
          </motion.div>

          {/* Weak spots */}
          <motion.div variants={item} style={{ gridColumn: '1 / -1' }}>
            <div className="section-label">Recurring weak spots</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              {WEAK_SPOTS.map((w, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 14,
                  padding: '16px 18px', borderRadius: 10,
                  background: 'var(--bg-card)', border: '1px solid var(--border)',
                }}>
                  <div style={{
                    fontSize: '1.25rem', fontWeight: 700, color: 'var(--app-accent)',
                    fontFamily: 'var(--font-display)', lineHeight: 1, flexShrink: 0, minWidth: 28,
                  }}>{w.count}</div>
                  <div>
                    <div style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.4 }}>{w.text}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>{w.sub}</div>
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
