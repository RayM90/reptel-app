import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/auth.store'

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Administrador',
  TECHNICIAN_DELIVERY: 'Técnico',
  TECHNICIAN: 'Mostrador',
}

export default function Header() {
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const logout = useAuthStore((state) => state.logout)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="header-bar">
      <span className="header-bar__brand" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <img src="/logo-reptel.png" alt="RepTel" style={{ height: '56px', width: 'auto', display: 'block' }} />
      </span>
      {user && (
        <div className="header-bar__user">
          <span>{user.lastName ? `${user.name} ${user.lastName}` : user.name}</span>
          <span className="header-bar__role">{ROLE_LABELS[user.role] ?? user.role}</span>
          <button className="btn btn-outline" onClick={handleLogout}>
            Cerrar sesión
          </button>
        </div>
      )}
    </div>
  )
}