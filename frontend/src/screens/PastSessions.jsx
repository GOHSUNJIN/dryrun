import { useState } from 'react'
import { Search, BookOpen, RotateCcw, Trash2, Clock, ChevronDown, PlusCircle, X, Edit2, Calendar, FileText, ChevronUp, FolderInput, LayoutList } from 'lucide-react'
import { PERSONAS } from '../data.js'
import { loadSessions, deleteSession, deleteSessions, groupSessionsByProposal, renameProposal, renameSession, updateSessionMeeting, loadLocalMeetings, deleteLocalMeeting, deleteCalEvent, loadCustomPersonas, nextSessionName } from '../utils/storage.js'

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
  const [editingSessionId, setEditingSessionId] = useState(null)
  const [editingSessionName, setEditingSessionName] = useState('')

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
    if (group.sessions.length === 0) {
      if (!window.confirm(`Remove "${group.proposal}" from your meetings?`)) return
      const m = loadLocalMeetings().find(lm => lm.name === group.linkedMeeting)
      if (m) deleteLocalMeeting(m.id)
      else deleteCalEvent(group.linkedMeeting)
      setGroups(loadGroups())
      return
    }
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

  const commitSessionRename = (sessionId) => {
    const trimmed = editingSessionName.trim()
    if (trimmed) {
      renameSession(sessionId, trimmed)
      setGroups(loadGroups())
    }
    setEditingSessionId(null)
    setEditingSessionName('')
  }

  const totalRuns = groups.reduce((acc, g) => acc + g.sessions.length, 0)

  return (
    <div className="page">
      <div className="past-page-header">
        <div>
          <div className="page-title">Past Sessions</div>
          <div className="page-subtitle">Rehearsals grouped by meeting or proposal.</div>
        </div>
        {totalRuns > 0 && (
          <div className="past-page-stat">
            <span className="past-page-stat-num">{totalRuns}</span>
            <span className="past-page-stat-label">run{totalRuns !== 1 ? 's' : ''}</span>
          </div>
        )}
      </div>

      {groups.length === 0 ? (
        <div className="past-empty-card">
          <div className="past-empty-icon">
            <Clock size={28} strokeWidth={1.5} />
          </div>
          <div className="past-empty-title">No runs yet</div>
          <div className="past-empty-body">Complete a rehearsal and your sessions will appear here.</div>
          <button className="btn btn-accent btn-sm" onClick={() => navigate('new')}>
            <PlusCircle size={12} /> Start Your First Rehearsal
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
                Clear Search
              </button>
            </div>
          ) : visibleGroups.map((group, gi) => (
            <div key={gi} className="proposal-group">
              <div className="proposal-group-header" onClick={() => toggleGroup(group.proposal)} style={{ borderRadius: collapsed.has(group.proposal) ? 'var(--r-lg)' : 'var(--r-lg) var(--r-lg) 0 0' }}>
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
                      {group.sessions.length > 0 && (
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
                      )}
                      <button
                        onClick={e => handleDeleteGroup(e, group)}
                        title={group.sessions.length === 0 ? 'Remove meeting' : 'Delete all sessions in this group'}
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
                  <span className="proposal-group-count">
                    {group.sessions.length === 0 ? 'No Rehearsals Yet' : `${group.sessions.length} rehearsal${group.sessions.length !== 1 ? 's' : ''}`}
                  </span>
                </div>
              </div>

              {!collapsed.has(group.proposal) && group.sessions.length === 0 && (
                <div className="proposal-group-body" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px' }}>
                  <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>No rehearsals yet</span>
                  <button
                    onClick={() => navigate('new', { meetingName: group.proposal, linkedMeeting: group.linkedMeeting })}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      fontSize: '0.8125rem', fontWeight: 500, color: 'var(--app-accent)',
                      background: 'var(--app-accent-bg)', border: '1px solid rgba(180,83,9,0.15)',
                      borderRadius: 6, padding: '5px 12px', cursor: 'pointer',
                      fontFamily: 'var(--font-ui)',
                    }}
                  >
                    Start One Now
                  </button>
                </div>
              )}
              {!collapsed.has(group.proposal) && group.sessions.map((s, si) => {
                const pct    = s.condTotal ? Math.round((s.condMet / s.condTotal) * 100) : 0
                const isGood = pct >= 60
                const sessionKey = s.id || si
                const isExpanded = expandedSession === sessionKey
                const isLast = si === group.sessions.length - 1
                return (
                  <div key={sessionKey} className="proposal-group-body" style={{ borderBottom: isLast && !isExpanded ? 'none' : '1px solid var(--border-light)', borderRadius: isLast && !isExpanded ? '0 0 var(--r-lg) var(--r-lg)' : undefined }}>
                    <div className="session-row" onClick={() => { if (editingSessionId === sessionKey) return; navigate('report', { savedSession: s }) }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                          {editingSessionId === sessionKey ? (
                            <input
                              autoFocus
                              value={editingSessionName}
                              onChange={e => setEditingSessionName(e.target.value)}
                              onBlur={() => commitSessionRename(s.id)}
                              onKeyDown={e => { if (e.key === 'Enter') commitSessionRename(s.id); if (e.key === 'Escape') { setEditingSessionId(null); setEditingSessionName('') } }}
                              onClick={e => e.stopPropagation()}
                              style={{ fontFamily: 'var(--font-ui)', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', background: 'var(--bg-hover)', border: '1px solid var(--app-accent)', borderRadius: 5, padding: '2px 7px', width: 200 }}
                            />
                          ) : (
                            <span className="session-row-name">{s.proposal || group.proposal}</span>
                          )}
                          {s.reportData?.demo && (
                            <span style={{
                              fontSize: '0.5625rem', fontWeight: 700, letterSpacing: '0.06em',
                              textTransform: 'uppercase', padding: '2px 6px', borderRadius: 4,
                              background: 'rgba(245,158,11,0.1)', color: '#D97706', flexShrink: 0,
                            }}>Demo</span>
                          )}
                          {editingSessionId !== sessionKey && (
                            <button
                              onClick={e => { e.stopPropagation(); setEditingSessionId(sessionKey); setEditingSessionName(s.proposal || group.proposal) }}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2, display: 'flex', opacity: 0, transition: 'opacity 0.15s' }}
                              className="session-edit-btn"
                            >
                              <Edit2 size={11} />
                            </button>
                          )}
                        </div>
                        <div className="session-row-date" style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
                          <Clock size={11} /> {s.date}{s.duration ? ` · ${s.duration}` : ''}
                        </div>
                      </div>

                      <div style={{ display: 'flex' }}>
                        {(s.personaIds?.length
                          ? [...PERSONAS, ...loadCustomPersonas()].filter(p => s.personaIds.includes(p.id))
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
                        <button className="session-action-btn" title="Debrief: moment by moment replay" onClick={e => { e.stopPropagation(); navigate('debrief', { savedSession: s }) }}>
                          <LayoutList size={12} style={{ opacity: 0.6 }} />
                        </button>
                        {s.proposalText && (
                          <button
                            className="session-action-btn"
                            title={isExpanded ? 'Hide proposal' : 'View proposal'}
                            onClick={e => { e.stopPropagation(); setExpandedSession(isExpanded ? null : sessionKey) }}
                            style={isExpanded ? { color: 'var(--app-accent)', borderColor: 'rgba(180,83,9,0.25)' } : undefined}
                          >
                            <FileText size={12} />
                          </button>
                        )}
                        <button className="session-action-btn" onClick={e => { e.stopPropagation(); navigate('new', { proposalText: s.proposalText || '', documentName: s.documentName || s.proposal || '', meetingName: nextSessionName(s.proposal || ''), linkedMeeting: s.linkedMeeting || '', personaIds: s.personaIds || [], toughness: s.config?.toughness || '', turnLimit: s.config?.turnLimit || '' }) }}>
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
                            title="Move to meeting"
                            onClick={e => { e.stopPropagation(); setAssigningSession(sessionKey) }}
                          >
                            <FolderInput size={12} />
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
                        padding: '14px 20px 16px',
                        borderTop: '1px solid var(--border-light)',
                        borderRadius: isLast ? '0 0 var(--r-lg) var(--r-lg)' : undefined,
                        whiteSpace: 'pre-wrap', fontSize: '0.8125rem', lineHeight: 1.7,
                        color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)',
                        maxHeight: 280, overflowY: 'auto',
                        userSelect: 'text',
                        background: 'rgba(0,0,0,0.015)',
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
