import { useState, useRef, useEffect } from 'react'

export function useElapsedTimer() {
  const startTimeRef = useRef(Date.now())
  const [elapsed, setElapsed] = useState('0:00')

  useEffect(() => {
    const timer = setInterval(() => {
      const secs = Math.floor((Date.now() - startTimeRef.current) / 1000)
      const m = Math.floor(secs / 60)
      const s = secs % 60
      setElapsed(`${m}:${s.toString().padStart(2, '0')}`)
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  const getElapsedMinutes = () =>
    Math.max(1, Math.round((Date.now() - startTimeRef.current) / 60000))

  return { elapsed, getElapsedMinutes }
}
