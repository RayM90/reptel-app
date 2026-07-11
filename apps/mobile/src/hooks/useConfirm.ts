import { useConfirmStore } from '../store/confirmDialog.store'

// Mismo patrón de uso que en admin-web:
//   const confirmDialog = useConfirm()
//   const confirmed = await confirmDialog({ title: '...', confirmLabel: '...' })
//   const reason = await confirmDialog({ title: '...', requireText: true, textLabel: '...' })
export function useConfirm() {
  return useConfirmStore((state) => state.request)
}