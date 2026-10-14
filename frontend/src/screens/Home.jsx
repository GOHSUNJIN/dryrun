import { useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, Calendar, Clock, ChevronRight, ChevronLeft, Loader, Plus, X, Trash2, RefreshCw } from 'lucide-react'
import { PERSONAS } from '../data.js'
import { loadSessions, loadLocalMeetings, addLocalMeeting, deleteLocalMeeting, computeWeakSpots, loadDismissedSpots, dismissWeakSpot, loadCalEvents, saveCalEvents, deleteCalEvent, loadProfile } from '../utils/storage.js'
import { fetchCalendarEvents } from '../utils/google.js'
import { formatDate, daysFromNow } from '../utils/time.js'

const SESSION_PAGE_SIZE = 3

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
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

const rowCard = (hovered) => ({
  display: 'flex', alignItems: 'center', gap: 12,
  padding: '12px 16px', marginBottom: 8,
  borderRadius: 8, border: '1px solid var(--border)',
  background: hovered ? 'var(--bg-hover)' : 'var(--bg-surface)',
  cursor: 'pointer', transition: 'background 0.15s ease',
})

function AddMeetingForm({ onSave, onCancel }) {
  const [name, setName] = useState('')
  const [date, setDate] = useState('')
  const today = new Date().toISOString().slice(0, 10)

  const valid = name.trim() && date

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 100,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div style={{
        background: 'var(--bg-surface)', border: '1px solid var(--border)',
        borderRadius: 12, padding: 28, width: '100%', maxWidth: 400,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 600 }}>Add a meeting</div>
          <button onClick={onCancel} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>
            <X size={16} />
          </button>
        </div>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Meeting name</div>
          <input
            className="settings-input"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Meeting name"
            style={{ width: '100%', boxSizing: 'border-box' }}
            autoFocus
          />
        </div>
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Date</div>
          <input
            className="settings-input"
            type="date"
            value={date}
            min={today}
            onChange={e => setDate(e.target.value)}
            style={{ width: '100%', boxSizing: 'border-box' }}
          />
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
          <button className="btn btn-primary" onClick={() => valid && onSave(name.trim(), date)} style={{ opacity: valid ? 1 : 0.4, cursor: valid ? 'pointer' : 'not-allowed' }}>
            Add meeting
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Home({ navigate }) {
  const stored      = loadSessions()
  const allSessions = stored.map(s => ({ ...s, proposal: s.proposal || 'Untitled proposal' }))
  const profile     = loadProfile()

  const [calEvents, setCalEvents]           = useState(() => loadCalEvents())
  const [calLoading, setCalLoading]         = useState(false)
  const [calError, setCalError]             = useState(false)
  const [localMeetings, setLocalMeetings]   = useState(loadLocalMeetings)
  const [showAddMeeting, setShowAddMeeting] = useState(false)
  const [hoveredMeeting, setHoveredMeeting] = useState(null)
  const [hoveredSession, setHoveredSession] = useState(null)
  const [sessionPage, setSessionPage]       = useState(0)
  const [dismissedSpots, setDismissedSpots] = useState(() => loadDismissedSpots())
  const [spotsExpanded, setSpotsExpanded]   = useState(false)
  const [showDismissed, setShowDismissed]   = useState(false)

  const totalPages   = Math.ceil(allSessions.length / SESSION_PAGE_SIZE)
  const pageItems    = allSessions.slice(sessionPage * SESSION_PAGE_SIZE, (sessionPage + 1) * SESSION_PAGE_SIZE)
  const hasPrev      = sessionPage > 0
  const hasNext      = sessionPage < totalPages - 1

  const allComputedSpots = computeWeakSpots()
  const allSpots         = showDismissed ? allComputedSpots : allComputedSpots.filter(w => !dismissedSpots.has(w.text))
  const dismissedCount   = allComputedSpots.filter(w => dismissedSpots.has(w.text)).length
  const visibleSpots     = spotsExpanded ? allSpots : allSpots.slice(0, 3)
  const hasMoreSpots     = allSpots.length > 3

  const connectCalendar = async () => {
    setCalLoading(true)
    setCalError(false)
    try {
      const events = await fetchCalendarEvents()
      saveCalEvents(events)
      setCalEvents(events)
    } catch (err) {
      console.error('[Calendar] failed:', err)
      setCalError(true)
    } finally {
      setCalLoading(false)
    }
  }

  const handleAddMeeting = (name, isoDate) => {
    const meeting = { id: `m_${Date.now()}`, name, isoDate }
    addLocalMeeting(meeting)
    setLocalMeetings(loadLocalMeetings())
    setShowAddMeeting(false)
  }

  const handleDeleteMeeting = (e, id, name) => {
    e.stopPropagation()
    if (!window.confirm(`Remove "${name}"?`)) return
    deleteLocalMeeting(id)
    setLocalMeetings(loadLocalMeetings())
  }

  const handleDeleteCalEvent = (e, name) => {
    e.stopPropagation()
    if (!window.confirm(`Remove "${name}" from your calendar list?`)) return
    deleteCalEvent(name)
    setCalEvents(loadCalEvents())
  }

  const handleDismissSpot = (text) => {
    dismissWeakSpot(text)
    setDismissedSpots(loadDismissedSpots())
  }

  const localMeetingsMapped = localMeetings
    .map(m => ({ ...m, date: formatDate(m.isoDate), daysLeft: daysFromNow(m.isoDate), local: true }))
    .filter(m => m.daysLeft >= 0)
    .sort((a, b) => a.daysLeft - b.daysLeft)

  const calMeetings = (calEvents ?? []).map(m => ({ ...m, local: false }))

  const allMeetings = [...localMeetingsMapped, ...calMeetings]
    .sort((a, b) => a.daysLeft - b.daysLeft)

  const hasAnyMeetings = allMeetings.length > 0

  return (
    <div className="page" style={{ maxWidth: 1080, padding: '40px 48px' }}>
      {showAddMeeting && (
        <AddMeetingForm
          onSave={handleAddMeeting}
          onCancel={() => setShowAddMeeting(false)}
        />
      )}

      <motion.div variants={container} initial="hidden" animate="show">

        {/* Hero */}
        <motion.div variants={item} style={{ marginBottom: 44 }}>
          <div style={{ width: 24, height: 3, background: 'var(--app-accent)', borderRadius: 2, marginBottom: 18 }} />
          <div className="home-greeting">
            {getGreeting()}{profile.name ? `, ${profile.name}` : ''}.<br />
            <em>Ready to rehearse?</em>
          </div>
          <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: 8, maxWidth: 420, lineHeight: 1.55 }}>
            Upload a proposal, face a simulated panel and get a coaching report before the real meeting.
          </div>
          <button className="home-hero-btn" onClick={() => navigate('new')} style={{ marginTop: 20 }}>
            Start a new rehearsal <ArrowRight size={15} />
          </button>
        </motion.div>

        {/* Two-column grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32, alignItems: 'stretch' }}>

          {/* Upcoming meetings  -  fills column height */}
          <motion.div variants={item} style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div className="section-label" style={{ marginBottom: 0 }}>Upcoming meetings</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  onClick={connectCalendar}
                  disabled={calLoading}
                  title={calEvents !== null ? 'Resync from Google Calendar' : 'Sync Google Calendar'}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    fontSize: '0.75rem', cursor: calLoading ? 'default' : 'pointer',
                    background: 'none', border: 'none', fontFamily: 'var(--font-ui)',
                    color: calError ? '#DC2626' : 'var(--text-muted)',
                    opacity: calLoading ? 0.6 : 1,
                  }}
                >
                  {calLoading
                    ? <><Loader size={11} style={{ animation: 'spin 1s linear infinite' }} /> Syncing...</>
                    : calError
                      ? <><X size={11} /> Sync failed. Retry?</>
                      : calEvents !== null
                        ? <RefreshCw size={11} />
                        : <><Calendar size={11} /> Sync calendar</>
                  }
                </button>
                <button
                  onClick={() => setShowAddMeeting(true)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    fontSize: '0.75rem', color: 'var(--text-muted)', cursor: 'pointer',
                    background: 'none', border: 'none', fontFamily: 'var(--font-ui)',
                  }}
                >
                  <Plus size={12} /> Add
                </button>
              </div>
            </div>

            {!hasAnyMeetings ? (
              <div style={{
                flex: 1, borderRadius: 10, textAlign: 'center',
                border: '1.5px dashed var(--border)', background: 'var(--bg-surface)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                padding: '28px 20px',
              }}>
                <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: 12 }}>
                  No upcoming meetings yet.
                </div>
                <button
                  onClick={() => setShowAddMeeting(true)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    fontSize: '0.8125rem', fontWeight: 500, color: 'var(--app-accent)',
                    background: 'var(--app-accent-bg)', border: 'none', borderRadius: 6,
                    padding: '6px 12px', cursor: 'pointer', fontFamily: 'var(--font-ui)',
                  }}
                >
                  <Plus size={12} /> Add a meeting
                </button>
              </div>
            ) : (
              <div style={{ flex: 1 }}>
                {allMeetings.map((m, i) => {
                  const accentColor = m.daysLeft <= 3 ? '#DC2626' : m.daysLeft <= 7 ? '#B45309' : 'var(--border)'
                  const countColor  = m.daysLeft <= 3 ? '#DC2626' : m.daysLeft <= 7 ? '#B45309' : 'var(--text-muted)'
                  return (
                    <div
                      key={m.id || i}
                      onClick={() => navigate('new', { meetingName: m.name })}
                      onMouseEnter={() => setHoveredMeeting(i)}
                      onMouseLeave={() => setHoveredMeeting(null)}
                      style={{
                        display: 'flex', alignItems: 'stretch',
                        marginBottom: 8, borderRadius: 8, overflow: 'hidden',
                        border: '1px solid var(--border)',
                        borderLeft: `3px solid ${accentColor}`,
                        background: hoveredMeeting === i ? 'var(--bg-hover)' : 'var(--bg-surface)',
                        cursor: 'pointer', transition: 'background 0.15s ease',
                      }}
                    >
                      <div style={{
                        width: 54, flexShrink: 0,
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        padding: '10px 0',
                        borderRight: '1px solid var(--border)',
                      }}>
                        <div style={{
                          fontSize: '1.25rem', fontWeight: 700, lineHeight: 1,
                          color: countColor, fontFamily: 'var(--font-display)',
                        }}>{m.daysLeft}</div>
                        <div style={{
                          fontSize: '0.5rem', fontWeight: 600, letterSpacing: '0.1em',
                          textTransform: 'uppercase', color: 'var(--text-muted)', marginTop: 2,
                        }}>days</div>
                      </div>

                      <div style={{ flex: 1, minWidth: 0, padding: '11px 12px' }}>
                        <div style={{
                          fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-primary)',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>{m.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 3, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Calendar size={10} style={{ flexShrink: 0 }} />
                          {m.date}
                          {m.local && (
                            <span style={{ fontSize: '0.625rem', background: 'var(--bg-hover)', borderRadius: 4, padding: '1px 5px', marginLeft: 2 }}>Manual</span>
                          )}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', paddingRight: 12, flexShrink: 0 }}>
                        <button
                          onClick={e => m.local ? handleDeleteMeeting(e, m.id, m.name) : handleDeleteCalEvent(e, m.name)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, display: 'flex', opacity: 0.5 }}
                          onMouseEnter={e => { e.stopPropagation(); e.currentTarget.style.opacity = 1; e.currentTarget.style.color = '#DC2626' }}
                          onMouseLeave={e => { e.currentTarget.style.opacity = 0.5; e.currentTarget.style.color = 'var(--text-muted)' }}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </motion.div>

          {/* Recent sessions with pagination */}
          <motion.div variants={item}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div className="section-label" style={{ marginBottom: 0 }}>Recent sessions</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {totalPages > 1 && (
                  <>
                    <button
                      onClick={() => setSessionPage(p => p - 1)}
                      disabled={!hasPrev}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        width: 22, height: 22, borderRadius: 5,
                        background: hasPrev ? 'var(--bg-hover)' : 'transparent',
                        border: '1px solid var(--border)', cursor: hasPrev ? 'pointer' : 'default',
                        color: hasPrev ? 'var(--text-secondary)' : 'var(--text-muted)',
                        opacity: hasPrev ? 1 : 0.35,
                      }}
                    >
                      <ChevronLeft size={12} />
                    </button>
                    <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                      {sessionPage + 1}/{totalPages}
                    </span>
                    <button
                      onClick={() => setSessionPage(p => p + 1)}
                      disabled={!hasNext}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        width: 22, height: 22, borderRadius: 5,
                        background: hasNext ? 'var(--bg-hover)' : 'transparent',
                        border: '1px solid var(--border)', cursor: hasNext ? 'pointer' : 'default',
                        color: hasNext ? 'var(--text-secondary)' : 'var(--text-muted)',
                        opacity: hasNext ? 1 : 0.35,
                      }}
                    >
                      <ChevronRight size={12} />
                    </button>
                  </>
                )}
                <button
                  onClick={() => navigate(allSessions.length > 0 ? 'past' : 'new')}
                  style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', color: 'var(--text-muted)', cursor: 'pointer', background: 'none', border: 'none', fontFamily: 'var(--font-ui)' }}
                >
                  {allSessions.length > 0 ? <>View all <ChevronRight size={12} /></> : <><Plus size={11} /> New</>}
                </button>
              </div>
            </div>

            {allSessions.length === 0 ? (
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
            ) : pageItems.map((s, idx) => {
              const pct     = s.condTotal ? Math.round((s.condMet / s.condTotal) * 100) : 0
              const isGood  = pct >= 60
              const personas = s.personaIds?.length
                ? PERSONAS.filter(p => s.personaIds.includes(p.id))
                : PERSONAS
              const shownPersonas = personas.slice(0, 4)
              const extraCount    = personas.length - 4
              return (
                <div
                  key={idx}
                  onClick={() => navigate('past')}
                  onMouseEnter={() => setHoveredSession(idx)}
                  onMouseLeave={() => setHoveredSession(null)}
                  style={rowCard(hoveredSession === idx)}
                >
                  {/* Fixed-width left section keeps text pinned at a consistent X */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: 3, flexShrink: 0, width: 92, paddingTop: 2 }}>
                      {shownPersonas.map(p => (
                        <div key={p.id} style={{
                          width: 20, height: 20, borderRadius: '50%',
                          background: p.color, display: 'flex', alignItems: 'center',
                          justifyContent: 'center', fontSize: '0.5625rem', fontWeight: 700,
                          color: 'white', fontFamily: 'var(--font-ui)', flexShrink: 0,
                        }}>{p.initial}</div>
                      ))}
                      {extraCount > 0 && (
                        <div style={{
                          width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                          background: 'var(--bg-hover)', border: '1px solid var(--border)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '0.5rem', fontWeight: 700, color: 'var(--text-muted)',
                          fontFamily: 'var(--font-ui)',
                        }}>+{extraCount}</div>
                      )}
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
                      <div style={{ fontSize: '0.6875rem', marginTop: 2, display: 'flex', alignItems: 'center', gap: 3, opacity: s.linkedMeeting ? 1 : 0.5 }}>
                        <Calendar size={9} style={{ flexShrink: 0, color: 'var(--text-muted)' }} />
                        <span style={{ color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {s.linkedMeeting || 'No meeting'}
                        </span>
                      </div>
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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div className="section-label" style={{ marginBottom: 0 }}>Recurring weak spots</div>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                {dismissedCount > 0 && (
                  <button
                    onClick={() => setShowDismissed(s => !s)}
                    style={{ fontSize: '0.75rem', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-ui)' }}
                  >
                    {showDismissed ? 'Hide dismissed' : `Show dismissed (${dismissedCount})`}
                  </button>
                )}
                {hasMoreSpots && (
                  <button
                    onClick={() => setSpotsExpanded(e => !e)}
                    style={{ fontSize: '0.75rem', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-ui)' }}
                  >
                    {spotsExpanded ? 'Show less' : `Show all ${allSpots.length}`}
                  </button>
                )}
              </div>
            </div>
            {allSpots.length === 0 ? (
              <div style={{
                padding: '24px 28px', borderRadius: 10,
                border: '1.5px dashed var(--border)', background: 'var(--bg-surface)',
                color: 'var(--text-muted)', fontSize: '0.875rem',
              }}>
                {computeWeakSpots().length === 0
                  ? 'Patterns will appear here once you have completed rehearsals with AI coaching reports.'
                  : 'All weak spots dismissed.'}
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                {visibleSpots.map((w, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 14,
                    padding: '16px 18px', borderRadius: 10,
                    background: 'var(--bg-surface)', border: '1px solid var(--border)',
                    position: 'relative',
                  }}>
                    <div style={{
                      fontSize: '1.25rem', fontWeight: 700, color: 'var(--app-accent)',
                      fontFamily: 'var(--font-display)', lineHeight: 1, flexShrink: 0, minWidth: 28,
                    }}>{w.count}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.4 }}>{w.text}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>{w.sub}</div>
                    </div>
                    <button
                      onClick={() => handleDismissSpot(w.text)}
                      title="Dismiss"
                      style={{
                        position: 'absolute', top: 10, right: 10,
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: 'var(--text-muted)', padding: 2, display: 'flex',
                        opacity: 0.4, transition: 'opacity 0.15s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.opacity = 1}
                      onMouseLeave={e => e.currentTarget.style.opacity = 0.4}
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </motion.div>

        </div>
      </motion.div>
    </div>
  )
}
