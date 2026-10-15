import { useState, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, X } from 'lucide-react'

export function useToast() {
  const [toasts, setToasts] = useState([])

  const show = useCallback((message, type = 'success', duration = 2200) => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration)
  }, [])

  return { toasts, show }
}

export default function ToastStack({ toasts }) {
  return (
    <div className="toast-stack">
      <AnimatePresence>
        {toasts.map(t => (
          <motion.div
            key={t.id}
            className={`toast-item${t.type === 'error' ? ' toast-item--error' : ''}`}
            initial={{ opacity: 0, y: 12, scale: 0.95 }}
            animate={{ opacity: 1, y: 0,  scale: 1    }}
            exit={{   opacity: 0, y: 6,   scale: 0.97 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
          >
            {t.type === 'error' ? <X size={13} /> : <Check size={13} />}
            {t.message}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
