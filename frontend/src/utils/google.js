const CLIENT_ID = '728299074921-jr7g4783mbfpt37ve80523k40inr9aoi.apps.googleusercontent.com'
const SCOPES = [
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/documents',
  'https://www.googleapis.com/auth/calendar.readonly',
].join(' ')

let _token = null
let _client = null

const STORAGE_KEY = 'dryrun_google_token'

function loadStoredToken() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
    if (!stored) return null
    if (Date.now() >= stored.expiresAt - 60000) {
      localStorage.removeItem(STORAGE_KEY)
      return null
    }
    return stored.token
  } catch { return null }
}

function storeToken(accessToken, expiresIn = 3600) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    token: accessToken,
    expiresAt: Date.now() + expiresIn * 1000,
  }))
}

function clearStoredToken() {
  localStorage.removeItem(STORAGE_KEY)
}

function waitForGis() {
  if (window.google?.accounts?.oauth2) return Promise.resolve()
  return new Promise(resolve => {
    const t = setInterval(() => {
      if (window.google?.accounts?.oauth2) { clearInterval(t); resolve() }
    }, 50)
  })
}

export async function signIn() {
  await waitForGis()
  return new Promise((resolve, reject) => {
    if (!_client) {
      _client = window.google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: () => {},
      })
    }
    _client.callback = (resp) => {
      if (resp.error) { reject(new Error(resp.error_description || resp.error)); return }
      _token = resp.access_token
      storeToken(resp.access_token, resp.expires_in)
      resolve(_token)
    }
    _client.requestAccessToken()
  })
}

export function isSignedIn() {
  if (_token) return true
  const stored = loadStoredToken()
  if (stored) { _token = stored; return true }
  return false
}

export function signOut() {
  if (_token) window.google?.accounts?.oauth2?.revoke(_token, () => {})
  _token = null
  _client = null
  clearStoredToken()
}

async function tok() {
  if (_token) return _token
  const stored = loadStoredToken()
  if (stored) { _token = stored; return _token }
  return signIn()
}

async function gfetch(url, opts = {}) {
  const t = await tok()
  const r = await fetch(url, { ...opts, headers: { Authorization: `Bearer ${t}`, ...(opts.headers || {}) } })
  if (r.status === 401) {
    _token = null
    clearStoredToken()
    const fresh = await signIn()
    return fetch(url, { ...opts, headers: { Authorization: `Bearer ${fresh}`, ...(opts.headers || {}) } })
  }
  return r
}

// Drive
export async function listDriveItems(folderId = 'root') {
  const q = encodeURIComponent(`'${folderId}' in parents and trashed = false`)
  const fields = 'files(id,name,mimeType,modifiedTime)'
  const r = await gfetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=${fields}&orderBy=folder,name&pageSize=50`
  )
  const data = await r.json()
  return (data.files || [])
    .map(f => ({
      id: f.id,
      name: f.name,
      isFolder: f.mimeType === 'application/vnd.google-apps.folder',
      isDoc: f.mimeType === 'application/vnd.google-apps.document',
      modifiedTime: f.modifiedTime,
    }))
    .filter(f => f.isFolder || f.isDoc)
}

export async function listDriveDocs() {
  const q = encodeURIComponent("mimeType='application/vnd.google-apps.document' and trashed=false")
  const r = await gfetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&orderBy=modifiedTime+desc&pageSize=10&fields=files(id,name,modifiedTime)`
  )
  const data = await r.json()
  return data.files || []
}

export async function fetchDocText(fileId) {
  const r = await gfetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=text/plain`
  )
  if (!r.ok) throw new Error(`Drive export failed: ${r.status}`)
  return r.text()
}

// Calendar
export async function fetchCalendarEvents() {
  const now = new Date().toISOString()
  const end = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  const r = await gfetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(now)}&timeMax=${encodeURIComponent(end)}&orderBy=startTime&singleEvents=true&maxResults=5`
  )
  const data = await r.json()
  return (data.items || []).map(e => {
    const start = e.start?.dateTime || e.start?.date
    const d = new Date(start)
    const daysLeft = Math.ceil((d - Date.now()) / 86400000)
    return {
      name: e.summary || 'Untitled meeting',
      date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      daysLeft: Math.max(0, daysLeft),
    }
  })
}

// Docs
export async function exportToGoogleDoc(proposalName, weakPoints, personas, conditions) {
  const t = await tok()

  const createRes = await fetch('https://docs.googleapis.com/v1/documents', {
    method: 'POST',
    headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: `Dry Run Report: ${proposalName}` }),
  })
  const doc = await createRes.json()
  if (!doc.documentId) throw new Error('Failed to create document')

  const lines = [
    `Dry Run Report`,
    `${proposalName}`,
    ``,
    `CONDITIONS`,
    ``,
    ...personas.flatMap(p => [
      `${p.name} (${p.role})`,
      ...(p.conditions || []).map(c => `${conditions[c.id] ? '[MET]' : '[   ]'}  ${c.text}`),
      ``,
    ]),
    `WEAK POINTS`,
    ``,
    ...weakPoints.flatMap(w => [
      `${w.label}`,
      `Issue: ${w.issue}`,
      `Fix: ${w.fix}`,
      ``,
    ]),
  ]

  await fetch(`https://docs.googleapis.com/v1/documents/${doc.documentId}:batchUpdate`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requests: [{ insertText: { location: { index: 1 }, text: lines.join('\n') } }],
    }),
  })

  return `https://docs.google.com/document/d/${doc.documentId}/edit`
}
