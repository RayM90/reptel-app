import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../services/api'
import PhoneInput from '../../components/PhoneInput'
import IdNumberInput from '../../components/IdNumberInput'
import { STAFF_ID_PREFIXES, STAFF_ID_MIN_DIGITS, STAFF_ID_MAX_DIGITS, PHONE_PREFIXES, PHONE_DIGITS_LENGTH } from '../../constants/venezuela'
import { STAFF_EMAIL_DOMAIN } from '../../config/constants'

type StaffRole = 'TECHNICIAN_DELIVERY' | 'TECHNICIAN'
type Field = 'name' | 'lastName' | 'idNumber' | 'phone' | 'emailLocal' | 'password'

const NAME_REGEX = /^[A-Za-zÁÉÍÓÚÑÜáéíóúñü ]{2,50}$/
const ID_NUMBER_REGEX = new RegExp(`^[${STAFF_ID_PREFIXES.join('')}]-\\d{${STAFF_ID_MIN_DIGITS},${STAFF_ID_MAX_DIGITS}}$`)
const EMAIL_LOCAL_REGEX = /^[a-z0-9._-]{2,30}$/

export default function CreateStaff() {
  const [emailLocal, setEmailLocal] = useState('')
  const [name, setName] = useState('')
  const [lastName, setLastName] = useState('')
  const [idNumber, setIdNumber] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<StaffRole>('TECHNICIAN_DELIVERY')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({})

  const markTouched = (field: Field) => setTouched((t) => ({ ...t, [field]: true }))

  const isNameValid = NAME_REGEX.test(name.trim())
  const isLastNameValid = NAME_REGEX.test(lastName.trim())
  const isIdNumberValid = ID_NUMBER_REGEX.test(idNumber)
  const isPhoneValid = PHONE_PREFIXES.some((p) => phone.startsWith(p)) && phone.length === 4 + PHONE_DIGITS_LENGTH
  const isEmailLocalValid = EMAIL_LOCAL_REGEX.test(emailLocal)
  const isPasswordValid = password.length >= 8
  const isFormValid = isNameValid && isLastNameValid && isIdNumberValid && isPhoneValid && isEmailLocalValid && isPasswordValid

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setTouched({ name: true, lastName: true, idNumber: true, phone: true, emailLocal: true, password: true })
    if (!isFormValid) return

    setError('')
    setSuccess('')
    setLoading(true)
    const email = `${emailLocal.trim().toLowerCase()}${STAFF_EMAIL_DOMAIN}`
    try {
      await api.post('/api/auth/staff', { email, password, name: name.trim(), lastName: lastName.trim(), idNumber, role, phone })
      setSuccess(`Empleado "${name.trim()} ${lastName.trim()}" creado. Contraseña temporal: ${password} — entrégasela para su primer inicio de sesión.`)
      setEmailLocal('')
      setName('')
      setLastName('')
      setIdNumber('')
      setPhone('')
      setPassword('')
      setRole('TECHNICIAN_DELIVERY')
      setTouched({})
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

      <div className="card" style={{ maxWidth: 480 }}>
        <form onSubmit={handleSubmit} noValidate>
          <span className="card-eyebrow">Identidad</span>

          <div className="form-group">
            <label>Nombre</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => markTouched('name')}
            />
            {touched.name && !isNameValid && (
              <p className="form-error-text">2 a 50 letras, sin números ni símbolos.</p>
            )}
          </div>

          <div className="form-group">
            <label>Apellido</label>
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              onBlur={() => markTouched('lastName')}
            />
            {touched.lastName && !isLastNameValid && (
              <p className="form-error-text">2 a 50 letras, sin números ni símbolos.</p>
            )}
          </div>

          <div className="form-group">
            <label>Cédula</label>
            <IdNumberInput
              value={idNumber}
              onChange={setIdNumber}
              prefixes={[...STAFF_ID_PREFIXES]}
              minDigits={STAFF_ID_MIN_DIGITS}
              maxDigits={STAFF_ID_MAX_DIGITS}
            />
            <p className="form-hint">Solo persona natural (V/E), 7 u 8 dígitos.</p>
            {touched.idNumber && !isIdNumberValid && (
              <p className="form-error-text">Cédula incompleta o con formato inválido.</p>
            )}
            <input type="hidden" onBlur={() => markTouched('idNumber')} tabIndex={-1} />
          </div>

          <div className="form-group">
            <label>Teléfono</label>
            <PhoneInput value={phone} onChange={setPhone} required />
            {touched.phone && !isPhoneValid && (
              <p className="form-error-text">Selecciona el prefijo y completa los 7 dígitos.</p>
            )}
            <input type="hidden" onBlur={() => markTouched('phone')} tabIndex={-1} />
          </div>

          <span className="card-eyebrow">Acceso</span>

          <div className="form-group">
            <label>Correo institucional</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="text"
                value={emailLocal}
                onChange={(e) => setEmailLocal(e.target.value.toLowerCase())}
                onBlur={() => markTouched('emailLocal')}
                placeholder="jperez"
                style={{ flex: 1 }}
              />
              <span style={{ color: 'var(--color-text-muted)', fontSize: 14, whiteSpace: 'nowrap' }}>
                {STAFF_EMAIL_DOMAIN}
              </span>
            </div>
            <p className="form-hint">Toda cuenta de personal usa el dominio institucional — no se puede cambiar.</p>
            {touched.emailLocal && !isEmailLocalValid && (
              <p className="form-error-text">2 a 30 caracteres: letras minúsculas, números, puntos, guiones.</p>
            )}
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
              onBlur={() => markTouched('password')}
              minLength={8}
            />
            <p className="form-hint">
              Mínimo 8 caracteres. El empleado deberá establecer su contraseña definitiva en su primer inicio de sesión.
            </p>
            {touched.password && !isPasswordValid && (
              <p className="form-error-text">Mínimo 8 caracteres.</p>
            )}
          </div>

          {error && <p className="alert-error">{error}</p>}
          {success && <p className="alert-success">{success}</p>}

          <button className="btn btn-primary" type="submit" disabled={loading || (Object.keys(touched).length > 0 && !isFormValid)}>
            {loading ? 'Creando…' : 'Crear empleado'}
          </button>
        </form>
      </div>
    </div>
  )
}
