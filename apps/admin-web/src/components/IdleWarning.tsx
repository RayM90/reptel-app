import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useIdleLogout } from '../hooks/useIdleLogout'
import { endSession } from '../lib/session'

// 15 min sin actividad + 60 s de aviso. En desarrollo, ?idleTest=1 acorta a
// 10 s + 5 s para poder probarlo.
const fastTest = import.meta.env.DEV && new URLSearchParams(window.location.search).has('idleTest')
const IDLE_MS = fastTest ? 10_000 : 15 * 60_000
const WARN_MS = fastTest ? 5_000 : 60_000

export default function IdleWarning() {
  const navigate = useNavigate()
  const stayRef = useRef<HTMLButtonElement>(null)
  const { warning, secondsLeft, stay } = useIdleLogout({
    idleMs: IDLE_MS,
    warnMs: WARN_MS,
    onTimeout: async () => {
      await endSession()
      navigate('/login?motivo=inactividad', { replace: true })
    },
  })

  useEffect(() => { if (warning) stayRef.current?.focus() }, [warning])

  if (!warning) return null

  const logoutNow = async () => {
    await endSession()
    navigate('/login', { replace: true })
  }

  return (
    <div className="modal-overlay" style={{ zIndex: 1100 }}>
      <div className="modal-box" role="alertdialog" aria-modal="true" aria-labelledby="idle-title" aria-describedby="idle-desc">
        <h3 id="idle-title">¿Sigues ahí?</h3>
        <p id="idle-desc" className="form-hint" aria-live="polite">
          Por seguridad, la sesión se cerrará en <strong>{secondsLeft} s</strong> si no hay actividad.
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
          <button className="btn btn-outline" onClick={logoutNow}>Cerrar sesión</button>
          <button className="btn btn-primary" ref={stayRef} onClick={stay}>Seguir conectado</button>
        </div>
      </div>
    </div>
  )
}
