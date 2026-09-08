export type BadgeVariant = 'success' | 'danger' | 'progress' | 'neutral'

interface StatusBadgeInfo {
  label: string
  variant: BadgeVariant
}

const ORDER_STATUS: Record<string, StatusBadgeInfo> = {
  PENDING_PAYMENT: { label: 'Pago pendiente', variant: 'neutral' },
  RECEIVED: { label: 'Recibido', variant: 'neutral' },
  DIAGNOSING: { label: 'En diagnóstico', variant: 'progress' },
  WAITING_APPROVAL: { label: 'Esperando aprobación', variant: 'progress' },
  APPROVED: { label: 'Aprobado', variant: 'progress' },
  REPAIRING: { label: 'En reparación', variant: 'progress' },
  WAITING_PART: { label: 'Esperando repuesto', variant: 'progress' },
  READY: { label: 'Listo para entrega', variant: 'success' },
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
