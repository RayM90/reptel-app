import { create } from 'zustand'

type Role =
  | 'ADMIN'
  | 'TECHNICIAN'
  | 'TECHNICIAN_DELIVERY'
  | 'DELIVERY'
  | 'CLIENT'
  | 'CASHIER'
  | 'MANAGER'
  | 'SELLER'
  | 'SUPPORT'

interface User {
  id: string
  name: string
  email: string
  phone?: string
  role: Role
}

interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  setUser: (user: User, token: string) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,

  setUser: (user, token) => {
    set({ user, token, isAuthenticated: true })
  },

  logout: () => {
    set({ user: null, token: null, isAuthenticated: false })
  },
}))