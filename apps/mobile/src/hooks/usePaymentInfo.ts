import { useQuery } from '@tanstack/react-query'
import { api } from '../services/api'

export interface PaymentSettings {
  pagoMovilBanco: string
  pagoMovilTelefono: string
  pagoMovilCedula: string
  transferenciaBanco: string
  transferenciaCuenta: string
  transferenciaRif: string
  binanceId: string
  binanceRed: string
}

export function usePaymentInfo() {
  return useQuery<PaymentSettings>({
    queryKey: ['payment-settings'],
    queryFn: async () => (await api.get('/api/settings/payment-methods')).data.data,
    staleTime: 5 * 60 * 1000,
  })
}

export function formatPaymentInfo(s: PaymentSettings, method: 'PAGO_MOVIL' | 'TRANSFERENCIA' | 'BINANCE'): string {
  if (method === 'PAGO_MOVIL') return `Banco: ${s.pagoMovilBanco} • Teléfono: ${s.pagoMovilTelefono} • CI: ${s.pagoMovilCedula}`
  if (method === 'TRANSFERENCIA') return `Banco: ${s.transferenciaBanco} • Cuenta: ${s.transferenciaCuenta} • RIF: ${s.transferenciaRif}`
  return `ID Binance: ${s.binanceId} • Red: ${s.binanceRed}`
}
