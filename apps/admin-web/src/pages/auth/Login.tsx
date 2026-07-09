import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../services/api'
import { useAuthStore } from '../../store/auth.store'

export default function Login() {
  const navigate = useNavigate()
  const setUser = useAuthStore((state) => state.setUser)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Estado del challenge de cambio de contraseña obligatorio
  const [requiresNewPassword, setRequiresNewPassword] = useState(false)
  const [session, setSession] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')



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
      <div>
        <h1>RepTel Admin</h1>
        <p>Debes establecer una nueva contraseña para continuar</p>
        <form onSubmit={handleNewPasswordSubmit}>
          <div>
            <label>Nueva contraseña</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
          </div>
          <div>
            <label>Confirmar nueva contraseña</label>
            <input
              type="password"
              value={confirmNewPassword}
              onChange={(e) => setConfirmNewPassword(e.target.value)}
              required
            />
          </div>
          {error && <p>{error}</p>}
          <button type="submit" disabled={loading}>
            {loading ? 'Guardando...' : 'Establecer contraseña'}
          </button>
        </form>
      </div>
    )
  }

  return (
    <div>
      <h1>RepTel Admin</h1>
      <form onSubmit={handleSubmit}>
        <div>
          <label>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div>
          <label>Contraseña</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        {error && <p>{error}</p>}
        <button type="submit" disabled={loading}>
          {loading ? 'Ingresando...' : 'Ingresar'}
        </button>
      </form>
    </div>
  )
}