import { useState } from 'react'
import { Search, BookOpen, RotateCcw, Trash2, Clock, ChevronDown, PlusCircle, X, Edit2, Calendar, FileText, ChevronUp, ArrowRight } from 'lucide-react'
import { PERSONAS } from '../data.js'
import { loadSessions, deleteSession, deleteSessions, groupSessionsByProposal, renameProposal, updateSessionMeeting, loadLocalMeetings } from '../utils/storage.js'

function loadGroups() {
  return groupSessionsByProposal(loadSessions())
}

export default function PastSessions({ navigate }) {
  const INITIAL_LIMIT = 5

  const [query, setQuery]               = useState('')
  const [collapsed, setCollapsed]       = useState(new Set())
  const [groups, setGroups]             = useState(loadGroups)
  const [showAll, setShowAll]           = useState(false)
  const [editingProposal, setEditingProposal] = useState(null)
  const [editingName, setEditingName]   = useState('')
  const [expandedSession, setExpandedSession] = useState(null)
  const [assigningSession, setAssigningSession] = useState(null)

  const filtered = groups.filter(g =>
    g.proposal.toLowerCase().includes(query.toLowerCase())
  )

  const visibleGroups  = (showAll || query) ? filtered : filtered.slice(0, INITIAL_LIMIT)
  const hiddenCount    = Math.max(0, filtered.length - INITIAL_LIMIT)

  const toggleGroup = (name) => {
    if (editingProposal) return
    setCollapsed(prev => {
      const next = new Set(prev)
      next.has(name) ? next.delete(name) : next.add(name)
      return next
    })
  }

  const handleDelete = (sessionId) => {
    if (!window.confirm('Delete this session? This cannot be undone.')) return
    deleteSession(sessionId)
    setGroups(loadGroups())
  }

  const startRename = (e, proposal) => {
    e.stopPropagation()
    setEditingProposal(proposal)
    setEditingName(proposal)
  }

  const handleDeleteGroup = (e, group) => {
    e.stopPropagation()
    const count = group.sessions.length
    if (!window.confirm(`Delete all ${count} session${count !== 1 ? 's' : ''} in this group? This cannot be undone.`)) return
    deleteSessions(group.sessions.map(s => s.id))
    setGroups(loadGroups())
  }

  const commitRename = (oldName) => {
    const trimmed = editingName.trim()
    if (trimmed && trimmed !== oldName) {
      renameProposal(oldName, trimmed)
      setGroups(loadGroups())
      setCollapsed(new Set())
    }
    setEditingProposal(null)
    setEditingName('')
  }

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">Past Sessions</div>
        <div className="page-subtitle">Rehearsals grouped by meeting or proposal. Track how you improve across attempts.</div>
      </div>

      {groups.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '64px 0' }}>
          <div style={{ fontSize: '0.9375rem', color: 'var(--text-muted)', marginBottom: 16 }}>
            No sessions yet. Start a rehearsal to see your history here.
          </div>
          <button className="btn btn-primary btn-sm" style={{ margin: '0 auto' }} onClick={() => navigate('new')}>
            <PlusCircle size={12} /> Start your first rehearsal
          </button>
        </div>
      ) : (
        <>
          <div className="search-bar">
            <Search size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            <input
              className="search-input"
              placeholder="Search by proposal name..."
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px 4px', display: 'flex', alignItems: 'center', flexShrink: 0 }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {filtered.length === 0 && query ? (
            <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: '0.9375rem', marginBottom: 10 }}>No sessions match "{query}"</div>
              <button
                onClick={() => setQuery('')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--app-accent)', fontSize: '0.875rem', fontFamily: 'var(--font-ui)', fontWeight: 500 }}
              >
                Clear search
              </button>
            </div>
          ) : visibleGroups.map((group, gi) => (
            <div key={gi} className="proposal-group">
              <div className="proposal-group-header" onClick={() => toggleGroup(group.proposal)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <ChevronDown
                    size={16}
                    style={{
                      color: 'var(--text-muted)',
                      transform: collapsed.has(group.proposal) ? 'rotate(-90deg)' : 'rotate(0deg)',
                      transition: 'transform 0.2s ease',
                      flexShrink: 0,
                    }}
                  />
                  {group.noMeeting ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="proposal-group-name" style={{ color: 'var(--text-muted)', fontWeight: 500 }}>No meeting</span>
                    </div>
                  ) : editingProposal === group.proposal ? (
                    <input
                      value={editingName}
                      onChange={e => setEditingName(e.target.value)}
                      onBlur={() => commitRename(group.proposal)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') e.currentTarget.blur()
                        if (e.key === 'Escape') { setEditingProposal(null); setEditingName('') }
                      }}
                      autoFocus
                      onClick={e => e.stopPropagation()}
                      style={{
                        fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)',
                        background: 'var(--bg-surface)', border: '1.5px solid var(--app-accent)',
                        borderRadius: 6, padding: '3px 8px', fontFamily: 'var(--font-ui)',
                        outline: 'none', minWidth: 220,
                      }}
                    />
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Calendar size={13} style={{ color: 'var(--app-accent)', flexShrink: 0 }} />
                      <span className="proposal-group-name">{group.proposal}</span>
                    </div>
                  )}
                  {!group.noMeeting && (
                    <>
                      <button
                        onClick={e => startRename(e, group.proposal)}
                        title="Rename"
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          color: 'var(--text-muted)', padding: 4, display: 'flex', alignItems: 'center',
                          opacity: 0.6, transition: 'opacity 0.15s',
                        }}
                        onMouseEnter={e => e.currentTarget.style.opacity = 1}
                        onMouseLeave={e => e.currentTarget.style.opacity = 0.6}
                      >
                        <Edit2 size={12} />
                      </button>
                      <button
                        onClick={e => handleDeleteGroup(e, group)}
                        title="Delete all sessions in this group"
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          color: 'var(--text-muted)', padding: 4, display: 'flex', alignItems: 'center',
                          opacity: 0.5, transition: 'all 0.15s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.opacity = 1; e.currentTarget.style.color = '#DC2626' }}
                        onMouseLeave={e => { e.currentTarget.style.opacity = 0.5; e.currentTarget.style.color = 'var(--text-muted)' }}
                      >
                        <Trash2 size={12} />
                      </button>
                    </>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {group.sessions.length > 1 && (() => {
                    const first = group.sessions[group.sessions.length - 1]
                    const last  = group.sessions[0]
                    const delta = (last.condMet || 0) - (first.condMet || 0)
                    if (delta <= 0) return null
                    return (
                      <span style={{ fontSize: '0.75rem', color: '#059669', fontWeight: 600 }}>
                        +{delta} conditions across rehearsals
                      </span>
                    )
                  })()}
                  <span className="proposal-group-count">{group.sessions.length} rehearsal{group.sessions.length !== 1 ? 's' : ''}</span>
                </div>
              </div>

              {!collapsed.has(group.proposal) && group.sessions.map((s, si) => {
                const pct    = s.condTotal ? Math.round((s.condMet / s.condTotal) * 100) : 0
                const isGood = pct >= 60
                const sessionKey = s.id || si
                const isExpanded = expandedSession === sessionKey
                return (
                  <div key={sessionKey}>
                    <div className="session-row" onClick={() => navigate('report', { savedSession: s })}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <span className="session-row-name">{s.proposal || group.proposal}</span>
                        {s.reportData?.demo && (
                          <span style={{
                            fontSize: '0.5625rem', fontWeight: 700, letterSpacing: '0.06em',
                            textTransform: 'uppercase', padding: '2px 6px', borderRadius: 4,
                            background: 'rgba(245,158,11,0.1)', color: '#D97706', flexShrink: 0,
                          }}>Demo</span>
                        )}
                      </div>
                        <div className="session-row-date" style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
                          <Clock size={11} /> {s.date}{s.duration ? ` · ${s.duration}` : ''}
                        </div>
                      </div>

                      <div style={{ display: 'flex' }}>
                        {(s.personaIds?.length
                          ? PERSONAS.filter(p => s.personaIds.includes(p.id))
                          : PERSONAS
                        ).map((p, j) => (
                          <div
                            key={p.id}
                            style={{
                              width: 24, height: 24, borderRadius: '50%',
                              background: p.color,
                              border: '2px solid var(--bg-surface)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: '0.5625rem', fontWeight: 700, color: 'white',
                              marginLeft: j > 0 ? -6 : 0,
                            }}
                          >{p.initial}</div>
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
                        <button className="session-action-btn" onClick={e => { e.stopPropagation(); navigate('report', { savedSession: s }) }}>
                          <BookOpen size={12} style={{ display: 'inline', marginRight: 4 }} />
                          Report
                        </button>
                        <button className="session-action-btn" onClick={e => { e.stopPropagation(); navigate('debrief', { savedSession: s }) }}>
                          Debrief
                        </button>
                        {s.proposalText && (
                          <button
                            className="session-action-btn"
                            onClick={e => { e.stopPropagation(); setExpandedSession(isExpanded ? null : sessionKey) }}
                            style={isExpanded ? { color: 'var(--app-accent)', borderColor: 'rgba(180,83,9,0.25)' } : undefined}
                          >
                            <FileText size={12} style={{ display: 'inline', marginRight: 4 }} />
                            {isExpanded ? 'Hide' : 'Proposal'}
                          </button>
                        )}
                        <button className="session-action-btn" onClick={e => { e.stopPropagation(); navigate('new', { meetingName: s.proposal, linkedMeeting: s.linkedMeeting || '', proposalText: s.proposalText || '' }) }}>
                          <RotateCcw size={12} style={{ display: 'inline', marginRight: 4 }} />
                          Again
                        </button>
                        {assigningSession === sessionKey ? (
                          <select
                            autoFocus
                            defaultValue=""
                            onClick={e => e.stopPropagation()}
                            onChange={e => {
                              e.stopPropagation()
                              updateSessionMeeting(s.id, e.target.value)
                              setGroups(loadGroups())
                              setAssigningSession(null)
                            }}
                            onBlur={() => setAssigningSession(null)}
                            style={{
                              fontSize: '0.75rem', fontFamily: 'var(--font-ui)',
                              border: '1px solid var(--app-accent)', borderRadius: 6,
                              padding: '3px 6px', background: 'var(--bg-surface)',
                              color: 'var(--text-primary)', cursor: 'pointer', outline: 'none',
                            }}
                          >
                            <option value="" disabled>Move to...</option>
                            {groups.filter(g => !g.noMeeting && g.proposal !== group.proposal).map(g => (
                              <option key={g.proposal} value={g.linkedMeeting}>{g.proposal}</option>
                            ))}
                            {loadLocalMeetings()
                              .filter(m => !groups.some(g => g.linkedMeeting === m.name))
                              .map(m => (
                                <option key={m.id} value={m.name}>{m.name}</option>
                              ))
                            }
                            {!group.noMeeting && <option value="">No meeting</option>}
                          </select>
                        ) : (
                          <button
                            className="session-action-btn"
                            title="Assign to meeting"
                            onClick={e => { e.stopPropagation(); setAssigningSession(sessionKey) }}
                          >
                            <ArrowRight size={12} style={{ display: 'inline', marginRight: 4 }} />
                            Assign
                          </button>
                        )}
                        <button
                          className="session-action-btn"
                          style={{ color: '#DC2626', borderColor: 'rgba(220,38,38,0.2)' }}
                          onClick={e => { e.stopPropagation(); handleDelete(s.id) }}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                    {isExpanded && s.proposalText && (
                      <div style={{
                        margin: '0 0 8px', padding: '16px 20px',
                        background: 'var(--bg-surface)', border: '1px solid var(--border)',
                        borderTop: 'none', borderRadius: '0 0 10px 10px',
                        whiteSpace: 'pre-wrap', fontSize: '0.8125rem', lineHeight: 1.7,
                        color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)',
                        maxHeight: 320, overflowY: 'auto',
                        userSelect: 'text',
                      }}>
                        {s.proposalText}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ))}

          {!showAll && !query && hiddenCount > 0 && (
            <button
              onClick={() => setShowAll(true)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: '100%', padding: '12px', marginTop: 4,
                background: 'none', border: '1px dashed var(--border)',
                borderRadius: 10, cursor: 'pointer', fontFamily: 'var(--font-ui)',
                fontSize: '0.8125rem', color: 'var(--text-muted)',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--text-muted)'; e.currentTarget.style.color = 'var(--text-primary)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)' }}
            >
              Show {hiddenCount} more proposal{hiddenCount !== 1 ? 's' : ''}
            </button>
          )}
        </>
      )}
    </div>
  )
}
