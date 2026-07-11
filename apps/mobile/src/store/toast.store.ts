import { create } from 'zustand'

export type ToastType = 'success' | 'error'

interface ToastState {
  visible: boolean
  message: string
  type: ToastType
  showToast: (message: string, type?: ToastType) => void
  hideToast: () => void
}

// Duración fija del toast en pantalla. Prototipo de tesis, no configurable.
const TOAST_DURATION_MS = 3000

let hideTimeout: ReturnType<typeof setTimeout> | null = null

export const useToastStore = create<ToastState>((set) => ({
  visible: false,
  message: '',
  type: 'success',
  showToast: (message, type = 'success') => {
    if (hideTimeout) clearTimeout(hideTimeout)
    set({ visible: true, message, type })
    hideTimeout = setTimeout(() => {
      set({ visible: false })
    }, TOAST_DURATION_MS)
  },
  hideToast: () => {
    if (hideTimeout) clearTimeout(hideTimeout)
    set({ visible: false })
  },
}))