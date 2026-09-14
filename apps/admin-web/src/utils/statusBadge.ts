export type BadgeVariant = 'success' | 'danger' | 'progress' | 'warning' | 'info' | 'neutral'

interface StatusBadgeInfo {
  label: string
  variant: BadgeVariant
}

const ORDER_STATUS: Record<string, StatusBadgeInfo> = {
  PENDING_PAYMENT: { label: 'Pago pendiente', variant: 'neutral' },
  RECEIVED: { label: 'Recibido', variant: 'neutral' },
  DIAGNOSING: { label: 'En diagnóstico', variant: 'progress' },
  WAITING_APPROVAL: { label: 'Diagnóstico Listo - Notificar Cliente', variant: 'warning' },
  APPROVED: { label: 'Aprobado', variant: 'progress' },
  REPAIRING: { label: 'En reparación', variant: 'progress' },
  WAITING_PART: { label: 'Esperando repuesto', variant: 'progress' },
  READY: { label: 'Listo para entrega', variant: 'success' },
  PAID_PENDING_DELIVERY: { label: 'Pagado, pendiente de entrega', variant: 'info' },
  REJECTED_PENDING_PICKUP: { label: 'Rechazado, pendiente de retiro', variant: 'danger' },
  DELIVERED: { label: 'Entregado', variant: 'success' },
  CANCELLED: { label: 'Cancelado', variant: 'danger' },
}

const PARTIAL_PAYMENT_STATUS: Record<string, StatusBadgeInfo> = {
  PENDING: { label: 'Pendiente', variant: 'neutral' },
  CONFIRMED: { label: 'Confirmado', variant: 'success' },
  REJECTED: { label: 'Rechazado', variant: 'danger' },
}

const STATUS_MAPS = {
  order: ORDER_STATUS,
  partialPayment: PARTIAL_PAYMENT_STATUS,
} as const

export type StatusDomain = keyof typeof STATUS_MAPS

export function getStatusBadge(domain: StatusDomain, status: string): StatusBadgeInfo {
  const map = STATUS_MAPS[domain]
  return map[status] ?? { label: status, variant: 'neutral' }
}

export function badgeClassName(variant: BadgeVariant): string {
  return variant === 'neutral' ? 'badge' : `badge badge-${variant}`
}

// Una orden "necesita tu atención" cuando tiene un anticipo reportado sin
// confirmar, o un pago final reportado que todavía no fue aprobado. Antes,
// mientras la orden seguía en `activeOrders`, un `finalPaymentDetails` no
// nulo SIEMPRE significaba "esperando aprobación" porque al aprobarlo el
// status pasaba directo a DELIVERED y la orden salía de la lista. Ahora
// aprobar el pago final deja la orden en `PAID_PENDING_DELIVERY`, que sigue
// en `activeOrders` con `finalPaymentDetails` todavía no nulo — por eso hace
// falta el flag `finalPaymentConfirmed` para distinguir "pendiente" de "ya
// aprobado, esperando entrega". Al rechazarlo, el backend limpia
// `finalPaymentDetails` a null.
export function hasPendingPayment(order: {
  advancePaymentSubmissions: { status: string }[]
  finalPaymentDetails: unknown
  finalPaymentConfirmed: boolean
}): boolean {
  const pendingAdvance = order.advancePaymentSubmissions.some((s) => s.status === 'PENDING')
  const pendingFinal = order.finalPaymentDetails != null && !order.finalPaymentConfirmed
  return pendingAdvance || pendingFinal
}

// Una orden "en cola" no tiene técnico asignado porque, al crearla, nadie
// del cargo correspondiente (mostrador o motorizado — nunca se mezclan)
// estaba libre ni con capacidad. El backend la reasigna solo apenas alguien
// de ese cargo se desocupa (ver tryAssignQueuedOrder en orders.service.ts) —
// este flag es solo para que el admin vea de un vistazo que está esperando,
// en vez de pensar que se olvidaron de asignarla.
export function isQueuedForTechnician(order: { technician: unknown; status: string }): boolean {
  return order.technician == null && order.status !== 'DELIVERED' && order.status !== 'CANCELLED'
}
