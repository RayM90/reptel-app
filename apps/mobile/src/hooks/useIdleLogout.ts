import { useCallback, useEffect, useRef, useState } from 'react'
import { AppState } from 'react-native'

// Última vez que el usuario tocó la pantalla. Es de módulo para que el
// _layout lo actualice sin re-renderizar toda la app en cada toque.
let lastActivity = Date.now()
export const markActivity = () => { lastActivity = Date.now() }

/**
 * Tras `idleMs` sin tocar la pantalla muestra el aviso; si en `warnMs` nadie
 * pulsa "Seguir conectado", llama a `onTimeout`. Si la app vuelve del segundo
 * plano y ya pasó el tiempo total, cierra directo sin aviso.
 */
export function useIdleLogout({ enabled, idleMs, warnMs, onTimeout }: { enabled: boolean; idleMs: number; warnMs: number; onTimeout: () => void }) {
  const [warning, setWarning] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(Math.round(warnMs / 1000))
  const warningRef = useRef(false)
  const timeoutRef = useRef(onTimeout)
  timeoutRef.current = onTimeout

  const stay = useCallback(() => {
    warningRef.current = false
    setWarning(false)
    markActivity()
  }, [])

  useEffect(() => {
    if (!enabled) { warningRef.current = false; setWarning(false); return }
    markActivity()
    const check = () => {
      const idle = Date.now() - lastActivity
      if (idle >= idleMs + warnMs) {
        warningRef.current = false
        setWarning(false)
        timeoutRef.current()
      } else if (idle >= idleMs) {
        // Con el aviso abierto, tocar la pantalla no basta: hay que pulsar el botón.
        if (!warningRef.current) { warningRef.current = true; setWarning(true) }
        setSecondsLeft(Math.max(0, Math.ceil((idleMs + warnMs - idle) / 1000)))
      }
    }
    const tick = setInterval(check, 1000)
    const sub = AppState.addEventListener('change', (state) => { if (state === 'active') check() })
    return () => { clearInterval(tick); sub.remove() }
  }, [enabled, idleMs, warnMs])

  return { warning, secondsLeft, stay }
}
