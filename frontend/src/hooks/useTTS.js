import { useCallback, useRef } from 'react'
import { loadVoiceSettings } from '../utils/storage.js'

const PERSONA_VOICE = {
  finance:         { pitch: 0.85, rate: 0.92 },
  legal:           { pitch: 1.0,  rate: 0.88 },
  ops:             { pitch: 0.8,  rate: 1.0  },
  factcheck:       { pitch: 1.05, rate: 0.9  },
  event_director:  { pitch: 0.95, rate: 0.93 },
  event_finance:   { pitch: 0.88, rate: 0.9  },
  event_safety:    { pitch: 1.0,  rate: 0.87 },
  event_programme: { pitch: 0.92, rate: 0.95 },
}

function getVoices() {
  return new Promise(resolve => {
    const voices = window.speechSynthesis.getVoices()
    if (voices.length > 0) { resolve(voices); return }
    const onChanged = () => {
      window.speechSynthesis.removeEventListener('voiceschanged', onChanged)
      resolve(window.speechSynthesis.getVoices())
    }
    window.speechSynthesis.addEventListener('voiceschanged', onChanged)
    // Fallback: resolve after 1s even if event never fires (some iOS versions)
    setTimeout(() => { window.speechSynthesis.removeEventListener('voiceschanged', onChanged); resolve(window.speechSynthesis.getVoices()) }, 1000)
  })
}

export function useTTS(speechOnRef) {
  const ttsQueueRef = useRef([])
  const ttsBusyRef  = useRef(false)

  const flushTTS = useCallback(async () => {
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
    try {
      await getVoices()
      window.speechSynthesis.speak(utter)
    } catch (err) {
      console.warn('[TTS] speak() threw:', err.message)
      ttsBusyRef.current = false
      flushTTS()
    }
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
