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
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions))
}

export function saveSession(sessionSummary) {
  const prev = loadSessions()
  saveSessions([sessionSummary, ...prev].slice(0, 20))
}

export function deleteSession(sessionId) {
  saveSessions(loadSessions().filter(s => s.id !== sessionId))
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
    return {
      name:    p.name    || 'Sun Jin',
      role:    p.role    || 'Product Manager',
      initial: (p.name || 'Sun Jin').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase(),
    }
  } catch {
    return { name: 'Sun Jin', role: 'Product Manager', initial: 'SJ' }
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

const MEETINGS_KEY = 'dryrun_meetings'

export function loadLocalMeetings() {
  try { return JSON.parse(localStorage.getItem(MEETINGS_KEY) || '[]') }
  catch { return [] }
}

export function addLocalMeeting(meeting) {
  localStorage.setItem(MEETINGS_KEY, JSON.stringify([...loadLocalMeetings(), meeting]))
}

export function deleteLocalMeeting(id) {
  localStorage.setItem(MEETINGS_KEY, JSON.stringify(loadLocalMeetings().filter(m => m.id !== id)))
}

export function renameProposal(oldName, newName) {
  saveSessions(loadSessions().map(s => s.proposal === oldName ? { ...s, proposal: newName } : s))
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
      if (!byLabel[wp.label]) byLabel[wp.label] = { count: 0, sessionCount: 0, latestIssue: '' }
      byLabel[wp.label].count++
      byLabel[wp.label].latestIssue = wp.issue || wp.label
      if (!seenLabels.has(wp.label)) {
        byLabel[wp.label].sessionCount++
        seenLabels.add(wp.label)
      }
    }
  }

  return Object.entries(byLabel)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 3)
    .map(([, data]) => ({
      count: data.count,
      text: data.latestIssue,
      sub: `Across ${data.sessionCount} session${data.sessionCount !== 1 ? 's' : ''}`,
    }))
}

export function groupSessionsByProposal(sessions) {
  const groups = {}
  for (const s of sessions) {
    const key = s.proposal || 'Untitled proposal'
    if (!groups[key]) groups[key] = { proposal: key, sessions: [] }
    groups[key].sessions.push(s)
  }
  return Object.values(groups)
}
