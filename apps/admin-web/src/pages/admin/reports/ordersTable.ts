// Grupos de estado de la tabla de órdenes de Reportes. Son los mismos 13
// estados reales, agrupados para las tarjetas y el filtro.
export type GroupKey = 'pagar' | 'revision' | 'reparacion' | 'listas' | 'rechazadas'

export const STATUS_GROUPS: { key: GroupKey; label: string; statuses: string[] }[] = [
  { key: 'pagar', label: 'Por pagar o recibir', statuses: ['PENDING_PAYMENT', 'RECEIVED', 'ON_THE_WAY'] },
  { key: 'revision', label: 'En revisión', statuses: ['DIAGNOSING', 'WAITING_APPROVAL'] },
  { key: 'reparacion', label: 'En reparación', statuses: ['APPROVED', 'REPAIRING', 'WAITING_EXTRA_PAYMENT'] },
  { key: 'listas', label: 'Listas y entregas', statuses: ['READY', 'PAID_PENDING_DELIVERY', 'DELIVERED'] },
  { key: 'rechazadas', label: 'Rechazadas o canceladas', statuses: ['REJECTED_PENDING_PICKUP', 'CANCELLED'] },
]

export const isGroupKey = (v: string): v is GroupKey => STATUS_GROUPS.some((g) => g.key === v)

export function groupOf(status: string): GroupKey | null {
  return STATUS_GROUPS.find((g) => g.statuses.includes(status))?.key ?? null
}

export function countByGroup(rows: { status: string }[]): Record<GroupKey, number> {
  const counts: Record<GroupKey, number> = { pagar: 0, revision: 0, reparacion: 0, listas: 0, rechazadas: 0 }
  for (const r of rows) {
    const g = groupOf(r.status)
    if (g) counts[g]++
  }
  return counts
}

// Busca por N° de orden o cédula/RIF, sin distinguir mayúsculas ni guiones.
const normalize = (s: string) => s.toLowerCase().replace(/[\s.-]/g, '')
export function matchesSearch(row: { orderNumber: string; clientIdNumber: string }, q: string): boolean {
  const needle = normalize(q)
  if (!needle) return true
  return normalize(row.orderNumber).includes(needle) || normalize(row.clientIdNumber ?? '').includes(needle)
}

// Tiempo desde que entró hasta que se entregó. Sin entregar → "—".
export function resolutionLabel(receivedAt: string, deliveredAt: string | null): string {
  if (!deliveredAt) return '—'
  const hours = (new Date(deliveredAt).getTime() - new Date(receivedAt).getTime()) / 3_600_000
  if (hours < 0) return '—'
  if (hours < 24) return `${Math.max(1, Math.round(hours))} h`
  const days = Math.round(hours / 24)
  return `${days} ${days === 1 ? 'día' : 'días'}`
}
