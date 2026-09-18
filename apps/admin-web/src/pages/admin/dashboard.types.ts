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
  budgetRejectionReason: string | null
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

// Self-service + delivery: RECEIVED solo significa "pago confirmado", no que el
// técnico ya fue a buscar el equipo. Hasta que haya diagnóstico, el recibo de
// intake se etiqueta como "anticipo" en vez de "recepción".
export const isIntakePendingPickup = (order: Order) => order.deliveryAmount != null && !order.diagnosis

// Construye la dirección completa del cliente a partir de los campos
// opcionales que existan — cualquiera puede ser null si el registro es viejo
// o incompleto.
export const formatClientAddress = (client: Order['client']): string | null => {
  const parts = [
    client.addressStreet,
    client.addressNeighborhood,
    client.addressBuilding,
    client.addressCity,
    client.addressState,
  ].filter((p): p is string => Boolean(p))
  return parts.length > 0 ? parts.join(', ') : null
}
