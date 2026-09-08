import axios from 'axios'
import Constants from 'expo-constants'

const API_PORT = 3000

// En desarrollo, Expo ya sabe a qué IP se conectó el dispositivo/emulador para
// descargar el bundle (hostUri). Se reutiliza esa IP para el backend en vez de
// hardcodear una IP de LAN, que cambia cada vez que la máquina de desarrollo
// se reconecta a la red (DHCP) y deja la app apuntando a una IP muerta.
function resolveDevApiUrl(): string | undefined {
  const hostUri = Constants.expoConfig?.hostUri
  const host = hostUri?.split(':')[0]
  return host ? `http://${host}:${API_PORT}` : undefined
}

// En dev, la IP auto-detectada manda: EXPO_PUBLIC_API_URL en .env es fácil de
// dejar desactualizada (fue justo la causa de este bug) y no hay forma de que
// el desarrollador se entere hasta que falla el login. En builds que no son
// de desarrollo (producción/staging) no existe hostUri, así que se usa la
// variable de entorno.
const API_URL = (__DEV__ && resolveDevApiUrl()) || process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000'

export const api = axios.create({
  baseURL: API_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
})

api.interceptors.request.use((config) => {
  // Se usa require() en vez de import para evitar dependencia circular:
  // auth.store.ts importa `api` de este mismo archivo.
  const { useAuthStore } = require('../store/auth.store')
  const token = useAuthStore.getState().token
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error.response?.data || error.message)
    return Promise.reject(error)
  }
)

export const ordersAPI = {
  getAll: () => api.get('/api/orders'),
  getById: (id: string) => api.get(`/api/orders/${id}`),
  track: (orderNumber: string) => api.get(`/api/orders/track/${orderNumber}`),
  create: (data: any) => api.post('/api/orders', data),
  updateStatus: (id: string, status: string, comment?: string) =>
    api.patch(`/api/orders/${id}/status`, { status, comment }),
  updateBudget: (id: string, budget: number, approved: boolean) =>
    api.patch(`/api/orders/${id}/budget`, { budget, approved }),

// ── Cliente (self-service) ──────────────────────────────────
  createSelfService: (data: {
    device: {
      type: 'LAPTOP' | 'PC'
      brand: string
      model: string
      serialNumber?: string
      color: string
      accessories: string
      devicePassword?: string
    }
    problem: string
    observations?: string
    advancePaymentMethod: 'PAGO_MOVIL' | 'TRANSFERENCIA' | 'BINANCE'
  }) => api.post('/api/orders/self-service', data),

  getMyOrders: () => api.get('/api/orders/my-orders'),

  // Pago anticipado (delivery + revisión) — sube el comprobante
    submitAdvancePayment: (id: string, paymentDetails: Record<string, string>) =>
    api.post(`/api/orders/${id}/advance-payment`, { paymentDetails }),

  // Pago anticipado en partes — el cliente decide el monto de cada abono
    submitAdvancePaymentInstallment: (id: string, paymentDetails: Record<string, string>, amount: number) =>
    api.post(`/api/orders/${id}/advance-payment-installment`, { paymentDetails, amount }),

    submitFinalPayment: (id: string, paymentDetails: Record<string, string>) =>
    api.post(`/api/orders/${id}/final-payment`, { paymentDetails }),

  // Cliente decide sobre el presupuesto tras el diagnóstico del técnico
  approveBudget: (id: string) =>
    api.post(`/api/orders/${id}/approve-budget`),

  rejectBudget: (id: string, reason: string) =>
    api.post(`/api/orders/${id}/reject-budget`, { reason }),

  // Confirmar o disputar diagnóstico sin costo ($0)
  confirmZeroBudgetDiagnosis: (id: string) =>
    api.post(`/api/orders/${id}/confirm-zero-budget-diagnosis`),

  disputeZeroBudgetDiagnosis: (id: string, note?: string) =>
    api.post(`/api/orders/${id}/dispute-zero-budget-diagnosis`, { note }),
}

export const productOrdersAPI = {
  create: (data: {
    items: { productId: string; quantity: number }[]
    paymentMethod: 'PAGO_MOVIL' | 'TRANSFERENCIA' | 'BINANCE'
    address: string
    notes?: string
    requiresInstallation?: boolean
  }) => api.post('/api/product-orders', data),

  getMyOrders: () => api.get('/api/product-orders/my-orders'),

  getById: (id: string) => api.get(`/api/product-orders/${id}`),

  // Enviar un abono (parcial o total) para un pedido de tienda
  uploadReceipt: (id: string, paymentDetails: Record<string, string>, amount: number) =>
    api.patch(`/api/product-orders/${id}/receipt`, { paymentDetails, amount }),

  // Confirmar o rechazar un abono específico (rol ADMIN)
  confirmPartialPayment: (submissionId: string, approved: boolean, rejectionReason?: string) =>
    api.patch(`/api/product-orders/payment-submissions/${submissionId}/confirm`, { approved, rejectionReason }),

  // Dirección B — repuesto vinculado a una orden de Servicio Técnico en curso
  createLinked: (data: {
    items: { productId: string; quantity: number }[]
    paymentMethod: 'PAGO_MOVIL' | 'TRANSFERENCIA' | 'BINANCE'
    linkedOrderId: string
    address: string
    notes?: string
  }) => api.post('/api/product-orders/link-to-service', data),
}