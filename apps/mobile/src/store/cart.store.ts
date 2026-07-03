import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'

export interface CartItem {
  id: string
  name: string
  price: number
  quantity: number
  imageUrl: string | null
  categoryName: string
  requiresInstallation: boolean
}

interface CartState {
  items: CartItem[]
  totalItems: number
  totalPrice: number
  addItem: (item: Omit<CartItem, 'quantity'>) => void
  removeItem: (id: string) => void
  updateQuantity: (id: string, quantity: number) => void
  clearCart: () => void
}

const calcTotals = (items: CartItem[]) => ({
  totalItems: items.reduce((sum, i) => sum + i.quantity, 0),
  totalPrice: items.reduce((sum, i) => sum + i.price * i.quantity, 0),
})

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      totalItems: 0,
      totalPrice: 0,

      addItem: (newItem) =>
        set((state) => {
          const existing = state.items.find((i) => i.id === newItem.id)
          const updated = existing
            ? state.items.map((i) =>
                i.id === newItem.id ? { ...i, quantity: i.quantity + 1 } : i
              )
            : [...state.items, { ...newItem, quantity: 1 }]
          return { items: updated, ...calcTotals(updated) }
        }),

      removeItem: (id) =>
        set((state) => {
          const updated = state.items.filter((i) => i.id !== id)
          return { items: updated, ...calcTotals(updated) }
        }),

      updateQuantity: (id, quantity) =>
        set((state) => {
          const updated = quantity <= 0
            ? state.items.filter((i) => i.id !== id)
            : state.items.map((i) => (i.id === id ? { ...i, quantity } : i))
          return { items: updated, ...calcTotals(updated) }
        }),

      clearCart: () => set({ items: [], totalItems: 0, totalPrice: 0 }),
    }),
    {
      name: 'reptel-cart-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
)