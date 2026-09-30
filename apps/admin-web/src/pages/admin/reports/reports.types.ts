// Formas de las respuestas de /api/reports/*. Las fechas viajan como string (JSON).

export interface PeriodReport {
  money: {
    total: number
    revision: number
    repair: number
    byChannel: { WEB: number; APK: number }
  }
  activity: { received: number; delivered: number }
  daily: {
    day: string
    received: number
    delivered: number
    collected: number
    partsUnits: number
    partsAmount: number
  }[]
  technicians: {
    technicianId: string
    technicianName: string
    delivered: number
    commission: number
    avgDays: number | null
  }[]
}

export interface PartsReport {
  used: {
    units: number
    amount: number
    awaitingPaymentAmount: number
    byProduct: {
      productId: string
      productName: string
      units: number
      amount: number
      orders: number
    }[]
  }
  technicianLosses: {
    units: number
    amount: number
    items: {
      movementId: string
      day: string
      productName: string
      quantity: number
      amount: number
      orderNumber: string
      technicianName: string
      description: string
    }[]
  }
  // null cuando hay filtros de técnico, cliente o canal (los ajustes son de la tienda)
  store: {
    damagedOnArrival: { units: number; amount: number }
    sales: { units: number; estimatedAmount: number }
    otherAdjustments: { units: number }
  } | null
}

export type PendingGroupKey = 'payment' | 'intake' | 'review' | 'repair' | 'ready' | 'pickup'

export interface PendingOrderRow {
  orderId: string
  orderNumber: string
  status: string
  clientName: string
  technicianName: string
  channel: 'WEB' | 'APK'
  receivedAt: string
  daysOpen: number
  pendingConfirmation: number
  balanceDue: number
}

export interface PendingReport {
  groups: { key: PendingGroupKey; label: string; count: number; orders: PendingOrderRow[] }[]
  toCollect: {
    orders: number
    pendingConfirmation: { count: number; amount: number }
    balanceDue: { count: number; amount: number }
    total: number
  }
}

export interface AuditOrderRow {
  orderId: string
  orderNumber: string
  receivedAt: string
  deliveredAt: string | null
  status: string
  channel: 'WEB' | 'APK'
  clientName: string
  clientIdNumber: string
  technicianName: string
  technicianCommission: number
  diagnosis: string | null
  totalAmount: number
  partsUsed: { productName: string; quantity: number; amount: number }[]
}

export interface ClientSearchResult {
  id: string
  name: string
  lastName: string
  idNumber: string
}

export interface Technician {
  id: string
  name: string
  idNumber: string | null
}

export interface ClientHistory {
  client: { id: string; name: string; lastName: string; idNumber: string; phone: string; email: string | null }
  devicesIngresados: number
  totalPaid: number
  activeOrders: { orderId: string; orderNumber: string; status: string; deviceId: string }[]
  possibleWarrantyCases: { orderId: string; orderNumber: string }[]
  history: {
    orderId: string
    orderNumber: string
    receivedAt: string
    deliveredAt: string | null
    status: string
    deviceLabel: string
    totalAmount: number
  }[]
}
