export interface Order {
  id: string
  orderNumber: string
  status: string
  problem: string
  diagnosis: string | null
  budget: string | null
  deliveredAt: string | null
  client: { name: string; lastName: string }
  technician: { id: string; name: string } | null
  deliveryAmount: string | null
  revisionAmount: string | null
  advancePaymentSubmissions: PaymentSubmission[]
  finalPaymentDetails: Record<string, string> | null
  technicianCommission: string | null
}

export interface PaymentSubmission {
  id: string
  amount: string
  paymentDetails: Record<string, string>
  status: 'PENDING' | 'CONFIRMED' | 'REJECTED'
  rejectionReason: string | null
  createdAt: string
}

// Self-service + delivery: RECEIVED solo significa "pago confirmado", no que el
// técnico ya fue a buscar el equipo. Hasta que haya diagnóstico, el recibo de
// intake se etiqueta como "anticipo" en vez de "recepción".
export const isIntakePendingPickup = (order: Order) => order.deliveryAmount != null && !order.diagnosis
