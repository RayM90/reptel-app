import { create } from 'zustand'

export interface ConfirmOptions {
  title: string
  message?: string
  confirmLabel?: string
  cancelLabel?: string
  // Si es true, el diálogo pide un texto (ej. motivo de rechazo) y resuelve
  // con ese texto en vez de con un booleano. Mismo patrón que useConfirm en admin-web.
  requireText?: boolean
  textLabel?: string
}

interface ConfirmState {
  visible: boolean
  options: ConfirmOptions | null
  inputValue: string
  resolver: ((value: boolean | string | null) => void) | null
  setInputValue: (value: string) => void
  request: (options: ConfirmOptions) => Promise<boolean | string | null>
  resolve: (value: boolean | string | null) => void
}

export const useConfirmStore = create<ConfirmState>((set, get) => ({
  visible: false,
  options: null,
  inputValue: '',
  resolver: null,
  setInputValue: (value) => set({ inputValue: value }),
  request: (options) => {
    return new Promise((resolve) => {
      set({ visible: true, options, inputValue: '', resolver: resolve })
    })
  },
  resolve: (value) => {
    const { resolver } = get()
    set({ visible: false, options: null, inputValue: '', resolver: null })
    if (resolver) resolver(value)
  },
}))