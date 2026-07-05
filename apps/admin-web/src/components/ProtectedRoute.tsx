import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../store/auth.store'

type Role = 'ADMIN' | 'TECHNICIAN_DELIVERY' | 'DELIVERY'

interface ProtectedRouteProps {
  children: React.ReactNode
  allowedRoles: Role[]
}

export default function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, isAuthenticated } = useAuthStore()

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />
  }

  if (!allowedRoles.includes(user.role as Role)) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}