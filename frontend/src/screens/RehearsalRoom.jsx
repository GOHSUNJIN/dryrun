import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Mic, Send, ExternalLink, Loader } from 'lucide-react'
import { PERSONAS, DEMO_TRANSCRIPT, SCRIPTED_RESPONSES } from '../data.js'

const ROOM_STATES = ['idle', 'thinking', 'speaking', 'interrupting', 'condition-met']
const STATE_LABELS = {
  idle:            'Idle',
  thinking:        'Thinking',
  speaking:        'Speaking',
  interrupting:    'Interrupt',
  'condition-met': 'Met',
}

function PersonaSeat({ persona, state, activeSpeaker, interruptSpeaker }) {
  const isActive    = activeSpeaker === persona.id
  const isInterrupt = interruptSpeaker === persona.id
  const isThinking  = state === 'thinking' && isActive
  const isSpeaking  = (state === 'speaking' || state === 'condition-met') && isActive
  const isLit       = isActive || isInterrupt
  const metCount    = persona.conditions.filter(c => c.met).length
  const totalCount  = persona.conditions.length

  return (
    <div className={`persona-seat ${isLit ? 'active' : 'dimmed'} ${isThinking ? 'thinking' : ''}`}>
      <div className="seat-ring-wrap">
        <div
          className="seat-ring"
          style={{
            borderColor: isLit ? persona.color : 'rgba(255,255,255,0.12)',
            boxShadow: isLit ? `0 0 0 3px ${persona.glow}, 0 0 24px ${persona.glow}` : 'none',
            color: isLit ? persona.color : undefined,
          }}
        >
          {persona.initial}
        </div>
      </div>

      {isSpeaking ? (
        <div className="seat-waveform" style={{ color: persona.color }}>
          {[14, 8, 18, 10, 16].map((h, i) => (
            <div key={i} className="waveform-bar" style={{ height: h, animationDelay: `${i * 0.1}s` }} />
          ))}
        </div>
      ) : (
        <div style={{ height: 20 }} />
      )}

      <div className="seat-name" style={{ color: isLit ? persona.color : undefined }}>{persona.name}</div>
      <div className="seat-role">{persona.role}</div>

      <div className="seat-conditions">
        {persona.conditions.map(c => (
          <div
            key={c.id}
            className={`seat-cond-dot ${c.met ? 'met' : ''}`}
            style={{ color: persona.color }}
            title={c.text}
          />
        ))}
      </div>

      <div style={{ fontSize: '0.625rem', color: 'var(--room-text-3)', marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
        {metCount}/{totalCount}
      </div>
    </div>
  )
}

function TranscriptMsg({ msg, personas, appearing }) {
  const isPresenter = msg.speaker === 'presenter'
  const persona     = personas.find(p => p.id === msg.speaker)
  const replyPersona = msg.replyTo ? personas.find(p => p.id === msg.replyTo) : null

  return (
    <motion.div
      className={`transcript-msg ${isPresenter ? 'presenter' : ''}`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
    >
      {!isPresenter && persona && (
        <div className="msg-header">
          <div className="msg-speaker-dot" style={{ background: persona.color }} />
          <span className="msg-speaker-name" style={{ color: persona.color }}>{persona.name}</span>
          <span className="msg-speaker-role">· {persona.role}</span>
          {replyPersona && (
            <span className="msg-reply-tag">
              <span>replying to {replyPersona.role}</span>
            </span>
          )}
          <span className="msg-time">{msg.time}</span>
        </div>
      )}

      {isPresenter && (
        <div className="msg-header" style={{ justifyContent: 'flex-end' }}>
          <span className="msg-time" style={{ marginLeft: 0, marginRight: 8 }}>{msg.time}</span>
          <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--room-text-2)' }}>You</span>
        </div>
      )}

      <div className="msg-body">
        {appearing ? <StreamingText text={msg.text} /> : msg.text}
      </div>

      {msg.source && (
        <div className="msg-source-chip" style={{ alignSelf: isPresenter ? 'flex-end' : 'flex-start' }}>
          <ExternalLink size={10} />
          {msg.source.label}
        </div>
      )}
    </motion.div>
  )
}

function TypingIndicator({ persona }) {
  return (
    <motion.div
      className="transcript-msg"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.25 }}
    >
      <div className="msg-header">
        <div className="msg-speaker-dot" style={{ background: persona.color }} />
        <span className="msg-speaker-name" style={{ color: persona.color }}>{persona.name}</span>
        <span className="msg-speaker-role">· {persona.role}</span>
      </div>
      <div className="msg-typing">
        {[0, 1, 2].map(i => (
          <div key={i} className="typing-dot" style={{ animationDelay: `${i * 0.2}s` }} />
        ))}
      </div>
    </motion.div>
  )
}

