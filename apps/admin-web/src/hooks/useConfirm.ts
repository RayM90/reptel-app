import { useConfirmDialogStore } from '../store/confirmDialog.store'

export function useConfirm() {
  const open = useConfirmDialogStore((state) => state.open)
  return open
}