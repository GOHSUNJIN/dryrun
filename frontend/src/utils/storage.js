const SESSIONS_KEY        = 'dryrun_sessions'
const PROFILE_KEY         = 'dryrun_profile'
const VOICE_KEY           = 'dryrun_voice'
const CUSTOM_PERSONAS_KEY = 'dryrun_custom_personas'
const DEFAULTS_KEY        = 'dryrun_defaults'

export function loadSessions() {
  try {
    return JSON.parse(localStorage.getItem(SESSIONS_KEY) || '[]')
  } catch { return [] }
}

export function saveSessions(sessions) {
  try {
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions))
  } catch (e) {
    // QuotaExceededError: drop oldest session and retry once
    try {
      const trimmed = sessions.slice(0, sessions.length - 1)
      localStorage.setItem(SESSIONS_KEY, JSON.stringify(trimmed))
    } catch (e2) { console.warn('[storage] saveSessions failed after trim — storage may be full:', e2) }
  }
}

export function saveSession(sessionSummary) {
  const prev = loadSessions()
  saveSessions([sessionSummary, ...prev].slice(0, 20))
}

export function deleteSession(sessionId) {
  saveSessions(loadSessions().filter(s => s.id !== sessionId))
}

export function deleteSessions(ids) {
  const idSet = new Set(ids)
  saveSessions(loadSessions().filter(s => !idSet.has(s.id)))
}

export function deleteAllSessions() {
  localStorage.removeItem(SESSIONS_KEY)
}

