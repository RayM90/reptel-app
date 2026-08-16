import { create } from 'zustand'

interface ConfirmOptions {
  title: string
  message?: string
  requireText?: boolean
  textLabel?: string
  confirmLabel?: string
}

interface ConfirmDialogState {
  isOpen: boolean
  options: ConfirmOptions | null
  resolver: ((value: string | true | null) => void) | null
  open: (options: ConfirmOptions) => Promise<string | true | null>
  close: (result: string | true | null) => void
}

export const useConfirmDialogStore = create<ConfirmDialogState>((set, get) => ({
  isOpen: false,
  options: null,
  resolver: null,
  open: (options) => {
    return new Promise((resolve) => {
      set({ isOpen: true, options, resolver: resolve })
    })
  },
  close: (result) => {
    const { resolver } = get()
    if (resolver) resolver(result)
    set({ isOpen: false, options: null, resolver: null })
  },
}))