import axios from 'axios'

const API_URL = 'http://192.168.0.107:3000'

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
}