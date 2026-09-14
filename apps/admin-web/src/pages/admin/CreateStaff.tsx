import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../services/api'
import PhoneInput from '../../components/PhoneInput'

type StaffRole = 'TECHNICIAN_DELIVERY' | 'TECHNICIAN'

interface ResetRequest {
  id: string
  email: string
  createdAt: string
}

export default function CreateStaff() {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [lastName, setLastName] = useState('')
  const [idNumber, setIdNumber] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<StaffRole>('TECHNICIAN_DELIVERY')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [resetRequests, setResetRequests] = useState<ResetRequest[]>([])
  const [resetPasswordText, setResetPasswordText] = useState<Record<string, string>>({})
  const [resetResultByRequest, setResetResultByRequest] = useState<Record<string, string>>({})
  const [resetLoadingId, setResetLoadingId] = useState<string | null>(null)

  const fetchResetRequests = async () => {
    try {
      const res = await api.get('/api/auth/password-reset-requests')
      setResetRequests(res.data.data)
    } catch {
      // silencioso — no bloquea el resto de la página
    }
  }

  useEffect(() => {
    fetchResetRequests()
  }, [])

  const handleResolveReset = async (requestId: string) => {
    const newPassword = resetPasswordText[requestId] || ''
    if (newPassword.length < 8) return
    setResetLoadingId(requestId)
    try {
      await api.post(`/api/auth/password-reset-requests/${requestId}/resolve`, { newPassword })
      setResetResultByRequest((prev) => ({
        ...prev,
        [requestId]: `Contraseña temporal establecida: ${newPassword} — entrégasela al empleado.`,
      }))
      fetchResetRequests()
    } catch (err: any) {
      setResetResultByRequest((prev) => ({
        ...prev,
        [requestId]: err?.response?.data?.message || 'Error al resolver la solicitud',
      }))
    } finally {
      setResetLoadingId(null)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)
    try {
      await api.post('/api/auth/staff', { email, password, name, lastName, idNumber, role, phone })
      setSuccess(`Empleado "${name} ${lastName}" creado. Contraseña temporal: ${password} — entrégasela para su primer inicio de sesión.`)
      setEmail('')
      setName('')
      setLastName('')
      setIdNumber('')
      setPhone('')
      setPassword('')
      setRole('TECHNICIAN_DELIVERY')
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Error al crear el empleado')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page-container">
      <h1>Crear Usuario de Personal</h1>
      <p><Link to="/admin">← Volver al Panel de Administrador</Link></p>

      <div className="card" style={{ maxWidth: 400 }}>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Nombre</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label>Apellido</label>
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label>Cédula</label>
            <input
              type="text"
              value={idNumber}
              onChange={(e) => setIdNumber(e.target.value)}
              required
            />
          </div>
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
            <label>Teléfono (opcional)</label>
            <PhoneInput value={phone} onChange={setPhone} />
          </div>
          <div className="form-group">
            <label>Rol</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as StaffRole)}
            >
              <option value="TECHNICIAN_DELIVERY">Técnico de Reparación (motorizado)</option>
              <option value="TECHNICIAN">Personal de Recepción</option>
            </select>
          </div>
          <div className="form-group">
            <label>Contraseña temporal</label>
            <input
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
            />
            <p className="form-hint">
              Mínimo 8 caracteres. El empleado deberá establecer su contraseña definitiva en su primer inicio de sesión.
            </p>
          </div>

          {error && <p className="alert-error">{error}</p>}
          {success && <p className="alert-success">{success}</p>}

          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? 'Creando…' : 'Crear empleado'}
          </button>
        </form>
      </div>

      <div className="card" style={{ maxWidth: 500, marginTop: 32 }}>
        <h2>Solicitudes de restablecimiento</h2>
        {resetRequests.length === 0 ? (
          <p>No hay solicitudes pendientes</p>
        ) : (
          resetRequests.map((r) => (
            <div key={r.id} style={{ borderTop: '1px solid var(--color-border)', paddingTop: 12, marginTop: 12 }}>
              <p><strong>{r.email}</strong> — {new Date(r.createdAt).toLocaleString('es-VE')}</p>
              {resetResultByRequest[r.id] ? (
                <p className="alert-success">{resetResultByRequest[r.id]}</p>
              ) : (
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 160 }}>
                    <input
                      type="text"
                      placeholder="Contraseña temporal (mín. 8 caracteres)"
                      value={resetPasswordText[r.id] || ''}
                      onChange={(e) => setResetPasswordText((prev) => ({ ...prev, [r.id]: e.target.value }))}
                      minLength={8}
                    />
                  </div>
                  <button
                    className="btn btn-secondary"
                    disabled={resetLoadingId === r.id || (resetPasswordText[r.id] || '').length < 8}
                    onClick={() => handleResolveReset(r.id)}
                  >
                    Generar contraseña temporal
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}