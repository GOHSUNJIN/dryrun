import { useState } from 'react'
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import Sidebar, { MobileNav, MobileHeader } from './components/Sidebar.jsx'
import Home from './screens/Home.jsx'
import NewRehearsal from './screens/NewRehearsal.jsx'
import RehearsalRoom from './screens/RehearsalRoom.jsx'
import Report from './screens/Report.jsx'
import Debrief from './screens/Debrief.jsx'
import PastSessions from './screens/PastSessions.jsx'
import PanelLibrary from './screens/PanelLibrary.jsx'
import Settings from './screens/Settings.jsx'

const SCREEN_PATH = {
  home:     '/',
  new:      '/new',
  room:     '/room',
  report:   '/report',
  debrief:  '/debrief',
  past:     '/past',
  library:  '/library',
  settings: '/settings',
}

const PATH_SCREEN = Object.fromEntries(
  Object.entries(SCREEN_PATH).map(([k, v]) => [v, k])
)

const SCREENS_WITH_SIDEBAR = ['home', 'past', 'library', 'settings']

const DEFAULT_SESSION = {
  proposalText: '',
  proposalName: '',
  personaIds: ['finance', 'legal', 'ops', 'factcheck'],
  config: { toughness: 'Balanced' },
  transcript: [],
  conditions: {},
  factCheckNotes: '',
  customPersonaDefs: {},
  reportData: null,
  startTime: null,
  duration: '',
  linkedMeeting: '',
  documentName: '',
}

export default function App() {
  const routerNav             = useNavigate()
  const { pathname }          = useLocation()
  const [navPayload, setNavPayload] = useState({})
  const [session, setSession]       = useState(DEFAULT_SESSION)

  const screen = PATH_SCREEN[pathname] || 'home'

  const navigate = (s, payload = {}) => {
    setNavPayload(payload)
    if (payload.savedSession) {
      const sv = payload.savedSession
      setSession({
        ...DEFAULT_SESSION,
        id:            sv.id || null,
        proposalName:  sv.proposal || '',
        proposalText:  sv.proposalText || '',
        documentName:  sv.documentName || sv.proposal || '',
        personaIds:    sv.personaIds || [],
        config:        sv.config || DEFAULT_SESSION.config,
        conditions:    sv.conditions || {},
        reportData:    sv.reportData || null,
        duration:      sv.duration || '',
        linkedMeeting: sv.linkedMeeting || '',
      })
    }
    routerNav(SCREEN_PATH[s] ?? '/')
  }

  const showSidebar  = SCREENS_WITH_SIDEBAR.includes(screen)
  const updateSession = (updates) => setSession(prev => ({ ...prev, ...updates }))
  const resetSession  = () => setSession(DEFAULT_SESSION)

  return (
    <div className="app-shell">
      {showSidebar && <Sidebar current={screen} navigate={navigate} />}
      <AnimatePresence mode="wait">
        <motion.div
          key={pathname}
          className="app-main"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          style={{ flex: 1, height: '100%', overflow: screen === 'room' ? 'hidden' : 'auto' }}
        >
          <Routes>
            <Route path="/"         element={<Home navigate={navigate} />} />
            <Route path="/new"      element={<NewRehearsal navigate={navigate} session={session} updateSession={updateSession} resetSession={resetSession} navPayload={navPayload} />} />
            <Route path="/room"     element={<RehearsalRoom navigate={navigate} session={session} updateSession={updateSession} />} />
            <Route path="/report"   element={<Report navigate={navigate} session={session} />} />
            <Route path="/debrief"  element={<Debrief navigate={navigate} session={session} />} />
            <Route path="/past"     element={<PastSessions navigate={navigate} />} />
            <Route path="/library"  element={<PanelLibrary navigate={navigate} />} />
            <Route path="/settings" element={<Settings navigate={navigate} />} />
            <Route path="*"         element={<Home navigate={navigate} />} />
          </Routes>
        </motion.div>
      </AnimatePresence>
      {showSidebar && <MobileHeader />}
      {showSidebar && <MobileNav current={screen} navigate={navigate} />}
    </div>
  )
}
