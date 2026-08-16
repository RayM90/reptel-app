import { useEffect, useRef } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'

const DRAFT_PREFIX = 'reptel-payment-draft:'

function draftKeyFor(screen: string, orderId: string | undefined): string {
  return `${DRAFT_PREFIX}${screen}:${orderId ?? 'unknown'}`
}

/**
 * Persiste un formulario de pago en AsyncStorage mientras el usuario lo
 * completa. El flujo de pago exige salir a la app del banco/Binance a
 * hacer la transferencia y volver — en un Android gama media/baja eso es
 * un disparador realista de que el sistema mate el proceso y se pierda
 * todo lo tecleado. Este hook restaura el borrador al volver, y lo borra
 * cuando el envío tiene éxito (ver `clearDraft`).
 */
export function usePaymentDraft<T extends Record<string, string>>(
  screen: string,
  orderId: string | undefined,
  values: T,
  applyLoaded: (loaded: Partial<T>) => void
): { clearDraft: () => void } {
  const key = draftKeyFor(screen, orderId)
  const hasLoadedRef = useRef(false)

  useEffect(() => {
    hasLoadedRef.current = false
    if (!orderId) return

    let cancelled = false
    AsyncStorage.getItem(key)
      .then((raw) => {
        if (cancelled) return
        if (raw) {
          try {
            applyLoaded(JSON.parse(raw))
          } catch {
            // Borrador corrupto — se ignora, el usuario llena de nuevo.
          }
        }
      })
      .finally(() => {
        if (!cancelled) hasLoadedRef.current = true
      })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, orderId])

  useEffect(() => {
    if (!orderId || !hasLoadedRef.current) return
    AsyncStorage.setItem(key, JSON.stringify(values)).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, orderId, JSON.stringify(values)])

  const clearDraft = () => {
    AsyncStorage.removeItem(key).catch(() => {})
  }

  return { clearDraft }
}