function StreamingText({ text }) {
  const [displayed, setDisplayed] = useState('')
  useEffect(() => {
    setDisplayed('')
    let i = 0
    const interval = setInterval(() => {
      i += 3
      setDisplayed(text.slice(0, i))
      if (i >= text.length) clearInterval(interval)
    }, 18)
    return () => clearInterval(interval)
  }, [text])
  return <>{displayed}<span style={{ opacity: 0.4 }}>|</span></>
}

export default function RehearsalRoom({ navigate, session, updateSession }) {
  const hasRealSession = session.transcript.length > 0

  const [localTranscript, setLocalTranscript] = useState(
    hasRealSession ? session.transcript : DEMO_TRANSCRIPT
  )
  const [localConditions, setLocalConditions] = useState(
    hasRealSession ? session.conditions : {}
  )
  const [roomState, setRoomState]         = useState(hasRealSession ? 'idle' : 'speaking')
  const [activeSpeaker, setActiveSpeaker] = useState(hasRealSession ? (session.transcript[session.transcript.length - 1]?.speaker || 'finance') : 'finance')
  const [interruptSpeaker, setInterruptSpeaker] = useState('ops')
  const [inputValue, setInputValue]       = useState('')
  const [mode, setMode]                   = useState(session.config?.mode || 'Type')
  const [appearingMsgId, setAppearingMsgId] = useState(hasRealSession ? session.transcript[session.transcript.length - 1]?.id : 8)
  const [typingPersonaId, setTypingPersonaId] = useState(null)
  const [generatingReport, setGeneratingReport] = useState(false)
  const [responseIdx, setResponseIdx]     = useState(0)
  const transcriptRef = useRef(null)

  const turnCount = localTranscript.filter(m => m.speaker === 'presenter').length

  const allPersonas = PERSONAS.map(p => ({
    ...p,
    conditions: p.conditions.map(c => ({
      ...c,
      met: localConditions[c.id] || false,
    })),
  }))

  const visiblePersonas = hasRealSession
    ? allPersonas.filter(p => session.personaIds.includes(p.id))
    : allPersonas

  const activePersona  = visiblePersonas.find(p => p.id === activeSpeaker) || visiblePersonas[0]
  const spotlightX     = `${activePersona?.panelPct ?? 50}%`
  const spotlightColor = activePersona?.glow ?? 'transparent'

  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight
    }
  }, [localTranscript, typingPersonaId])

  const getElapsedTime = () => {
    if (!session.startTime) return ''
    const elapsed = Math.floor((Date.now() - session.startTime) / 1000)
    const m = Math.floor(elapsed / 60)
    const s = elapsed % 60
    return `${m}:${String(s).padStart(2, '0')}`
  }

  const handleSend = async () => {
    if (!inputValue.trim() || roomState === 'thinking') return

    const userMsg = {
      id: Date.now(),
      speaker: 'presenter',
      text: inputValue.trim(),
      time: getElapsedTime(),
    }

    const nextTranscript = [...localTranscript, userMsg]
    setLocalTranscript(nextTranscript)
    setInputValue('')
    setRoomState('thinking')

    if (hasRealSession) {
      const nextPersona = visiblePersonas[0]
      setTypingPersonaId(nextPersona.id)

      try {
        const res = await fetch('/api/session/message', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            proposal_text: session.proposalText,
            persona_ids: session.personaIds,
            transcript: nextTranscript,
            conditions: localConditions,
            config: session.config,
            fact_check: session.factCheckNotes || '',
          }),
        })

        if (!res.ok) throw new Error(`API error ${res.status}`)
        const data = await res.json()

        const replyMsg = {
          id: Date.now() + 1,
          speaker: data.speaker,
          text: data.text,
          time: getElapsedTime(),
          ...(data.source ? { source: data.source } : {}),
        }

        const updatedTranscript = [...nextTranscript, replyMsg]
        const updatedConditions = { ...localConditions }
        for (const cid of (data.conditions_met || [])) {
          updatedConditions[cid] = true
        }

        setTypingPersonaId(null)
        setLocalTranscript(updatedTranscript)
        setLocalConditions(updatedConditions)
        setActiveSpeaker(data.speaker)
        setAppearingMsgId(replyMsg.id)

        updateSession({ transcript: updatedTranscript, conditions: updatedConditions })

        if ((data.conditions_met || []).length > 0) {
          setRoomState('condition-met')
          setTimeout(() => setRoomState('idle'), 2200)
        } else {
          setRoomState('speaking')
          setTimeout(() => setRoomState('idle'), 3500)
        }
      } catch {
        setTypingPersonaId(null)
        fallbackResponse(nextTranscript)
      }
    } else {
      fallbackResponse(nextTranscript)
    }
  }

  const fallbackResponse = (transcript) => {
    const nextPersona = PERSONAS[turnCount % PERSONAS.length]
    setActiveSpeaker(nextPersona.id)
    setTypingPersonaId(nextPersona.id)

    const scripted = SCRIPTED_RESPONSES[responseIdx % SCRIPTED_RESPONSES.length]
    setResponseIdx(r => r + 1)

    setTimeout(() => {
      setTypingPersonaId(null)
      setRoomState('speaking')
      const replyMsg = {
        id: Date.now() + 1,
        speaker: scripted.speaker,
        text: scripted.text,
        source: scripted.source,
        time: getElapsedTime(),
      }
      setLocalTranscript(prev => [...prev, replyMsg])
      setActiveSpeaker(scripted.speaker)
      setAppearingMsgId(replyMsg.id)

      if (responseIdx % 3 === 2) {
        setTimeout(() => setRoomState('condition-met'), 600)
        setTimeout(() => setRoomState('idle'), 2200)
      } else {
        setTimeout(() => setRoomState('idle'), 3500)
      }
    }, 1600)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleEndSession = async () => {
    if (!hasRealSession) { navigate('report'); return }
    setGeneratingReport(true)
    try {
      const res = await fetch('/api/session/end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proposal_text: session.proposalText,
          persona_ids: session.personaIds,
          transcript: localTranscript,
          conditions: localConditions,
        }),
      })
      if (!res.ok) throw new Error(`API error ${res.status}`)
      const reportData = await res.json()

      const condMet   = Object.values(localConditions).filter(Boolean).length
      const condTotal = Object.keys(localConditions).length
      const duration  = session.startTime
        ? `${Math.floor((Date.now() - session.startTime) / 60000)} min`
        : ''

      const saved = {
        id: Date.now(),
        proposal: session.proposalName || 'Untitled proposal',
        date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        mode: session.config?.mode || 'Type',
        condMet,
        condTotal,
        duration,
      }
      const prev = JSON.parse(localStorage.getItem('dryrun_sessions') || '[]')
      localStorage.setItem('dryrun_sessions', JSON.stringify([saved, ...prev].slice(0, 20)))

      updateSession({ reportData, conditions: localConditions })
      navigate('report')
    } catch {
      updateSession({ conditions: localConditions })
      navigate('report')
    } finally {
      setGeneratingReport(false)
    }
  }

  const switchDemoState = (s) => {
    setRoomState(s)
    if (s === 'speaking')     { setActiveSpeaker('finance'); setAppearingMsgId(6) }
    if (s === 'thinking')     setActiveSpeaker('legal')
    if (s === 'interrupting') { setActiveSpeaker('finance'); setInterruptSpeaker('ops') }
    if (s === 'condition-met') {
      setActiveSpeaker('ops')
      setLocalConditions(prev => ({ ...prev, o2: true }))
      setTimeout(() => setRoomState('idle'), 2000)
    }
  }

  const typingPersona = visiblePersonas.find(p => p.id === typingPersonaId)
  const spotlightStyle = {
    background: `radial-gradient(ellipse 700px 440px at ${spotlightX} -60px, ${spotlightColor} 0%, rgba(242,211,162,0.05) 42%, transparent 68%)`,
    transition: 'background 0.8s ease',
  }

  const turnLimit = session.config?.turnLimit || 15
  const isInputDisabled = roomState !== 'idle' && roomState !== 'condition-met'

  return (
    <div className="room">
      <div className="room-spotlight" style={spotlightStyle} />

      <header className="room-topbar">
        <div className="room-topbar-left">
          <div className="room-logo">
            <div className="room-logo-mark">
              <svg width="10" height="10" viewBox="0 0 14 14" fill="none">
                <rect x="1" y="4" width="5" height="9" rx="1" fill="#1C1917"/>
                <rect x="8" y="1" width="5" height="12" rx="1" fill="#1C1917"/>
              </svg>
            </div>
            <span className="room-logo-text">Dry Run</span>
          </div>
          <div className="room-divider" />
          <span className="room-proposal-title">{session.proposalName || 'Data Engineering Hires'}</span>
        </div>

        <div className="room-topbar-center">
          {['Type', 'Hybrid'].map(m => (
            <button
              key={m}
              className={`room-mode-btn ${mode === m ? 'active' : ''}`}
              onClick={() => setMode(m)}
            >{m}</button>
          ))}
          <button className="room-mode-btn" style={{ opacity: 0.35, cursor: 'default' }} title="Coming soon">Voice</button>
        </div>

        <div className="room-topbar-right">
          <span className="room-turn-counter">Turn {turnCount} of {turnLimit}</span>
          <button
            className="room-end-btn"
            onClick={handleEndSession}
            disabled={generatingReport}
            style={{ opacity: generatingReport ? 0.7 : 1 }}
          >
            {generatingReport ? (
              <><Loader size={12} style={{ animation: 'spin 1s linear infinite' }} /> Generating report...</>
            ) : 'End session'}
          </button>
        </div>
      </header>

      <div className="room-panel">
        {visiblePersonas.map(p => (
          <PersonaSeat
            key={p.id}
            persona={p}
            state={roomState}
            activeSpeaker={activeSpeaker}
            interruptSpeaker={interruptSpeaker}
          />
        ))}
      </div>

      <div className="room-sep" />

      <div className="room-transcript" ref={transcriptRef}>
        {localTranscript.map(msg => (
          <TranscriptMsg
            key={msg.id}
            msg={msg}
            personas={visiblePersonas}
            appearing={msg.id === appearingMsgId}
          />
        ))}
        <AnimatePresence>
          {typingPersona && <TypingIndicator key="typing" persona={typingPersona} />}
        </AnimatePresence>
      </div>

      <div className="room-input-area">
        <div className="room-input-wrap">
          <textarea
            className="room-input"
            placeholder={isInputDisabled ? 'Panel is responding...' : 'Type your response...'}
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            disabled={isInputDisabled}
          />
          <div className="room-input-actions">
            <button className="room-input-btn" title="Voice input">
              <Mic size={16} />
            </button>
            <button
              className="room-input-btn send"
              onClick={handleSend}
              disabled={!inputValue.trim() || isInputDisabled}
              title="Send (Enter)"
            >
              <Send size={15} />
            </button>
          </div>
        </div>
        <div className="room-input-hint">Press Enter to send · Shift+Enter for new line</div>
      </div>

      <div className="demo-controls">
        <span className="demo-label">Demo</span>
        {ROOM_STATES.map(s => (
          <button
            key={s}
            className={`demo-state-btn ${roomState === s ? 'active' : ''}`}
            onClick={() => switchDemoState(s)}
          >
            {STATE_LABELS[s]}
          </button>
        ))}
        <div style={{ width: 1, height: 16, background: 'var(--room-border)', margin: '0 4px' }} />
        <button
          className="demo-state-btn"
          onClick={() => navigate('report')}
          style={{ color: 'var(--amber)' }}
        >
          Report
        </button>
      </div>
    </div>
  )
}
