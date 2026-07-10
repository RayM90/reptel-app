import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/auth.store'

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Administrador',
  TECHNICIAN_DELIVERY: 'Técnico',
  DELIVERY: 'Motorizado',
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
        <div style={{ background: 'linear-gradient(135deg, var(--color-bg-1), var(--color-bg-2))', borderRadius: '6px', padding: '2px 5px', display: 'flex', alignItems: 'center' }}>
          <img src="/logo-reptel.png" alt="RepTel" style={{ height: '40px', width: 'auto', display: 'block' }} />
        </div>
    
      </span>
      {user && (
        <div className="header-bar__user">
          <span>{user.name}</span>
          <span className="header-bar__role">{ROLE_LABELS[user.role] ?? user.role}</span>
          <button className="btn btn-outline" style={{ borderColor: '#fff', color: '#fff' }} onClick={handleLogout}>
            Cerrar sesión
          </button>
        </div>
      )}
    </div>
  )
}