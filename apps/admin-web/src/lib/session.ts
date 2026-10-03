import { api } from '../services/api'
import { useAuthStore } from '../store/auth.store'

// Cierra la sesión en el servidor (el token deja de servir) y luego en el
// navegador. Si el servidor no responde, igual se limpia la sesión local.
export async function endSession(): Promise<void> {
  if (useAuthStore.getState().token) {
    await api.post('/api/auth/logout').catch(() => {})
  }
  useAuthStore.getState().logout()
}
