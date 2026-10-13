import { useState } from 'react'
import { Search, BookOpen, RotateCcw, Trash2, Clock, ChevronDown } from 'lucide-react'
import { PAST_SESSIONS } from '../data.js'

const AVATAR_COLORS   = ['#F59E0B', '#0FB8AA', '#9061F9', '#5B8FD6']
const AVATAR_INITIALS = ['M', 'A', 'J', 'S']

function loadSessions() {
  try {
    const stored = JSON.parse(localStorage.getItem('dryrun_sessions') || '[]')
    if (stored.length) {
      const groups = {}
      for (const s of stored) {
        const key = s.proposal || 'Untitled proposal'
        if (!groups[key]) groups[key] = { proposal: key, sessions: [] }
        groups[key].sessions.push(s)
      }
      return Object.values(groups)
    }
  } catch {}
  return PAST_SESSIONS
}

export default function PastSessions({ navigate }) {
  const [query, setQuery]       = useState('')
  const [expanded, setExpanded] = useState({ 0: true, 1: true, 2: true })
  const [groups, setGroups]     = useState(loadSessions)

  const filtered = groups.filter(g =>
    g.proposal.toLowerCase().includes(query.toLowerCase())
  )

  const toggleGroup = (i) => setExpanded(e => ({ ...e, [i]: !e[i] }))

  const deleteSession = (groupIdx, sessionId) => {
    try {
      const stored = JSON.parse(localStorage.getItem('dryrun_sessions') || '[]')
      const updated = stored.filter(s => s.id !== sessionId)
      localStorage.setItem('dryrun_sessions', JSON.stringify(updated))
      setGroups(loadSessions())
    } catch {}
  }

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">Past Sessions</div>
        <div className="page-subtitle">Every rehearsal grouped by proposal. Track how you improve across attempts.</div>
      </div>

      <div className="search-bar">
        <Search size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
        <input
          className="search-input"
          placeholder="Search by proposal name..."
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
      </div>

      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)', fontSize: '0.9375rem' }}>
          No sessions match "{query}"
        </div>
      )}

      {filtered.map((group, gi) => (
        <div key={gi} className="proposal-group">
          <div className="proposal-group-header" onClick={() => toggleGroup(gi)}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <ChevronDown
                size={16}
                style={{
                  color: 'var(--text-muted)',
                  transform: expanded[gi] ? 'rotate(0deg)' : 'rotate(-90deg)',
                  transition: 'transform 0.2s ease',
                }}
              />
              <span className="proposal-group-name">{group.proposal}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {group.sessions.length > 1 && (() => {
                const first = group.sessions[group.sessions.length - 1]
                const last  = group.sessions[0]
                const delta = (last.condMet || 0) - (first.condMet || 0)
                return (
                  <span style={{ fontSize: '0.75rem', color: delta > 0 ? '#059669' : 'var(--text-muted)', fontWeight: 600 }}>
                    {delta > 0 ? `+${delta} conditions` : 'No change'} across rehearsals
                  </span>
                )
              })()}
              <span className="proposal-group-count">{group.sessions.length} rehearsal{group.sessions.length !== 1 ? 's' : ''}</span>
            </div>
          </div>

          {expanded[gi] && group.sessions.map((s, si) => {
            const pct    = s.condTotal ? Math.round((s.condMet / s.condTotal) * 100) : 0
            const isGood = pct >= 60
            return (
              <div key={s.id || si} className="session-row" onClick={() => navigate('report')}>
                <div>
                  <div className="session-row-name">Rehearsal {group.sessions.length - si}</div>
                  <div className="session-row-date" style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
                    <Clock size={11} /> {s.date} · {s.mode} · {s.duration}
                  </div>
                </div>

                <div style={{ display: 'flex' }}>
                  {AVATAR_INITIALS.map((init, j) => (
                    <div
                      key={j}
                      style={{
                        width: 24, height: 24, borderRadius: '50%',
                        background: AVATAR_COLORS[j],
                        border: '2px solid var(--bg-surface)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '0.5625rem', fontWeight: 700, color: 'white',
                        marginLeft: j > 0 ? -6 : 0,
                      }}
                    >{init}</div>
                  ))}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 80, height: 5, background: 'var(--bg-hover)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', width: `${pct}%`,
                      background: isGood ? '#059669' : '#F59E0B',
                      borderRadius: 3, transition: 'width 0.4s ease',
                    }} />
                  </div>
                  <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: isGood ? '#059669' : '#D97706', minWidth: 48 }}>
                    {s.condMet}/{s.condTotal}
                  </span>
                </div>

                <div className="session-row-actions">
                  <button className="session-action-btn" onClick={e => { e.stopPropagation(); navigate('report') }}>
                    <BookOpen size={12} style={{ display: 'inline', marginRight: 4 }} />
                    Report
                  </button>
                  <button className="session-action-btn" onClick={e => { e.stopPropagation(); navigate('debrief') }}>
                    Debrief
                  </button>
                  <button className="session-action-btn" onClick={e => { e.stopPropagation(); navigate('room') }}>
                    <RotateCcw size={12} style={{ display: 'inline', marginRight: 4 }} />
                    Again
                  </button>
                  <button
                    className="session-action-btn"
                    style={{ color: '#DC2626', borderColor: 'rgba(220,38,38,0.2)' }}
                    onClick={e => { e.stopPropagation(); deleteSession(gi, s.id) }}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}
