import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../services/api'
import { useAuthStore } from '../../store/auth.store'

function EyeIcon({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    )
  }
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a18.5 18.5 0 0 1 5.06-5.94M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  )
}

export default function Login() {
  const navigate = useNavigate()
  const setUser = useAuthStore((state) => state.setUser)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Estado del challenge de cambio de contraseña obligatorio
  const [requiresNewPassword, setRequiresNewPassword] = useState(false)
  const [session, setSession] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const response = await api.post('/api/auth/login', { email, password })
      const data = response.data.data

      // Cognito exige establecer nueva contraseña (primer login de usuario creado por admin)
      if (data.challengeName === 'NEW_PASSWORD_REQUIRED') {
        setSession(data.session)
        setRequiresNewPassword(true)
        setLoading(false)
        return
      }

      const { user, token } = data
      if (user.role !== 'ADMIN' && user.role !== 'TECHNICIAN_DELIVERY' && user.role !== 'DELIVERY') {
        setError('Este panel es solo para personal autorizado')
        setLoading(false)
        return
      }

      setUser(user, token)

      if (user.role === 'ADMIN') {
        navigate('/admin')
      } else if (user.role === 'TECHNICIAN_DELIVERY') {
        navigate('/technician')
      } else if (user.role === 'DELIVERY') {
        navigate('/delivery')
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Credenciales inválidas')
    } finally {
      setLoading(false)
    }
  }

  const handleNewPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (newPassword !== confirmNewPassword) {
      setError('Las contraseñas no coinciden')
      return
    }
    if (newPassword.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres')
      return
    }

    setLoading(true)
    try {
      const response = await api.post('/api/auth/complete-new-password', {
        email,
        newPassword,
        session,
      })
      const { user, token } = response.data.data

      if (user.role !== 'ADMIN' && user.role !== 'TECHNICIAN_DELIVERY' && user.role !== 'DELIVERY') {
        setError('Este panel es solo para personal autorizado')
        setLoading(false)
        return
      }

      setUser(user, token)

      if (user.role === 'ADMIN') {
        navigate('/admin')
      } else if (user.role === 'TECHNICIAN_DELIVERY') {
        navigate('/technician')
      } else if (user.role === 'DELIVERY') {
        navigate('/delivery')
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Error al establecer nueva contraseña')
    } finally {
      setLoading(false)
    }
  }

  if (requiresNewPassword) {
    return (
      <div className="login-page">
        <div className="login-card">
          <img src="/logo-reptel.png" alt="RepTel" className="login-logo" />
          <h1 className="login-title">Nueva contraseña</h1>
          <p className="login-subtitle">Debes establecer una nueva contraseña para continuar</p>
          <form onSubmit={handleNewPasswordSubmit}>
            <div className="form-group">
              <label>Nueva contraseña</label>
              <div className="input-with-icon">
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="input-icon-btn"
                  onClick={() => setShowNewPassword((prev) => !prev)}
                  aria-label={showNewPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  <EyeIcon open={showNewPassword} />
                </button>
              </div>
            </div>
            <div className="form-group">
              <label>Confirmar nueva contraseña</label>
              <div className="input-with-icon">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="input-icon-btn"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  aria-label={showConfirmPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  <EyeIcon open={showConfirmPassword} />
                </button>
              </div>
            </div>
            {error && <p className="alert-error">{error}</p>}
            <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%' }}>
              {loading ? 'Guardando…' : 'Establecer contraseña'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <img src="/logo-reptel.png" alt="RepTel" className="login-logo" />
        <p className="login-subtitle">Acceso de personal</p>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label>Contraseña</label>
            <div className="input-with-icon">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className="input-icon-btn"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                <EyeIcon open={showPassword} />
              </button>
            </div>
          </div>
          {error && <p className="alert-error">{error}</p>}
          <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%' }}>
            {loading ? 'Ingresando…' : 'Ingresar'}
          </button>
        </form>
      </div>
    </div>
  )
}