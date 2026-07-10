import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../services/api'

type StaffRole = 'TECHNICIAN_DELIVERY' | 'DELIVERY'

export default function CreateStaff() {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<StaffRole>('TECHNICIAN_DELIVERY')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)
    try {
      await api.post('/api/auth/staff', { email, password, name, role, phone })
      setSuccess(`Empleado "${name}" creado. Contraseña temporal: ${password} — entrégasela para su primer inicio de sesión.`)
      setEmail('')
      setName('')
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
            <label>Nombre completo</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
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
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>Rol</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as StaffRole)}
            >
              <option value="TECHNICIAN_DELIVERY">Técnico</option>
              <option value="DELIVERY">Motorizado</option>
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
            {loading ? 'Creando...' : 'Crear empleado'}
          </button>
        </form>
      </div>
    </div>
  )
}