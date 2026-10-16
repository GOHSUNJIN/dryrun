import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Mic, MicOff, Send, ExternalLink, Loader, Volume2, VolumeX, Check, Copy, FileText, X as XIcon, RefreshCw, Home, ChevronDown } from 'lucide-react'
import { PERSONAS, DEMO_TRANSCRIPT } from '../data.js'
import { saveSession, loadVoiceSettings, saveVoiceSettings, loadCustomPersonas } from '../utils/storage.js'
import { fetchWithRetry } from '../utils/api.js'
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
  const [showTip, setShowTip] = useState(false)

  return (
    <div
      className={`persona-seat ${isLit ? 'active' : 'dimmed'} ${isThinking ? 'thinking' : ''}`}
      style={{ position: 'relative' }}
      onMouseEnter={() => setShowTip(true)}
      onMouseLeave={() => setShowTip(false)}
      onClick={() => setShowTip(s => !s)}
    >
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

      {showTip && persona.conditions.length > 0 && (
        <div
          className="persona-conditions-tip"
          style={{
            position: 'absolute', left: '50%', transform: 'translateX(-50%)',
            background: 'rgba(12, 10, 9, 0.97)',
            border: `1px solid ${persona.color}40`,
            borderRadius: 10,
            padding: '11px 14px 13px', zIndex: 300,
            minWidth: 196, maxWidth: 244,
            boxShadow: `0 16px 48px rgba(0,0,0,0.75), 0 0 0 1px rgba(255,255,255,0.04)`,
            pointerEvents: 'none',
            whiteSpace: 'normal',
            textDecoration: 'none',
            fontFamily: 'var(--font-ui)',
          }}
        >
          <div style={{
            fontSize: '0.5625rem', fontWeight: 700, letterSpacing: '0.1em',
            textTransform: 'uppercase', color: persona.color,
            marginBottom: 9, textDecoration: 'none', lineHeight: 1,
          }}>
            {persona.role}
          </div>
          {persona.conditions.map((c, idx) => (
            <div key={c.id} style={{
              display: 'flex', gap: 9, alignItems: 'flex-start',
              marginBottom: idx < persona.conditions.length - 1 ? 7 : 0,
            }}>
              <div style={{
                width: 15, height: 15, borderRadius: '50%', flexShrink: 0, marginTop: 1,
                background: c.met ? 'rgba(5,150,105,0.2)' : 'rgba(255,255,255,0.06)',
                border: `1.5px solid ${c.met ? '#34D399' : 'rgba(255,255,255,0.18)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {c.met && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#34D399' }} />}
              </div>
              <div style={{
                fontSize: '0.6875rem', lineHeight: 1.45, textDecoration: 'none',
                color: c.met ? 'rgba(52,211,153,0.9)' : 'rgba(255,255,255,0.6)',
              }}>
                {c.text}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function TranscriptMsg({ msg, personas, appearing, onRegenerate, regenLabel = 'Try Different Response' }) {
  const isPresenter  = msg.speaker === 'presenter'
  const persona      = personas.find(p => p.id === msg.speaker)
  if (!isPresenter && !persona) return null
  const replyPersona = msg.replyTo ? personas.find(p => p.id === msg.replyTo) : null
  const [hovered, setHovered] = useState(false)
  const [copied, setCopied]   = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(msg.text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }).catch(() => {})
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
          {!appearing && (
            <button
              className="msg-copy-btn"
              onClick={handleCopy}
              style={{
                marginLeft: 6,
                opacity: hovered ? 1 : 0,
                pointerEvents: hovered ? 'auto' : 'none',
                background: copied ? 'rgba(5,150,105,0.15)' : 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 4, cursor: 'pointer',
                padding: '2px 6px', display: 'flex', alignItems: 'center', gap: 3,
                fontSize: '0.625rem', color: copied ? '#34D399' : 'var(--room-text-3)',
                transition: 'all 0.15s ease', flexShrink: 0,
              }}
            >
              {copied ? <Check size={9} /> : <Copy size={9} />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          )}
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

      {onRegenerate && !appearing && (
        <button
          onClick={onRegenerate}
          title={regenLabel}
          style={{
            alignSelf: 'flex-start', marginTop: 6,
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 5, cursor: 'pointer',
            padding: '3px 7px', display: 'flex', alignItems: 'center', gap: 4,
            fontSize: '0.6875rem', color: 'var(--room-text-3)',
            transition: 'all 0.15s ease',
          }}
        >
          <RefreshCw size={10} /> {regenLabel}
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
  const [preRegenState, setPreRegenState]           = useState(null)
  const [preRegenFollowUpState, setPreRegenFollowUpState] = useState(null)

  const { elapsed, getElapsedMinutes } = useElapsedTimer()

  const transcriptRef     = useRef(null)
  const inputRef          = useRef(null)
  const recognitionRef    = useRef(null)
  const roomStateRef      = useRef(roomState)
  const speechOnRef       = useRef(speechOn)
  const openingsFiredRef  = useRef(false)
  const userScrolledUpRef  = useRef(false)
  const shownOpeningTexts = useRef(new Set())
  const [showScrollBtn, setShowScrollBtn] = useState(false)

  const { enqueueSpeak, cancelTTS } = useTTS(speechOnRef)


  const turnCount = localTranscript.filter(m => m.speaker === 'presenter').length

  const allPersonas = [...PERSONAS, ...loadCustomPersonas()].map(p => ({
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

  // Redirect to home if session was lost (e.g. page refresh on /room)
  useEffect(() => {
    if (!session.proposalText) navigate('home')
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Warn before browser refresh/close during an active session
  useEffect(() => {
    const handler = (e) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [])

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

  // Clear appearing state once room is idle so retry button becomes visible
  useEffect(() => {
    if (roomState === 'idle' || roomState === 'condition-met') setAppearingMsgId(null)
  }, [roomState])

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
    const scrolledUp = (el.scrollHeight - el.scrollTop - el.clientHeight) > 60
    userScrolledUpRef.current = scrolledUp
    setShowScrollBtn(scrolledUp)
  }, [])

  const scrollToBottom = useCallback(() => {
    const el = transcriptRef.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
    userScrolledUpRef.current = false
    setShowScrollBtn(false)
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
    setShowScrollBtn(false)
    if (listening) stopListening()
    cancelTTS()

    const isLastTurn = hasRealSession && turnsLeft === 1
    const conditionsBeforeThisTurn = { ...localConditions }
    setPreRegenState(null)

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
        const res = await fetchWithRetry('/api/session/message', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            proposal_text:   session.proposalText,
            persona_ids:     session.personaIds,
            transcript:      nextTranscript,
            conditions:      localConditions,
            config:          { ...session.config, turns_remaining: turnsLeft - 1 },
            fact_check:      session.factCheckNotes || '',
            custom_personas: session.customPersonaDefs || {},
          }),
        })

        if (!res.ok) throw new Error(`API error ${res.status}`)
        const data = await res.json()

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
          setPreRegenFollowUpState({ transcriptBeforeFollowUp: updatedTranscript, conditionsBeforeFollowUp: updatedConditions })

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
              isFollowUp: true,
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
            setPreRegenState({ transcriptBeforeAi: nextTranscript, conditionsBeforeAi: conditionsBeforeThisTurn })

            if (hasCondMet || fuCondsMet.length > 0) {
              setRoomState('condition-met')
              setTimeout(() => setRoomState('idle'), 2200)
            } else {
              setRoomState('speaking')
              setTimeout(() => setRoomState('idle'), 1400)
            }
          }, 4500)
        } else {
          updateSession({ transcript: updatedTranscript, conditions: updatedConditions })
          setPreRegenState({ transcriptBeforeAi: nextTranscript, conditionsBeforeAi: conditionsBeforeThisTurn })
          if (hasCondMet) {
            setRoomState('condition-met')
            setTimeout(() => setRoomState('idle'), 2200)
          } else {
            setRoomState('speaking')
            setTimeout(() => setRoomState('idle'), 1400)
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

  const handleRegenerateOpening = async () => {
    if (roomState === 'thinking') return
    cancelTTS()

    const currentText = localTranscript[localTranscript.length - 1]?.text
    shownOpeningTexts.current.add(currentText)
    const previousResponses = [...shownOpeningTexts.current]

    const placeholder = visiblePersonas[Math.floor(Math.random() * visiblePersonas.length)]
    setTypingPersonaId(placeholder?.id || null)
    setRoomState('thinking')

    try {
      const res = await fetchWithRetry('/api/session/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proposal_text:      session.proposalText,
          persona_ids:        session.personaIds,
          transcript:         [],
          conditions:         {},
          config:             { ...session.config, regen: true },
          fact_check:         session.factCheckNotes || '',
          custom_personas:    {},
          previous_responses: previousResponses,
        }),
      })

      if (!res.ok) throw new Error(`API error ${res.status}`)
      const data = await res.json()
      const newMsg = {
        id: Date.now(),
        speaker: data.speaker,
        text: data.text,
        time: getCurrentTime(),
        type: 'opening',
      }
      shownOpeningTexts.current.add(newMsg.text)
      setTypingPersonaId(null)
      setLocalTranscript([newMsg])
      setActiveSpeaker(newMsg.speaker)
      setAppearingMsgId(newMsg.id)
      setRoomState('speaking')
      enqueueSpeak(newMsg.text, newMsg.speaker)
      setTimeout(() => setRoomState('idle'), 1400)
    } catch (err) {
      console.error('[regen-opening] API failed, falling back to local pool:', err.message)
      setTypingPersonaId(null)
      const pool = openingMsgs.filter(m => !shownOpeningTexts.current.has(m.text))
      if (!pool.length) { setRoomState('idle'); return }
      const newMsg = { ...([...pool].sort(() => Math.random() - 0.5))[0], id: Date.now(), time: getCurrentTime() }
      setLocalTranscript([newMsg])
      setActiveSpeaker(newMsg.speaker)
      setAppearingMsgId(newMsg.id)
      setRoomState('speaking')
      enqueueSpeak(newMsg.text, newMsg.speaker)
      setTimeout(() => setRoomState('idle'), 1400)
    }
  }

  const handleRegenerate = async () => {
    if (!preRegenState || roomState === 'thinking') return
    const { transcriptBeforeAi, conditionsBeforeAi } = preRegenState

    const previousResponses = localTranscript
      .slice(transcriptBeforeAi.length)
      .filter(m => m.speaker !== 'presenter')
      .map(m => m.text)
      .filter(Boolean)

    cancelTTS()
    setLocalTranscript(transcriptBeforeAi)
    setLocalConditions(conditionsBeforeAi)
    setRoomState('thinking')

    const nextPersona = visiblePersonas[0]
    if (!nextPersona) { setRoomState('idle'); return }
    setTypingPersonaId(nextPersona.id)

    const regenTurnsLeft = turnLimit - transcriptBeforeAi.filter(m => m.speaker === 'presenter').length

    try {
      const res = await fetchWithRetry('/api/session/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proposal_text:      session.proposalText,
          persona_ids:        session.personaIds,
          transcript:         transcriptBeforeAi,
          conditions:         conditionsBeforeAi,
          config:             { ...session.config, turns_remaining: regenTurnsLeft },
          fact_check:         session.factCheckNotes || '',
          custom_personas:    session.customPersonaDefs || {},
          previous_responses: previousResponses,
        }),
      })

      if (!res.ok) throw new Error(`API error ${res.status}`)
      const data = await res.json()
      if (!data.text?.trim()) {
        setTypingPersonaId(null)
        setRoomState('idle')
        return
      }

      const replyMsg = {
        id: Date.now() + 1,
        speaker: data.speaker,
        text: data.text,
        time: getCurrentTime(),
        ...(data.source ? { source: data.source } : {}),
      }
      const updatedTranscript = [...transcriptBeforeAi, replyMsg]
      const updatedConditions = { ...conditionsBeforeAi }
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
        setPreRegenFollowUpState({ transcriptBeforeFollowUp: updatedTranscript, conditionsBeforeFollowUp: updatedConditions })

        setTimeout(() => {
          setTypingPersonaId(followUp.speaker)
          setRoomState('thinking')
        }, 2500)

        setTimeout(() => {
          const fuCondsMet      = followUp.conditions_met || []
          const finalConditions = { ...updatedConditions }
          for (const cid of fuCondsMet) finalConditions[cid] = true

          const fuMsg = {
            id: Date.now() + 2,
            speaker: followUp.speaker,
            text: followUp.text,
            time: getCurrentTime(),
            isFollowUp: true,
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
          setPreRegenState({ transcriptBeforeAi, conditionsBeforeAi })

          if (hasCondMet || fuCondsMet.length > 0) {
            setRoomState('condition-met')
            setTimeout(() => setRoomState('idle'), 2200)
          } else {
            setRoomState('speaking')
            setTimeout(() => setRoomState('idle'), 1400)
          }
        }, 4500)
      } else {
        updateSession({ transcript: updatedTranscript, conditions: updatedConditions })
        setPreRegenState({ transcriptBeforeAi, conditionsBeforeAi })
        if (hasCondMet) {
          setRoomState('condition-met')
          setTimeout(() => setRoomState('idle'), 2200)
        } else {
          setRoomState('speaking')
          setTimeout(() => setRoomState('idle'), 1400)
        }
      }
    } catch (err) {
      console.error('[regenerate] failed:', err.message)
      setTypingPersonaId(null)
      setRoomState('idle')
    }
  }

  const handleRegenerateFollowUp = async () => {
    if (!preRegenFollowUpState || roomState === 'thinking') return
    const { transcriptBeforeFollowUp, conditionsBeforeFollowUp } = preRegenFollowUpState

    const previousResponses = localTranscript
      .slice(transcriptBeforeFollowUp.length)
      .filter(m => m.speaker !== 'presenter')
      .map(m => m.text)
      .filter(Boolean)

    cancelTTS()
    setLocalTranscript(transcriptBeforeFollowUp)
    setLocalConditions(conditionsBeforeFollowUp)
    setRoomState('thinking')

    const lastSpeakerId = transcriptBeforeFollowUp[transcriptBeforeFollowUp.length - 1]?.speaker
    const nextPersona = visiblePersonas.find(p => p.id !== lastSpeakerId) || visiblePersonas[0]
    if (!nextPersona) { setRoomState('idle'); return }
    setTypingPersonaId(nextPersona.id)

    try {
      const res = await fetchWithRetry('/api/session/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proposal_text:      session.proposalText,
          persona_ids:        session.personaIds,
          transcript:         transcriptBeforeFollowUp,
          conditions:         conditionsBeforeFollowUp,
          config:             { ...session.config, follow_up_only: true },
          fact_check:         session.factCheckNotes || '',
          custom_personas:    session.customPersonaDefs || {},
          previous_responses: previousResponses,
        }),
      })

      if (!res.ok) throw new Error(`API error ${res.status}`)
      const data = await res.json()

      if (!data.text?.trim()) {
        setTypingPersonaId(null)
        setRoomState('idle')
        return
      }

      const fuMsg = {
        id: Date.now() + 1,
        speaker: data.speaker,
        text: data.text,
        time: getCurrentTime(),
        isFollowUp: true,
        ...(data.source ? { source: data.source } : {}),
      }
      const finalTranscript = [...transcriptBeforeFollowUp, fuMsg]
      const condsMet = data.conditions_met || []
      const finalConditions = { ...conditionsBeforeFollowUp }
      for (const cid of condsMet) finalConditions[cid] = true

      setTypingPersonaId(null)
      setLocalTranscript(finalTranscript)
      setLocalConditions(finalConditions)
      setActiveSpeaker(data.speaker)
      setAppearingMsgId(fuMsg.id)
      enqueueSpeak(fuMsg.text, fuMsg.speaker)
      updateSession({ transcript: finalTranscript, conditions: finalConditions })
      setPreRegenFollowUpState({ transcriptBeforeFollowUp, conditionsBeforeFollowUp })

      if (condsMet.length > 0) {
        setRoomState('condition-met')
        setTimeout(() => setRoomState('idle'), 2200)
      } else {
        setRoomState('speaking')
        setTimeout(() => setRoomState('idle'), 1400)
      }
    } catch (err) {
      console.error('[regen-follow-up] failed:', err.message)
      setTypingPersonaId(null)
      setRoomState('idle')
    }
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
      documentName:  session.documentName || '',
      date:          formatSessionDate(),
      condMet,
      condTotal,
      duration:      sessionDuration,
      personaIds:    session.personaIds || [],
      config:        session.config || {},
      conditions:    localConditions,
      transcript:    localTranscript,
      reportData,
      linkedMeeting: session.linkedMeeting || '',
    })

    if (session.demoMode) {
      setGeneratingReport(true)
      const reportData = { demo: true, weak_points: [], moments: [] }
      const record = buildRecord(reportData)
      saveSession(record)
      updateSession({ id: record.id, reportData, conditions: localConditions, duration: sessionDuration, transcript: localTranscript })
      navigate('report')
      return
    }

    setGeneratingReport(true)
    try {
      const res = await fetchWithRetry('/api/session/end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proposal_text:   session.proposalText,
          persona_ids:     session.personaIds,
          transcript:      localTranscript,
          conditions:      localConditions,
          custom_personas: session.customPersonaDefs || {},
        }),
      })
      if (!res.ok) throw new Error(`API error ${res.status}`)
      const reportData = await res.json()
      const record = buildRecord(reportData)
      saveSession(record)
      updateSession({ id: record.id, reportData, conditions: localConditions, duration: sessionDuration, transcript: localTranscript })
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
          <button
            className="room-logo"
            onClick={() => {
              if (localTranscript.length > 1 && !window.confirm('Leave this session? Progress will not be saved.')) return
              navigate('home')
            }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 8 }}
          >
            <div className="room-logo-mark">
              <svg width="10" height="10" viewBox="0 0 14 14" fill="none">
                <rect x="1" y="4" width="5" height="9" rx="1" fill="#1C1917"/>
                <rect x="8" y="1" width="5" height="12" rx="1" fill="#1C1917"/>
              </svg>
            </div>
            <span className="room-logo-text">Dry Run</span>
          </button>
          <div className="room-divider" />
          <span className="room-proposal-title">{session.proposalName || 'Untitled proposal'}</span>
        </div>

        <div className="room-topbar-right">
          <button
            className="room-input-btn room-topbar-home"
            onClick={() => {
              if (localTranscript.length > 1 && !window.confirm('Leave this session? Progress will not be saved.')) return
              navigate('home')
            }}
            title="Go to home"
            style={{ background: 'transparent', border: 'none', color: 'var(--room-text-3)', cursor: 'pointer', padding: '4px 8px', borderRadius: 6, display: 'flex', alignItems: 'center' }}
          >
            <Home size={15} />
          </button>
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
          <span className="room-elapsed" style={{ fontSize: '0.75rem', color: 'var(--room-text-3)', fontVariantNumeric: 'tabular-nums', minWidth: 34 }}>
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
              ? <><Loader size={12} style={{ animation: 'spin 1s linear infinite' }} /> <span className="room-end-text-full">Generating Report...</span></>
              : <><span className="room-end-text-full">End Session</span><span className="room-end-text-short">End</span></>}
          </button>
        </div>
      </header>

      {session.demoMode && (
        <div className="room-demo-banner">
          {session.demoReason === 'no_key'
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

      <div className="room-transcript" ref={transcriptRef} onScroll={handleTranscriptScroll} style={{ position: 'relative' }}>
        {showScrollBtn && (
          <button
            onClick={scrollToBottom}
            style={{
              position: 'sticky', top: 12, zIndex: 20,
              display: 'flex', alignItems: 'center', gap: 5,
              margin: '0 auto', padding: '5px 14px',
              background: 'rgba(26,28,33,0.92)',
              border: '1px solid var(--room-border)',
              borderRadius: 20, cursor: 'pointer',
              fontSize: '0.75rem', color: 'var(--room-text-2)',
              backdropFilter: 'blur(8px)',
              boxShadow: '0 2px 12px rgba(0,0,0,0.4)',
            }}
          >
            <ChevronDown size={13} /> Jump to Latest
          </button>
        )}
        <div className="room-transcript-inner">
          {localTranscript.map((msg, idx) => {
            const isLastMsg      = idx === localTranscript.length - 1
            const isAiMsg        = msg.speaker !== 'presenter'
            const isOpening      = isLastMsg && isAiMsg && turnCount === 0 && openingMsgs.length > 1 && hasRealSession && !session.demoMode
            const canRegenFollowUp = isLastMsg && msg.isFollowUp && preRegenFollowUpState && hasRealSession && !session.demoMode
              && (roomState === 'idle' || roomState === 'condition-met')
            const canRegen       = isLastMsg && isAiMsg && !msg.isFollowUp && preRegenState && hasRealSession && !session.demoMode
              && (roomState === 'idle' || roomState === 'condition-met')
            const showRetry      = (canRegen || isOpening || canRegenFollowUp) && (roomState === 'idle' || roomState === 'condition-met')
            const regenHandler   = showRetry
              ? (isOpening ? handleRegenerateOpening : canRegenFollowUp ? handleRegenerateFollowUp : handleRegenerate)
              : undefined
            const regenLabel     = canRegenFollowUp ? 'Regenerate Question' : 'Try Different Response'
            return (
              <TranscriptMsg
                key={msg.id}
                msg={msg}
                personas={visiblePersonas}
                appearing={msg.id === appearingMsgId}
                onRegenerate={regenHandler}
                regenLabel={regenLabel}
              />
            )
          })}
          <AnimatePresence>
            {typingPersona && <TypingIndicator key="typing" persona={typingPersona} />}
          </AnimatePresence>
        </div>
      </div>

      {roomState === 'condition-met' && (
        <div className="room-banner-wrap">
          <div className="room-banner success">
            <Check size={13} style={{ flexShrink: 0 }} /> Condition Met
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
              {generatingReport ? <Loader size={12} style={{ animation: 'spin 1s linear infinite' }} /> : 'End and Get Report'}
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
              >Keep Going</button>
              <button
                className="btn btn-sm"
                onClick={handleEndSession}
                disabled={generatingReport}
                style={{ background: '#059669', borderColor: '#059669', color: '#fff', fontSize: '0.75rem' }}
              >
                {generatingReport ? <Loader size={12} style={{ animation: 'spin 1s linear infinite' }} /> : 'End and Get Report'}
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
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck="false"
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
