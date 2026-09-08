import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../store/auth.store'

const ROLE_HOME: Record<string, string> = {
  ADMIN: '/admin',
  TECHNICIAN_DELIVERY: '/technician',
  TECHNICIAN: '/registro',
}

/**
 * Punto de entrada para "/" y cualquier ruta no reconocida ("*").
 * Si ya hay una sesion valida (persistida en localStorage vía
 * useAuthStore) con un rol que tiene panel propio, redirige directo
 * a ese panel en vez de forzar el login. En cualquier otro caso
 * (no autenticado, o rol CLIENT sin panel aqui) redirige a /login.
 */
export default function RoleHome() {
  const { user, isAuthenticated } = useAuthStore()

  const home = isAuthenticated && user ? ROLE_HOME[user.role] : undefined

  return <Navigate to={home ?? '/login'} replace />
}
