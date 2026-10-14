import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Mic, MicOff, Send, ExternalLink, Loader, Volume2, VolumeX, Check, Copy, FileText, X as XIcon } from 'lucide-react'
import { PERSONAS, DEMO_TRANSCRIPT } from '../data.js'
import { saveSession, loadVoiceSettings, saveVoiceSettings } from '../utils/storage.js'
import { getCurrentTime, formatSessionDate } from '../utils/time.js'
import { useTTS } from '../hooks/useTTS.js'
import { useElapsedTimer } from '../hooks/useElapsedTimer.js'

const DEMO_PERSONA_IDS = ['finance', 'legal', 'ops', 'factcheck', 'event_director', 'event_finance', 'event_safety', 'event_programme']

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
        {(persona.conditions || []).map(c => (
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
  const isPresenter  = msg.speaker === 'presenter'
  const persona      = personas.find(p => p.id === msg.speaker)
  const replyPersona = msg.replyTo ? personas.find(p => p.id === msg.replyTo) : null
  const [hovered, setHovered] = useState(false)
  const [copied, setCopied]   = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(msg.text).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <motion.div
      className={`transcript-msg ${isPresenter ? 'presenter' : ''}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ position: 'relative' }}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
    >
      {!isPresenter && persona && (
        <div className="msg-header">
          <div className="msg-speaker-dot" style={{ background: persona.color }} />
          <span className="msg-speaker-name" style={{ color: persona.color }}>{persona.name}</span>
          <span className="msg-speaker-role">{persona.role}</span>
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

      {hovered && !appearing && (
        <button
          onClick={handleCopy}
          style={{
            position: 'absolute', top: 6, right: 6,
            background: copied ? 'rgba(5,150,105,0.15)' : 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 5, cursor: 'pointer',
            padding: '3px 7px', display: 'flex', alignItems: 'center', gap: 4,
            fontSize: '0.6875rem', color: copied ? '#34D399' : 'var(--room-text-2)',
            transition: 'all 0.15s ease',
          }}
        >
          {copied ? <Check size={10} /> : <Copy size={10} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
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
  const [done, setDone] = useState(false)
  useEffect(() => {
    setDisplayed('')
    setDone(false)
    let i = 0
    const interval = setInterval(() => {
      i += 3
      setDisplayed(text.slice(0, i))
      if (i >= text.length) { clearInterval(interval); setDone(true) }
    }, 18)
    return () => clearInterval(interval)
  }, [text])
  return <>{displayed}{!done && <span style={{ opacity: 0.4 }}>|</span>}</>
}

export default function RehearsalRoom({ navigate, session, updateSession }) {
  const hasRealSession = Boolean(session.proposalText)
  const realOpenings   = session.transcript.filter(m => m.type === 'opening')
  const openingMsgs    = hasRealSession
    ? (realOpenings.length > 0
        ? realOpenings
        : DEMO_TRANSCRIPT.filter(m => m.type === 'opening' && (session.personaIds || []).includes(m.speaker)))
    : DEMO_TRANSCRIPT.filter(m => m.type === 'opening')

  const [localTranscript, setLocalTranscript]       = useState([])
  const [localConditions, setLocalConditions]       = useState(() => {
    if (hasRealSession) {
      return Object.fromEntries(Object.keys(session.conditions).map(k => [k, false]))
    }
    const conds = {}
    PERSONAS.forEach(p => (p.conditions || []).forEach(c => { conds[c.id] = false }))
    return conds
  })
  const [roomState, setRoomState]                   = useState(openingMsgs.length > 0 ? 'thinking' : 'idle')
  const [activeSpeaker, setActiveSpeaker]           = useState(null)
  const [interruptSpeaker, setInterruptSpeaker]     = useState(null)
  const [inputValue, setInputValue]                 = useState('')
  const [appearingMsgId, setAppearingMsgId]         = useState(null)
  const [typingPersonaId, setTypingPersonaId]       = useState(null)
  const [generatingReport, setGeneratingReport]     = useState(false)
  const [apiError, setApiError]                     = useState(false)
  const [listening, setListening]                   = useState(false)
  const [speechOn, setSpeechOn]                     = useState(() => loadVoiceSettings().enabled)
  const [openingsDone, setOpeningsDone]             = useState(openingMsgs.length === 0)
  const [exitOfferDismissed, setExitOfferDismissed] = useState(false)
  const [showProposal, setShowProposal]             = useState(false)

  const { elapsed, getElapsedMinutes } = useElapsedTimer()

  const transcriptRef     = useRef(null)
  const inputRef          = useRef(null)
  const recognitionRef    = useRef(null)
  const roomStateRef      = useRef(roomState)
  const speechOnRef       = useRef(speechOn)
  const openingsFiredRef  = useRef(false)
  const userScrolledUpRef = useRef(false)

  const { enqueueSpeak, cancelTTS } = useTTS(speechOnRef)

  // Log opening message source once on mount so it's visible in DevTools
  useEffect(() => {
    const source = !hasRealSession
      ? 'DEMO_TRANSCRIPT (no proposal uploaded)'
      : realOpenings.length > 0
        ? `API (${realOpenings.length} opening${realOpenings.length !== 1 ? 's' : ''} from session/start)`
        : 'DEMO_TRANSCRIPT fallback (session/start returned 0 openings  -  check the [session/start] log above)'
    console.log('[RehearsalRoom] opening source:', source)
    if (!hasRealSession || realOpenings.length === 0) {
      console.log('[RehearsalRoom] demo transcript entries for selected personas:', openingMsgs.map(m => ({ speaker: m.speaker, text: m.text?.slice(0, 60) + '...' })))
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const turnCount = localTranscript.filter(m => m.speaker === 'presenter').length

  const allPersonas = PERSONAS.map(p => ({
    ...p,
    conditions: (p.conditions || []).map(c => ({
      ...c,
      met: localConditions[c.id] || false,
    })),
  }))

  const visiblePersonas = hasRealSession
    ? allPersonas.filter(p => session.personaIds.includes(p.id))
    : allPersonas.filter(p => DEMO_PERSONA_IDS.includes(p.id))

  const activePersona  = visiblePersonas.find(p => p.id === activeSpeaker) || visiblePersonas[0]
  const spotlightX     = `${activePersona?.panelPct ?? 50}%`
  const spotlightColor = activePersona?.glow ?? 'transparent'

  const _rawTurnLimit = parseInt(session.config?.turnLimit)
  if (!_rawTurnLimit) console.warn('[RehearsalRoom] session.config.turnLimit missing, falling back to 15')
  const turnLimit        = _rawTurnLimit || 15
  const turnsLeft        = turnLimit - turnCount
  const turnLimitReached = hasRealSession && turnCount >= turnLimit
  const nearTurnLimit    = hasRealSession && turnsLeft <= 3 && turnsLeft > 0
  const isInputDisabled  = !openingsDone || turnLimitReached || (roomState !== 'idle' && roomState !== 'condition-met')
  const allConditionsMet = hasRealSession && openingsDone
    && Object.keys(localConditions).length > 0
    && Object.values(localConditions).every(Boolean)
  const showExitOffer    = allConditionsMet && !exitOfferDismissed

  // Fire one random opening question on mount. Guard against StrictMode double-invocation.
  useEffect(() => {
    if (openingsFiredRef.current || openingMsgs.length === 0) return
    openingsFiredRef.current = true
    const msg = { ...([...openingMsgs].sort(() => Math.random() - 0.5))[0], time: getCurrentTime() }
    setTimeout(() => {
      setLocalTranscript(prev => [...prev, msg])
      setActiveSpeaker(msg.speaker)
      setAppearingMsgId(msg.id)
      setRoomState('speaking')
      enqueueSpeak(msg.text, msg.speaker)
      setTimeout(() => {
        setRoomState('idle')
        setOpeningsDone(true)
      }, 2800)
    }, 300)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-scroll to bottom unless the user has scrolled up
  useEffect(() => {
    if (userScrolledUpRef.current) return
    const el = transcriptRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [localTranscript, typingPersonaId])

  useEffect(() => { roomStateRef.current = roomState }, [roomState])
  useEffect(() => { speechOnRef.current  = speechOn  }, [speechOn])

  // Auto-resize textarea
  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 120) + 'px'
  }, [inputValue])

  // Auto-focus when input becomes available
  useEffect(() => {
    if (!isInputDisabled) inputRef.current?.focus()
  }, [isInputDisabled])

  // Cancel TTS and speech recognition on unmount
  useEffect(() => () => {
    recognitionRef.current?.abort()
    cancelTTS()
  }, [cancelTTS])

  const handleTranscriptScroll = useCallback(() => {
    const el = transcriptRef.current
    if (!el) return
    userScrolledUpRef.current = (el.scrollHeight - el.scrollTop - el.clientHeight) > 40
  }, [])

  const handleRetry = () => {
    const lastPresenterMsg = [...localTranscript].reverse().find(m => m.speaker === 'presenter')
    if (lastPresenterMsg) setInputValue(lastPresenterMsg.text)
    setApiError(false)
  }

  const handleSend = async (textOverride) => {
    const text = textOverride !== undefined ? String(textOverride).trim() : inputValue.trim()
    if (!text || roomStateRef.current === 'thinking') return

    userScrolledUpRef.current = false
    if (listening) stopListening()
    cancelTTS()

    const userMsg = { id: Date.now(), speaker: 'presenter', text, time: getCurrentTime() }
    const nextTranscript = [...localTranscript, userMsg]
    setLocalTranscript(nextTranscript)
    setInputValue('')
    setRoomState('thinking')

    if (hasRealSession && !session.demoMode) {
      const nextPersona = visiblePersonas[0]
      if (!nextPersona) return
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
            config: { ...session.config, turns_remaining: turnsLeft - 1 },
            fact_check: session.factCheckNotes || '',
          }),
        })

        if (!res.ok) throw new Error(`API error ${res.status}`)
        const data = await res.json()
        console.log(`[session/message] turn ${turnCount + 1}:`, {
          speaker:        data.speaker,
          conditions_met: data.conditions_met,
          has_follow_up:  Boolean(data.follow_up),
          text_preview:   data.text?.slice(0, 80) + '...',
        })

        if (!data.text?.trim()) {
          console.warn('[session/message] empty response  -  using fallback to keep conversation moving')
          setTypingPersonaId(null)
          setRoomState('idle')
          fallbackResponse()
          return
        }

        const replyMsg = {
          id: Date.now() + 1,
          speaker: data.speaker,
          text: data.text,
          time: getCurrentTime(),
          ...(data.source ? { source: data.source } : {}),
        }
        const updatedTranscript = [...nextTranscript, replyMsg]
        const updatedConditions = { ...localConditions }
        for (const cid of (data.conditions_met || [])) updatedConditions[cid] = true

        const hasCondMet = (data.conditions_met || []).length > 0
        const followUp   = data.follow_up || null

        setTypingPersonaId(null)
        setLocalTranscript(updatedTranscript)
        setLocalConditions(updatedConditions)
        setActiveSpeaker(data.speaker)
        setAppearingMsgId(replyMsg.id)
        enqueueSpeak(replyMsg.text, replyMsg.speaker)

        if (followUp) {
          setRoomState('speaking')
          updateSession({ transcript: updatedTranscript, conditions: updatedConditions })

          setTimeout(() => {
            setTypingPersonaId(followUp.speaker)
            setRoomState('thinking')
          }, 2500)

          setTimeout(() => {
            const fuCondsMet     = followUp.conditions_met || []
            const finalConditions = { ...updatedConditions }
            for (const cid of fuCondsMet) finalConditions[cid] = true

            const fuMsg = {
              id: Date.now() + 2,
              speaker: followUp.speaker,
              text: followUp.text,
              time: getCurrentTime(),
              ...(followUp.source ? { source: followUp.source } : {}),
            }
            const finalTranscript = [...updatedTranscript, fuMsg]

            setTypingPersonaId(null)
            setLocalTranscript(finalTranscript)
            setLocalConditions(finalConditions)
            setActiveSpeaker(followUp.speaker)
            setAppearingMsgId(fuMsg.id)
            enqueueSpeak(fuMsg.text, followUp.speaker)
            updateSession({ transcript: finalTranscript, conditions: finalConditions })

            if (hasCondMet || fuCondsMet.length > 0) {
              setRoomState('condition-met')
              setTimeout(() => setRoomState('idle'), 2200)
            } else {
              setRoomState('speaking')
              setTimeout(() => setRoomState('idle'), 3500)
            }
          }, 4500)
        } else {
          updateSession({ transcript: updatedTranscript, conditions: updatedConditions })
          if (hasCondMet) {
            setRoomState('condition-met')
            setTimeout(() => setRoomState('idle'), 2200)
          } else {
            setRoomState('speaking')
            setTimeout(() => setRoomState('idle'), 3500)
          }
        }
      } catch (err) {
        console.error('[session/message] failed:', err.message)
        setTypingPersonaId(null)
        setApiError(true)
        fallbackResponse()
      }
    } else {
      fallbackResponse()
    }
  }

  const fallbackResponse = () => {
    const speakerId = visiblePersonas[0]?.id
    if (!speakerId) return
    setActiveSpeaker(speakerId)
    setTypingPersonaId(speakerId)
    setTimeout(() => {
      const replyMsg = {
        id: Date.now() + 1,
        speaker: speakerId,
        text: '(AI is not connected. In a live session this would be a panel response.)',
        time: getCurrentTime(),
      }
      setTypingPersonaId(null)
      setRoomState('speaking')
      setLocalTranscript(prev => [...prev, replyMsg])
      setActiveSpeaker(speakerId)
      setAppearingMsgId(replyMsg.id)
      setTimeout(() => setRoomState('idle'), 1200)
    }, 800)
  }

  const handleEndSession = async () => {
    if (!hasRealSession) { navigate('report'); return }
    if (generatingReport) return

    const condMet         = Object.values(localConditions).filter(Boolean).length
    const condTotal       = Object.keys(localConditions).length
    const sessionDuration = `${getElapsedMinutes()} min`

    const buildRecord = (reportData) => ({
      id:            Date.now(),
      proposal:      session.proposalName || 'Untitled proposal',
      proposalText:  session.proposalText || '',
      date:          formatSessionDate(),
      condMet,
      condTotal,
      duration:      sessionDuration,
      personaIds:    session.personaIds || [],
      conditions:    localConditions,
      reportData,
      linkedMeeting: session.linkedMeeting || '',
    })

    if (session.demoMode) {
      setGeneratingReport(true)
      const reportData = { demo: true, weak_points: [], moments: [] }
      saveSession(buildRecord(reportData))
      updateSession({ reportData, conditions: localConditions, duration: sessionDuration, transcript: localTranscript })
      navigate('report')
      return
    }

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
      console.log('[session/end] report:', {
        weak_points_count: reportData.weak_points?.length,
        moments_count:     reportData.moments?.length,
        is_demo:           Boolean(reportData.demo),
      })
      saveSession(buildRecord(reportData))
      updateSession({ reportData, conditions: localConditions, duration: sessionDuration, transcript: localTranscript })
      navigate('report')
    } catch (err) {
      console.error('[session/end] failed  -  report will be unavailable:', err.message)
      updateSession({ conditions: localConditions, transcript: localTranscript })
      navigate('report')
    } finally {
      setGeneratingReport(false)
    }
  }

  const speechSupported = typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)

  const stopListening = () => {
    recognitionRef.current?.stop()
    setListening(false)
  }

  const startListening = () => {
    if (!speechSupported || roomStateRef.current === 'thinking') return
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    const recognition = new SR()
    recognition.lang = navigator.language || 'en-US'
    recognition.continuous = false
    recognition.interimResults = false
    recognition.onstart  = () => setListening(true)
    recognition.onend    = () => setListening(false)
    recognition.onerror  = (e) => { console.warn('Speech error:', e.error); setListening(false) }
    recognition.onresult = (e) => {
      setListening(false)
      setInputValue(e.results[0][0].transcript.trim())
    }
    recognitionRef.current = recognition
    recognition.start()
  }

  const toggleMic    = () => listening ? stopListening() : startListening()
  const toggleSpeech = () => {
    setSpeechOn(prev => {
      const next = !prev
      saveVoiceSettings({ ...loadVoiceSettings(), enabled: next })
      if (!next) cancelTTS()
      return next
    })
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  const typingPersona  = visiblePersonas.find(p => p.id === typingPersonaId)
  const spotlightStyle = {
    background: `radial-gradient(ellipse 700px 440px at ${spotlightX} -60px, ${spotlightColor} 0%, rgba(242,211,162,0.05) 42%, transparent 68%)`,
    transition: 'background 0.8s ease',
  }

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
          <span className="room-proposal-title">{session.proposalName || 'Untitled proposal'}</span>
        </div>

        <div className="room-topbar-right">
          {session.proposalText && (
            <button
              className="room-input-btn"
              onClick={() => setShowProposal(v => !v)}
              title="View proposal"
              style={{
                background: showProposal ? 'rgba(255,255,255,0.08)' : 'transparent',
                border: 'none', color: showProposal ? 'var(--room-text-2)' : 'var(--room-text-3)',
                cursor: 'pointer', padding: '4px 8px', borderRadius: 6,
                display: 'flex', alignItems: 'center', transition: 'all 0.15s ease',
              }}
            >
              <FileText size={16} />
            </button>
          )}
          <button
            className="room-input-btn"
            onClick={toggleSpeech}
            title={speechOn ? 'Mute panel voices' : 'Unmute panel voices'}
            style={{
              background: speechOn ? 'rgba(255,255,255,0.08)' : 'transparent',
              border: 'none', color: speechOn ? 'var(--room-text-2)' : 'var(--room-text-3)',
              cursor: 'pointer', padding: '4px 8px', borderRadius: 6,
              display: 'flex', alignItems: 'center', transition: 'all 0.15s ease',
            }}
          >
            {speechOn ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>
          <span style={{ fontSize: '0.75rem', color: 'var(--room-text-3)', fontVariantNumeric: 'tabular-nums', minWidth: 34 }}>
            {elapsed}
          </span>
          <span
            className="room-turn-counter"
            style={nearTurnLimit || turnLimitReached ? { color: '#F59E0B' } : undefined}
          >
            {turnLimitReached
              ? 'No turns left'
              : nearTurnLimit
                ? `${turnsLeft} turn${turnsLeft === 1 ? '' : 's'} left`
                : `Turn ${turnCount} of ${turnLimit}`}
          </span>
          <button
            className="room-end-btn"
            onClick={handleEndSession}
            disabled={generatingReport}
            style={{ opacity: generatingReport ? 0.7 : 1 }}
          >
            {generatingReport
              ? <><Loader size={12} style={{ animation: 'spin 1s linear infinite' }} /> Generating report...</>
              : 'End session'}
          </button>
        </div>
      </header>

      {session.demoMode && (
        <div className="room-demo-banner">
          {session.demoReason === 'GEMINI_API_KEY not set'
            ? 'No AI key configured. Panel responses are sample messages and will not reflect your proposal.'
            : session.demoReason === 'connection_failed'
              ? 'Could not reach AI service. Panel responses are sample messages and will not reflect your proposal.'
              : 'AI unavailable. Panel responses are sample messages and will not reflect your proposal.'}
        </div>
      )}

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

      <div className="room-transcript" ref={transcriptRef} onScroll={handleTranscriptScroll}>
        <div className="room-transcript-inner">
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
      </div>

      {roomState === 'condition-met' && (
        <div className="room-banner-wrap">
          <div className="room-banner success">
            <Check size={13} style={{ flexShrink: 0 }} /> Condition met
          </div>
        </div>
      )}

      {apiError && (
        <div className="room-banner-wrap">
          <div className="room-banner error">
            <span>AI connection lost. Your last message was not processed.</span>
            <button
              className="btn btn-sm"
              onClick={handleRetry}
              style={{ background: 'rgba(220,38,38,0.12)', borderColor: 'rgba(220,38,38,0.25)', color: '#F87171', fontSize: '0.75rem', whiteSpace: 'nowrap' }}
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {turnLimitReached && !showExitOffer && (
        <div className="room-banner-wrap">
          <div className="room-banner warning">
            <span>Turn limit reached. End the session to get your coaching report.</span>
            <button
              className="btn btn-sm"
              onClick={handleEndSession}
              disabled={generatingReport}
              style={{ background: 'rgba(245,158,11,0.15)', borderColor: 'rgba(245,158,11,0.3)', color: '#D97706', fontSize: '0.75rem', whiteSpace: 'nowrap' }}
            >
              {generatingReport ? <Loader size={12} style={{ animation: 'spin 1s linear infinite' }} /> : 'End and get report'}
            </button>
          </div>
        </div>
      )}

      {showExitOffer && (
        <div className="room-banner-wrap" style={{ paddingBottom: 8 }}>
          <div className="room-banner-exit">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Check size={15} style={{ color: '#34D399', flexShrink: 0 }} />
              <span style={{ fontSize: '0.875rem', color: '#34D399', fontWeight: 500 }}>
                All panel conditions addressed. Ready to get your report?
              </span>
            </div>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setExitOfferDismissed(true)}
                style={{ background: 'transparent', borderColor: 'rgba(255,255,255,0.12)', color: 'var(--room-text-2)', fontSize: '0.75rem' }}
              >Keep going</button>
              <button
                className="btn btn-sm"
                onClick={handleEndSession}
                disabled={generatingReport}
                style={{ background: '#059669', borderColor: '#059669', color: '#fff', fontSize: '0.75rem' }}
              >
                {generatingReport ? <Loader size={12} style={{ animation: 'spin 1s linear infinite' }} /> : 'End and get report'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="room-input-area">
        <div className="room-input-inner">
          <div className="room-input-wrap">
            <textarea
              ref={inputRef}
              className="room-input"
              placeholder={
                listening        ? 'Listening...' :
                turnLimitReached ? 'Turn limit reached. End session above.' :
                isInputDisabled  ? 'Panel is responding...' :
                'Type your response...'
              }
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              disabled={isInputDisabled}
              style={listening ? { color: 'var(--amber)' } : undefined}
            />
            <div className="room-input-actions">
              <button
                className={`room-input-btn mic ${listening ? 'listening' : ''}`}
                onClick={toggleMic}
                disabled={isInputDisabled || !speechSupported}
                title={
                  !speechSupported ? 'Voice input not supported. Try Chrome or Edge.' :
                  listening        ? 'Stop listening' :
                  'Start voice input'
                }
              >
                {listening ? <MicOff size={16} /> : <Mic size={16} />}
              </button>
              <button
                className="room-input-btn send"
                onClick={() => handleSend()}
                disabled={!inputValue.trim() || isInputDisabled}
                title="Send (Enter)"
              >
                <Send size={15} />
              </button>
            </div>
          </div>
          <div className="room-input-hint">Press Enter to send · Shift+Enter for new line</div>
        </div>
      </div>

      {showProposal && (
        <div
          onClick={() => setShowProposal(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 200,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#1C1917', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 12, width: '100%', maxWidth: 680, maxHeight: '72vh',
              display: 'flex', flexDirection: 'column', overflow: 'hidden',
              boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
            }}
          >
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)', flexShrink: 0,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <FileText size={14} style={{ color: 'var(--room-text-3)' }} />
                <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--room-text-2)' }}>
                  {session.proposalName || 'Proposal'}
                </span>
              </div>
              <button
                onClick={() => setShowProposal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--room-text-3)', padding: 4, display: 'flex' }}
              >
                <XIcon size={15} />
              </button>
            </div>
            <div style={{
              overflowY: 'auto', padding: '20px 24px',
              fontSize: '0.875rem', lineHeight: 1.75, color: 'var(--room-text-2)',
              fontFamily: 'var(--font-ui)', whiteSpace: 'pre-wrap',
            }}>
              {session.proposalText}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
