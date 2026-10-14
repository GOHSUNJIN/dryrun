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
    <div style={{
      position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
      zIndex: 300, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center',
      pointerEvents: 'none',
    }}>
      <AnimatePresence>
        {toasts.map(t => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: 12, scale: 0.95 }}
            animate={{ opacity: 1, y: 0,  scale: 1    }}
            exit={{   opacity: 0, y: 6,   scale: 0.97 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '9px 18px', borderRadius: 10,
              background: t.type === 'error' ? '#DC2626' : 'var(--text-primary)',
              color: 'var(--bg-base)',
              fontSize: '0.8125rem', fontWeight: 500, fontFamily: 'var(--font-ui)',
              boxShadow: '0 4px 20px rgba(0,0,0,0.18)', whiteSpace: 'nowrap',
            }}
          >
            {t.type === 'error' ? <X size={13} /> : <Check size={13} />}
            {t.message}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
