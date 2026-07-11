import { create } from 'zustand'

type ToastType = 'success' | 'error'

interface ToastState {
  message: string | null
  type: ToastType
  showToast: (message: string, type: ToastType) => void
  hideToast: () => void
}

export const useToastStore = create<ToastState>((set) => ({
  message: null,
  type: 'success',
  showToast: (message, type) => set({ message, type }),
  hideToast: () => set({ message: null }),
}))