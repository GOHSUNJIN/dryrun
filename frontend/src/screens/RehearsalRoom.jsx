import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Mic, MicOff, Send, ExternalLink, Loader, Volume2, VolumeX, Check } from 'lucide-react'
import { PERSONAS, DEMO_TRANSCRIPT, SCRIPTED_RESPONSES } from '../data.js'
import { saveSession, loadVoiceSettings, saveVoiceSettings, loadCustomPersonas } from '../utils/storage.js'

const PERSONA_VOICE = {
  finance:   { pitch: 0.85, rate: 0.92 },
  legal:     { pitch: 1.0,  rate: 0.88 },
  ops:       { pitch: 0.8,  rate: 1.0  },
  factcheck: { pitch: 1.05, rate: 0.9  },
}

const DEMO_PERSONA_IDS = ['finance', 'legal', 'ops', 'factcheck']

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
  const [mode, setMode]                             = useState(session.config?.mode || 'Type')
  const [appearingMsgId, setAppearingMsgId]         = useState(null)
  const [typingPersonaId, setTypingPersonaId]       = useState(null)
  const [generatingReport, setGeneratingReport]     = useState(false)
  const [responseIdx, setResponseIdx]               = useState(0)
  const [apiError, setApiError]                     = useState(false)
  const [listening, setListening]                   = useState(false)
  const [speechOn, setSpeechOn]                     = useState(() => loadVoiceSettings().enabled)
  const [openingsDone, setOpeningsDone]             = useState(openingMsgs.length === 0)
  const [exitOfferDismissed, setExitOfferDismissed] = useState(false)

  const transcriptRef  = useRef(null)
  const recognitionRef = useRef(null)
  const roomStateRef   = useRef(roomState)
  const speechOnRef    = useRef(speechOn)
  const ttsQueueRef    = useRef([])
  const ttsBusyRef     = useRef(false)

  const turnCount = localTranscript.filter(m => m.speaker === 'presenter').length

  const allPersonaBase = [...PERSONAS, ...loadCustomPersonas()]
  const allPersonas = allPersonaBase.map(p => ({
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

  // TTS queue: personas speak one at a time in order
  const flushTTS = useCallback(() => {
    if (ttsBusyRef.current || ttsQueueRef.current.length === 0) return
    if (!speechOnRef.current || typeof window === 'undefined' || !window.speechSynthesis) return
    const { text, speakerId } = ttsQueueRef.current.shift()
    const utter  = new SpeechSynthesisUtterance(text)
    const params = PERSONA_VOICE[speakerId] || { pitch: 1.0, rate: 1.0 }
    const vs     = loadVoiceSettings()
    utter.pitch  = params.pitch
    utter.rate   = params.rate * (vs.rate || 1.0)
    utter.onend  = () => { ttsBusyRef.current = false; flushTTS() }
    utter.onerror = () => { ttsBusyRef.current = false; flushTTS() }
    ttsBusyRef.current = true
    window.speechSynthesis.speak(utter)
  }, [])

  const enqueueSpeak = useCallback((text, speakerId) => {
    if (!speechOnRef.current) return
    ttsQueueRef.current.push({ text, speakerId })
    flushTTS()
  }, [flushTTS])

  const cancelTTS = useCallback(() => {
    ttsQueueRef.current = []
    ttsBusyRef.current  = false
    window.speechSynthesis?.cancel()
  }, [])

  // Stagger opening messages — first one fires immediately, rest follow in sequence.
  // Shuffle so a random panelist always goes first.
  useEffect(() => {
    if (openingMsgs.length === 0) return
    const [first, ...rest] = [...openingMsgs].sort(() => Math.random() - 0.5)
    const ordered = [first, ...rest]
    let delay = 300
    ordered.forEach((msg, i) => {
      const isLast = i === ordered.length - 1
      setTimeout(() => {
        setLocalTranscript(prev => [...prev, msg])
        setActiveSpeaker(msg.speaker)
        setAppearingMsgId(msg.id)
        setRoomState('speaking')
        enqueueSpeak(msg.text, msg.speaker)
        if (isLast) {
          setTimeout(() => {
            setRoomState('idle')
            setOpeningsDone(true)
          }, 2800)
        }
      }, delay)
      delay += 2200
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight
    }
  }, [localTranscript, typingPersonaId])

  useEffect(() => { roomStateRef.current = roomState }, [roomState])
  useEffect(() => { speechOnRef.current  = speechOn  }, [speechOn])

  // Cancel TTS on unmount
  useEffect(() => () => {
    recognitionRef.current?.abort()
    cancelTTS()
  }, [cancelTTS])

  const getElapsedTime = () => {
    if (!session.startTime) return ''
    const elapsed = Math.floor((Date.now() - session.startTime) / 1000)
    const m = Math.floor(elapsed / 60)
    const s = elapsed % 60
    return `${m}:${String(s).padStart(2, '0')}`
  }

  const handleSend = async (textOverride) => {
    const text = textOverride !== undefined ? String(textOverride).trim() : inputValue.trim()
    if (!text || roomStateRef.current === 'thinking') return

    if (listening) stopListening()
    cancelTTS()

    const userMsg = {
      id: Date.now(),
      speaker: 'presenter',
      text,
      time: getElapsedTime(),
    }

    const nextTranscript = [...localTranscript, userMsg]
    setLocalTranscript(nextTranscript)
    setInputValue('')
    setRoomState('thinking')

    if (hasRealSession) {
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
            custom_personas: session.customPersonaDefs || {},
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

        const hasCondMet = (data.conditions_met || []).length > 0
        const followUp   = data.follow_up || null

        setTypingPersonaId(null)
        setLocalTranscript(updatedTranscript)
        setLocalConditions(updatedConditions)
        setActiveSpeaker(data.speaker)
        setAppearingMsgId(replyMsg.id)
        enqueueSpeak(replyMsg.text, replyMsg.speaker)

        if (followUp) {
          // Keep 'speaking' so input stays disabled during the follow-up sequence
          setRoomState('speaking')
          updateSession({ transcript: updatedTranscript, conditions: updatedConditions })

          setTimeout(() => {
            setTypingPersonaId(followUp.speaker)
            setRoomState('thinking')
          }, 2500)

          setTimeout(() => {
            const fuCondsMet = followUp.conditions_met || []
            const finalConditions = { ...updatedConditions }
            for (const cid of fuCondsMet) finalConditions[cid] = true

            const fuMsg = {
              id: Date.now() + 2,
              speaker: followUp.speaker,
              text: followUp.text,
              time: getElapsedTime(),
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
      } catch {
        setTypingPersonaId(null)
        setApiError(true)
        fallbackResponse()
      }
    } else {
      fallbackResponse()
    }
  }

  const fallbackResponse = () => {
    setResponseIdx(r => {
      const scripted   = SCRIPTED_RESPONSES[r % SCRIPTED_RESPONSES.length]
      const speakerId  = visiblePersonas.find(p => p.id === scripted.speaker)?.id
        || visiblePersonas[r % visiblePersonas.length]?.id

      if (!speakerId) return r + 1

      setActiveSpeaker(speakerId)
      setTypingPersonaId(speakerId)

      setTimeout(() => {
        const replyMsg = {
          id: Date.now() + 1,
          speaker: speakerId,
          text: scripted.text,
          ...(scripted.source ? { source: scripted.source } : {}),
          time: getElapsedTime(),
        }
        setTypingPersonaId(null)
        setRoomState('speaking')
        setLocalTranscript(prev => [...prev, replyMsg])
        setActiveSpeaker(speakerId)
        setAppearingMsgId(replyMsg.id)
        enqueueSpeak(replyMsg.text, speakerId)

        const tickCondition = r % 3 === 2
        const fuDef         = scripted.follow_up
        const fuSpeakerId   = fuDef ? (visiblePersonas.find(p => p.id === fuDef.speaker)?.id || null) : null

        if (fuSpeakerId) {
          setTimeout(() => {
            setTypingPersonaId(fuSpeakerId)
            setRoomState('thinking')
          }, 2500)

          setTimeout(() => {
            const fuMsg = {
              id: Date.now() + 2,
              speaker: fuSpeakerId,
              text: fuDef.text,
              ...(fuDef.source ? { source: fuDef.source } : {}),
              time: getElapsedTime(),
            }
            setTypingPersonaId(null)
            setLocalTranscript(prev => [...prev, fuMsg])
            setActiveSpeaker(fuSpeakerId)
            setAppearingMsgId(fuMsg.id)
            enqueueSpeak(fuMsg.text, fuSpeakerId)

            if (tickCondition) {
              setLocalConditions(prev => {
                const unmet = Object.keys(prev).find(k => !prev[k])
                return unmet ? { ...prev, [unmet]: true } : prev
              })
              setTimeout(() => setRoomState('condition-met'), 600)
              setTimeout(() => setRoomState('idle'), 2800)
            } else {
              setRoomState('speaking')
              setTimeout(() => setRoomState('idle'), 3500)
            }
          }, 4500)
        } else {
          if (tickCondition) {
            setLocalConditions(prev => {
              const unmet = Object.keys(prev).find(k => !prev[k])
              return unmet ? { ...prev, [unmet]: true } : prev
            })
            setTimeout(() => setRoomState('condition-met'), 600)
            setTimeout(() => setRoomState('idle'), 2200)
          } else {
            setTimeout(() => setRoomState('idle'), 3500)
          }
        }
      }, 1600)

      return r + 1
    })
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
    recognition.lang = 'en-US'
    recognition.continuous = false
    recognition.interimResults = false
    recognition.onstart  = () => setListening(true)
    recognition.onend    = () => setListening(false)
    recognition.onerror  = (e) => { console.warn('Speech error:', e.error); setListening(false) }
    recognition.onresult = (e) => {
      const transcript = e.results[0][0].transcript.trim()
      setListening(false)
      setInputValue(transcript)
    }
    recognitionRef.current = recognition
    recognition.start()
  }

  const toggleMic = () => listening ? stopListening() : startListening()

  const toggleSpeech = () => {
    setSpeechOn(prev => {
      const next = !prev
      saveVoiceSettings({ ...loadVoiceSettings(), enabled: next })
      if (!next) cancelTTS()
      return next
    })
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
          custom_personas: session.customPersonaDefs || {},
        }),
      })
      if (!res.ok) throw new Error(`API error ${res.status}`)
      const reportData = await res.json()

      const condMet   = Object.values(localConditions).filter(Boolean).length
      const condTotal = Object.keys(localConditions).length
      const duration  = session.startTime
        ? `${Math.floor((Date.now() - session.startTime) / 60000)} min`
        : ''

      saveSession({
        id: Date.now(),
        proposal: session.proposalName || 'Untitled proposal',
        date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        mode: session.config?.mode || 'Type',
        condMet,
        condTotal,
        duration,
        personaIds: session.personaIds || [],
      })

      updateSession({ reportData, conditions: localConditions })
      navigate('report')
    } catch {
      updateSession({ conditions: localConditions })
      navigate('report')
    } finally {
      setGeneratingReport(false)
    }
  }

  const typingPersona  = visiblePersonas.find(p => p.id === typingPersonaId)
  const spotlightStyle = {
    background: `radial-gradient(ellipse 700px 440px at ${spotlightX} -60px, ${spotlightColor} 0%, rgba(242,211,162,0.05) 42%, transparent 68%)`,
    transition: 'background 0.8s ease',
  }

  const turnLimit        = parseInt(session.config?.turnLimit) || 15
  const turnsLeft        = turnLimit - turnCount
  const turnLimitReached = hasRealSession && turnCount >= turnLimit
  const nearTurnLimit    = hasRealSession && turnsLeft <= 3 && turnsLeft > 0
  const isInputDisabled  = !openingsDone || turnLimitReached || (roomState !== 'idle' && roomState !== 'condition-met')
  const allConditionsMet = hasRealSession && openingsDone
    && Object.keys(localConditions).length > 0
    && Object.values(localConditions).every(Boolean)
  const showExitOffer    = allConditionsMet && !exitOfferDismissed

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
        </div>

        <div className="room-topbar-right">
          <button
            className="room-input-btn"
            onClick={toggleSpeech}
            title={speechOn ? 'Mute panel voices' : 'Unmute panel voices'}
            style={{
              background: speechOn ? 'rgba(255,255,255,0.08)' : 'transparent',
              border: 'none',
              color: speechOn ? 'var(--room-text-2)' : 'var(--room-text-3)',
              cursor: 'pointer', padding: '4px 8px', borderRadius: 6,
              display: 'flex', alignItems: 'center',
              transition: 'all 0.15s ease',
            }}
          >
            {speechOn ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>
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

      {apiError && hasRealSession && (
        <div style={{ maxWidth: 880, margin: '0 auto', width: '100%', padding: '0 32px 8px' }}>
        <div style={{
          padding: '9px 16px',
          background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)',
          borderRadius: 8, color: '#FCA5A5', fontSize: '0.8125rem',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
        }}>
          <span>AI unavailable. Using scripted responses. Check your API key in Vercel settings.</span>
          <button onClick={() => setApiError(false)} style={{ background: 'none', border: 'none', color: '#FCA5A5', cursor: 'pointer', padding: 0, fontSize: '1rem', lineHeight: 1 }}>×</button>
        </div>
        </div>
      )}

      {showExitOffer && (
        <div style={{ maxWidth: 880, margin: '0 auto', width: '100%', padding: '0 32px 8px' }}>
        <div style={{
          padding: '12px 20px',
          background: 'rgba(5,150,105,0.1)', border: '1px solid rgba(5,150,105,0.25)',
          borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        }}>
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
            className="room-input"
            placeholder={
              listening          ? 'Listening...' :
              turnLimitReached   ? 'Turn limit reached. End session above.' :
              isInputDisabled    ? 'Panel is responding...' :
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
            {mode === 'Hybrid' && (
              <button
                className={`room-input-btn mic ${listening ? 'listening' : ''}`}
                onClick={toggleMic}
                disabled={isInputDisabled || !speechSupported}
                title={
                  !speechSupported        ? 'Voice input not supported. Try Chrome or Edge.' :
                  listening               ? 'Stop listening' :
                  'Start voice input'
                }
              >
                {listening ? <MicOff size={16} /> : <Mic size={16} />}
              </button>
            )}
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

    </div>
  )
}
