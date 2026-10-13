import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import Sidebar, { MobileNav } from './components/Sidebar.jsx'
import Home from './screens/Home.jsx'
import NewRehearsal from './screens/NewRehearsal.jsx'
import RehearsalRoom from './screens/RehearsalRoom.jsx'
import Report from './screens/Report.jsx'
import Debrief from './screens/Debrief.jsx'
import PastSessions from './screens/PastSessions.jsx'
import PanelLibrary from './screens/PanelLibrary.jsx'
import Settings from './screens/Settings.jsx'

const SCREENS_WITH_SIDEBAR = ['home', 'past', 'library', 'settings']

const DEFAULT_SESSION = {
  proposalText: '',
  proposalName: '',
  personaIds: ['finance', 'legal', 'ops', 'factcheck'],
  config: { mode: 'Type', toughness: 'Balanced' },
  transcript: [],
  conditions: {},
  factCheckNotes: '',
  reportData: null,
  startTime: null,
}

export default function App() {
  const [screen, setScreen]       = useState('home')
  const [navPayload, setNavPayload] = useState({})
  const [session, setSession]     = useState(DEFAULT_SESSION)

  const navigate = (s, payload = {}) => { setScreen(s); setNavPayload(payload) }
  const showSidebar = SCREENS_WITH_SIDEBAR.includes(screen)

  const updateSession = (updates) =>
    setSession(prev => ({ ...prev, ...updates }))

  const resetSession = () => setSession(DEFAULT_SESSION)

  const renderScreen = () => {
    switch (screen) {
      case 'home':     return <Home navigate={navigate} />
      case 'new':      return <NewRehearsal navigate={navigate} session={session} updateSession={updateSession} resetSession={resetSession} navPayload={navPayload} />
      case 'room':     return <RehearsalRoom navigate={navigate} session={session} updateSession={updateSession} />
      case 'report':   return <Report navigate={navigate} session={session} />
      case 'debrief':  return <Debrief navigate={navigate} session={session} />
      case 'past':     return <PastSessions navigate={navigate} />
      case 'library':  return <PanelLibrary navigate={navigate} />
      case 'settings': return <Settings />
      default:         return <Home navigate={navigate} />
    }
  }

  return (
    <div className="app-shell">
      {showSidebar && <Sidebar current={screen} navigate={navigate} />}
      <AnimatePresence mode="wait">
        <motion.div
          key={screen}
          className="app-main"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          style={{ flex: 1, height: '100%', overflow: screen === 'room' ? 'hidden' : 'auto' }}
        >
          {renderScreen()}
        </motion.div>
      </AnimatePresence>
      {showSidebar && <MobileNav current={screen} navigate={navigate} />}
    </div>
  )
}
