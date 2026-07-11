import { useEffect } from 'react'
import { useToastStore } from '../store/toast.store'

export default function Toast() {
  const { message, type, hideToast } = useToastStore()

  useEffect(() => {
    if (!message) return
    const timer = setTimeout(() => hideToast(), 4000)
    return () => clearTimeout(timer)
  }, [message, hideToast])

  if (!message) return null

  return (
    <div
      className={type === 'success' ? 'toast toast-success' : 'toast toast-error'}
      onClick={hideToast}
    >
      {message}
    </div>
  )
}