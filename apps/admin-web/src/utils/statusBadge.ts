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

const PRODUCT_ORDER_STATUS: Record<string, StatusBadgeInfo> = {
  PENDING: { label: 'Pendiente', variant: 'neutral' },
  CONFIRMED: { label: 'Confirmado', variant: 'progress' },
  REJECTED: { label: 'Rechazado', variant: 'danger' },
  READY_FOR_PICKUP: { label: 'Listo para retiro', variant: 'success' },
  ASSIGNED_DELIVERY: { label: 'Asignado a motorizado', variant: 'progress' },
  ON_THE_WAY: { label: 'En camino', variant: 'progress' },
  DELIVERED: { label: 'Entregado', variant: 'success' },
  CANCELLED: { label: 'Cancelado', variant: 'danger' },
}

const DELIVERY_STATUS: Record<string, StatusBadgeInfo> = {
  ASSIGNED: { label: 'Asignado', variant: 'neutral' },
  LEAVING_STORE: { label: 'Saliendo de la tienda', variant: 'progress' },
  ON_THE_WAY: { label: 'En camino', variant: 'progress' },
  AT_LOCATION: { label: 'En el lugar', variant: 'progress' },
  DIAGNOSING_ON_SITE: { label: 'Diagnosticando en sitio', variant: 'progress' },
  EQUIPMENT_PICKED_UP: { label: 'Equipo recogido', variant: 'progress' },
  AT_THE_SHOP: { label: 'En el taller', variant: 'progress' },
  RETURNING: { label: 'Regresando', variant: 'progress' },
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
  productOrder: PRODUCT_ORDER_STATUS,
  delivery: DELIVERY_STATUS,
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
