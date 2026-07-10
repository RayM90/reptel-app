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
    <div>
      <h1>Crear Usuario de Personal</h1>
      <p><Link to="/admin">← Volver al Panel de Administrador</Link></p>

      <form onSubmit={handleSubmit} style={{ maxWidth: 400 }}>
        <div>
          <label>Nombre completo</label>
          <br />
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            style={{ width: '100%' }}
          />
        </div>
        <div>
          <label>Email</label>
          <br />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ width: '100%' }}
          />
        </div>
        <div>
          <label>Teléfono (opcional)</label>
          <br />
          <input
            type="text"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            style={{ width: '100%' }}
          />
        </div>
        <div>
          <label>Rol</label>
          <br />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as StaffRole)}
            style={{ width: '100%' }}
          >
            <option value="TECHNICIAN_DELIVERY">Técnico</option>
            <option value="DELIVERY">Motorizado</option>
          </select>
        </div>
        <div>
          <label>Contraseña temporal</label>
          <br />
          <input
            type="text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            style={{ width: '100%' }}
          />
          <p style={{ fontSize: '0.85em', color: '#666' }}>
            Mínimo 8 caracteres. El empleado deberá establecer su contraseña definitiva en su primer inicio de sesión.
          </p>
        </div>

        {error && <p style={{ color: 'red' }}>{error}</p>}
        {success && <p style={{ color: 'green' }}>{success}</p>}

        <button type="submit" disabled={loading}>
          {loading ? 'Creando...' : 'Crear empleado'}
        </button>
      </form>
    </div>
  )
}