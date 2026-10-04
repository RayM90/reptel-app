export interface AdvanceSubmission {
  id: string
  amount: number
  status: 'PENDING' | 'CONFIRMED' | 'REJECTED'
  kind?: 'REVISION' | 'BUDGET'
}

interface AdvanceOrder {
  deliveryAmount?: number | null
  revisionAmount?: number | null
  advancePaymentSubmissions?: AdvanceSubmission[]
}

// Anticipo (revisión, + delivery en órdenes de la app). "counted" suma
// PENDING + CONFIRMED para que el cliente nunca envíe de más aunque haya
// abonos sin revisar; "confirmed" es solo lo ya aprobado por el local — es lo
// que se muestra como pagado para no dar a entender que algo pendiente de
// revisión ya está confirmado.
export const getAdvanceStatus = (order: AdvanceOrder) => {
  // Orden de mostrador (sin delivery): solo se cobra la revisión, y se paga
  // en el local — no desde la app.
  const isCounterOrder = order.deliveryAmount == null
  const total = isCounterOrder
    ? Number(order.revisionAmount ?? 15)
    : Number(order.deliveryAmount) + Number(order.revisionAmount ?? 15)
  const submissions = order.advancePaymentSubmissions ?? []
  const counted = submissions.filter((s) => s.status !== 'REJECTED').reduce((sum, s) => sum + Number(s.amount), 0)
  const confirmed = submissions.filter((s) => s.status === 'CONFIRMED').reduce((sum, s) => sum + Number(s.amount), 0)
  return { isCounterOrder, total, counted, confirmed, remaining: Math.max(0, total - counted), submissions }
}
