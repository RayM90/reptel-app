export interface Order {
  id: string
  orderNumber: string
  status: string
  problem: string
  diagnosis: string | null
  observations: string | null
  budget: string | null
  deliveredAt: string | null
  finalPaymentConfirmed: boolean
  client: {
    name: string
    lastName: string
    idNumber: string
    phone: string
    email: string | null
    addressState: string | null
    addressCity: string | null
    addressNeighborhood: string | null
    addressStreet: string | null
    addressBuilding: string | null
  }
  technician: { id: string; name: string } | null
  device: { accessories: string | null }
  deliveryAmount: string | null
  revisionAmount: string | null
  advancePaymentSubmissions: PaymentSubmission[]
  finalPaymentDetails: Record<string, string> | null
  technicianCommission: string | null
  statusHistory: StatusHistoryEntry[]
  // Calculado por el backend (repairMinimum.ts). null si todavía no hay presupuesto.
  paymentSummary?: {
    budget: number
    paid: number
    remaining: number
    minimumPercent: number
    minimumAmount: number
    pendingForMinimum: number
    // Abonos del presupuesto enviados que todavía no se revisaron.
    pendingReview: number
  } | null
}

export interface PaymentSubmission {
  id: string
  amount: string
  paymentDetails: Record<string, string>
  status: 'PENDING' | 'CONFIRMED' | 'REJECTED'
  rejectionReason: string | null
  createdAt: string
  kind: 'REVISION' | 'BUDGET'
}

export interface StatusHistoryEntry {
  id: string
  status: string
  comment: string | null
  createdAt: string
}

// Self-service + delivery: con el pago confirmado la orden pasa a ON_THE_WAY
// (el técnico va a buscar el equipo), no a RECEIVED. Hasta que haya
// diagnóstico, el recibo de intake se etiqueta como "anticipo" en vez de
// "recepción".
export const isIntakePendingPickup = (order: Order) => order.deliveryAmount != null && !order.diagnosis

// Construye la dirección completa del cliente a partir de los campos
// opcionales que existan — cualquiera puede ser null si el registro es viejo
// o incompleto.
export const formatClientAddress = (
  client: Pick<Order['client'], 'addressStreet' | 'addressNeighborhood' | 'addressBuilding' | 'addressCity' | 'addressState'>,
): string | null => {
  const parts = [
    client.addressStreet,
    client.addressNeighborhood,
    client.addressBuilding,
    client.addressCity,
    client.addressState,
  ].filter((p): p is string => Boolean(p))
  return parts.length > 0 ? parts.join(', ') : null
}
