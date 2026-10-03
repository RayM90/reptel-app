import { useCallback, useEffect, useRef, useState } from 'react'

const ACTIVITY_KEY = 'reptel-last-activity'
const EVENTS = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart'] as const

const readLastActivity = () => {
  try { return Number(localStorage.getItem(ACTIVITY_KEY)) || Date.now() } catch { return Date.now() }
}
const writeLastActivity = (t: number) => {
  try { localStorage.setItem(ACTIVITY_KEY, String(t)) } catch { /* sin almacenamiento: cada pestaña cuenta sola */ }
}

/**
 * Cierre de sesión por inactividad. Tras `idleMs` sin actividad muestra el
 * aviso; si en `warnMs` nadie pulsa "Seguir conectado", llama a `onTimeout`.
 * La última actividad se comparte entre pestañas por localStorage, para que
 * una pestaña olvidada no cierre la sesión de otra que se está usando.
 */
export function useIdleLogout({ idleMs, warnMs, onTimeout }: { idleMs: number; warnMs: number; onTimeout: () => void }) {
  const [warning, setWarning] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(Math.round(warnMs / 1000))
  const warningRef = useRef(false)
  const lastWriteRef = useRef(0)
  const timeoutRef = useRef(onTimeout)
  timeoutRef.current = onTimeout

  const markActivity = useCallback(() => {
    if (warningRef.current) return // con el aviso abierto hay que pulsar el botón
    const now = Date.now()
    if (now - lastWriteRef.current < 1000) return
    lastWriteRef.current = now
    writeLastActivity(now)
  }, [])

  const stay = useCallback(() => {
    warningRef.current = false
    setWarning(false)
    lastWriteRef.current = 0
    writeLastActivity(Date.now())
  }, [])

  useEffect(() => {
    writeLastActivity(Date.now())
    EVENTS.forEach((e) => window.addEventListener(e, markActivity, { passive: true }))
    const tick = setInterval(() => {
      const idle = Date.now() - readLastActivity()
      if (idle >= idleMs + warnMs) {
        clearInterval(tick)
        timeoutRef.current()
      } else if (idle >= idleMs) {
        warningRef.current = true
        setWarning(true)
        setSecondsLeft(Math.max(0, Math.ceil((idleMs + warnMs - idle) / 1000)))
      } else if (warningRef.current) {
        // Otra pestaña registró actividad: se cierra el aviso aquí también.
        warningRef.current = false
        setWarning(false)
      }
    }, 1000)
    return () => {
      clearInterval(tick)
      EVENTS.forEach((e) => window.removeEventListener(e, markActivity))
    }
  }, [idleMs, warnMs, markActivity])

  return { warning, secondsLeft, stay }
}