export function exportSessions() {
  const data = loadSessions()
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `dryrun-sessions-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export function loadProfile() {
  try {
    const p = JSON.parse(localStorage.getItem(PROFILE_KEY) || '{}')
    const name = p.name || ''
    return {
      name,
      role:    p.role || '',
      initial: name ? name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : '?',
    }
  } catch {
    return { name: '', role: '', initial: '?' }
  }
}

export function saveProfile(name, role) {
  localStorage.setItem(PROFILE_KEY, JSON.stringify({ name, role }))
}

export function loadCustomPersonas() {
  try { return JSON.parse(localStorage.getItem(CUSTOM_PERSONAS_KEY) || '[]') }
  catch { return [] }
}

export function saveCustomPersonas(personas) {
  localStorage.setItem(CUSTOM_PERSONAS_KEY, JSON.stringify(personas))
}

export function addCustomPersona(persona) {
  saveCustomPersonas([...loadCustomPersonas(), persona])
}

export function updateCustomPersona(id, updates) {
  saveCustomPersonas(loadCustomPersonas().map(p => p.id === id ? { ...p, ...updates } : p))
}

export function deleteCustomPersona(id) {
  saveCustomPersonas(loadCustomPersonas().filter(p => p.id !== id))
}

export function loadRehearsalDefaults() {
  try {
    const d = JSON.parse(localStorage.getItem(DEFAULTS_KEY) || '{}')
    return {
      toughness: d.toughness || 'Balanced',
      turnLimit: d.turnLimit || '15',
    }
  } catch { return { toughness: 'Balanced', turnLimit: '15' } }
}

export function saveRehearsalDefaults(defaults) {
  localStorage.setItem(DEFAULTS_KEY, JSON.stringify(defaults))
}

export function loadVoiceSettings() {
  try {
    const v = JSON.parse(localStorage.getItem(VOICE_KEY) || '{}')
    return { enabled: v.enabled === true, rate: Number(v.rate) || 1.0 }
  } catch { return { enabled: false, rate: 1.0 } }
}

export function saveVoiceSettings(settings) {
  localStorage.setItem(VOICE_KEY, JSON.stringify(settings))
}

const LAST_PANEL_KEY = 'dryrun_last_panel'

export function loadLastPanel() {
  try { return JSON.parse(localStorage.getItem(LAST_PANEL_KEY) || 'null') }
  catch { return null }
}

export function saveLastPanel(ids) {
  localStorage.setItem(LAST_PANEL_KEY, JSON.stringify(ids))
}

const MEETINGS_KEY = 'dryrun_meetings'

export function loadLocalMeetings() {
  try { return JSON.parse(localStorage.getItem(MEETINGS_KEY) || '[]') }
  catch { return [] }
}

export function addLocalMeeting(meeting) {
  localStorage.setItem(MEETINGS_KEY, JSON.stringify([...loadLocalMeetings(), meeting]))
}

export function deleteLocalMeeting(id) {
  const meetings = loadLocalMeetings()
  const target = meetings.find(m => m.id === id)
  localStorage.setItem(MEETINGS_KEY, JSON.stringify(meetings.filter(m => m.id !== id)))
  // Clear linkedMeeting on every session that was attached to this meeting
  if (target?.name) {
    saveSessions(loadSessions().map(s =>
      s.linkedMeeting === target.name ? { ...s, linkedMeeting: '' } : s
    ))
  }
}

export function renameProposal(oldName, newName) {
  saveSessions(loadSessions().map(s => s.proposal === oldName ? { ...s, proposal: newName } : s))
}

export function updateSessionMeeting(sessionId, newLinkedMeeting) {
  saveSessions(loadSessions().map(s =>
    s.id === sessionId ? { ...s, linkedMeeting: newLinkedMeeting || '' } : s
  ))
}

export function computeWeakSpots() {
  const sessions = loadSessions()
  const byLabel = {}

  for (const s of sessions) {
    const wps = s.reportData?.weak_points
    if (!Array.isArray(wps) || wps.length === 0) continue
    const seenLabels = new Set()
    for (const wp of wps) {
      if (!wp.label) continue
      if (!byLabel[wp.label]) byLabel[wp.label] = { count: 0, latestIssue: '', sessions: [] }
      byLabel[wp.label].count++
      byLabel[wp.label].latestIssue = wp.issue || wp.label
      if (!seenLabels.has(wp.label)) {
        byLabel[wp.label].sessions.push({ proposal: s.proposal || '', meeting: s.linkedMeeting || '' })
        seenLabels.add(wp.label)
      }
    }
  }

  return Object.entries(byLabel)
    .sort((a, b) => b[1].count - a[1].count)
    .map(([, data]) => {
      const { sessions } = data
      let sub
      if (sessions.length === 1) {
        const { proposal, meeting } = sessions[0]
        sub = `In: ${proposal || 'a session'}${meeting ? ` · ${meeting}` : ''}`
      } else {
        const names = sessions.map(s => s.proposal).filter(Boolean)
        const shown = names.slice(0, 2)
        const extra = names.length - 2
        sub = shown.length
          ? `From: ${shown.join(', ')}${extra > 0 ? ` +${extra} more` : ''}`
          : `Across ${sessions.length} sessions`
      }
      return { count: data.count, text: data.latestIssue, sub }
    })
}

const CAL_EVENTS_KEY      = 'dryrun_cal_events'
const DISMISSED_SPOTS_KEY = 'dryrun_dismissed_spots'

export function loadCalEvents() {
  try { return JSON.parse(localStorage.getItem(CAL_EVENTS_KEY) || 'null') }
  catch { return null }
}

export function saveCalEvents(events) {
  localStorage.setItem(CAL_EVENTS_KEY, JSON.stringify(events))
}

export function clearCalEvents() {
  localStorage.removeItem(CAL_EVENTS_KEY)
}

export function deleteCalEvent(name) {
  const events = loadCalEvents()
  if (!Array.isArray(events)) return
  saveCalEvents(events.filter(e => e.name !== name))
}

export function loadDismissedSpots() {
  try { return new Set(JSON.parse(localStorage.getItem(DISMISSED_SPOTS_KEY) || '[]')) }
  catch { return new Set() }
}

export function dismissWeakSpot(text) {
  const prev = loadDismissedSpots()
  prev.add(text)
  localStorage.setItem(DISMISSED_SPOTS_KEY, JSON.stringify([...prev]))
}

const NO_MEETING_KEY = '__no_meeting__'

export function groupSessionsByProposal(sessions) {
  const groups = {}
  for (const s of sessions) {
    if (s.linkedMeeting) {
      const key = s.linkedMeeting
      if (!groups[key]) groups[key] = { proposal: key, linkedMeeting: key, noMeeting: false, sessions: [] }
      groups[key].sessions.push(s)
    } else {
      if (!groups[NO_MEETING_KEY]) groups[NO_MEETING_KEY] = { proposal: 'No meeting', linkedMeeting: '', noMeeting: true, sessions: [] }
      groups[NO_MEETING_KEY].sessions.push(s)
    }
  }
  // Include meetings with no sessions yet so they still appear in the list
  for (const m of loadLocalMeetings()) {
    if (!groups[m.name]) {
      groups[m.name] = { proposal: m.name, linkedMeeting: m.name, noMeeting: false, sessions: [], meetingId: m.id }
    }
  }
  const linked   = Object.entries(groups).filter(([k]) => k !== NO_MEETING_KEY).map(([, v]) => v)
  const unlinked = groups[NO_MEETING_KEY] ? [groups[NO_MEETING_KEY]] : []
  return [...linked, ...unlinked]
}
