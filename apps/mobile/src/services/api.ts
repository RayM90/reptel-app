import axios from 'axios'

const API_URL = 'http://192.168.0.116:3000'// Cambia esto a la URL de tu servidor backend

export const api = axios.create({
  baseURL: API_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
})

api.interceptors.request.use((config) => {
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

  uploadReceipt: (id: string, paymentDetails: Record<string, string>) =>
    api.patch(`/api/product-orders/${id}/receipt`, { paymentDetails }),
 // Uso futuro en admin-web (rol ADMIN)
  confirmPayment: (id: string, approved: boolean) =>
    api.patch(`/api/product-orders/${id}/confirm-payment`, { approved }),

  // Dirección B — repuesto vinculado a una orden de Servicio Técnico en curso
  createLinked: (data: {
    items: { productId: string; quantity: number }[]
    paymentMethod: 'PAGO_MOVIL' | 'TRANSFERENCIA' | 'BINANCE'
    linkedOrderId: string
    notes?: string
  }) => api.post('/api/product-orders/link-to-service', data),
}

export const chatbotAPI = {
  sendMessage: (sessionId: string, message: string) =>
    api.post('/api/chatbot/message', { sessionId, message }),
}
