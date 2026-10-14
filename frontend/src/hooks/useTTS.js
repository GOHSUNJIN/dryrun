import { useCallback, useRef } from 'react'
import { loadVoiceSettings } from '../utils/storage.js'

const PERSONA_VOICE = {
  finance:   { pitch: 0.85, rate: 0.92 },
  legal:     { pitch: 1.0,  rate: 0.88 },
  ops:       { pitch: 0.8,  rate: 1.0  },
  factcheck: { pitch: 1.05, rate: 0.9  },
}

export function useTTS(speechOnRef) {
  const ttsQueueRef = useRef([])
  const ttsBusyRef  = useRef(false)

  const flushTTS = useCallback(() => {
    if (ttsBusyRef.current || ttsQueueRef.current.length === 0) return
    if (!speechOnRef.current || typeof window === 'undefined' || !window.speechSynthesis) return
    const { text, speakerId } = ttsQueueRef.current.shift()
    const utter   = new SpeechSynthesisUtterance(text)
    const params  = PERSONA_VOICE[speakerId] || { pitch: 1.0, rate: 1.0 }
    const vs      = loadVoiceSettings()
    utter.pitch   = params.pitch
    utter.rate    = params.rate * (vs.rate || 1.0)
    utter.onend   = () => { ttsBusyRef.current = false; flushTTS() }
    utter.onerror = () => { ttsBusyRef.current = false; flushTTS() }
    ttsBusyRef.current = true
    window.speechSynthesis.speak(utter)
  }, [speechOnRef])

  const enqueueSpeak = useCallback((text, speakerId) => {
    if (!speechOnRef.current) return
    ttsQueueRef.current.push({ text, speakerId })
    flushTTS()
  }, [flushTTS, speechOnRef])

  const cancelTTS = useCallback(() => {
    ttsQueueRef.current = []
    ttsBusyRef.current  = false
    window.speechSynthesis?.cancel()
  }, [])

  return { enqueueSpeak, cancelTTS }
}
