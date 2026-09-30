import { OrderStatus } from '@prisma/client'
import prisma from '../../lib/prisma'
import { formatFullName } from '../../lib/format'
import { orderScope } from './reports.period'
import { getOrderChannel } from './reports.service'

export type PendingGroupKey = 'payment' | 'intake' | 'review' | 'repair' | 'ready' | 'pickup'

// Estado actual del taller, sin fechas: cada orden abierta cae en un solo grupo.
export const PENDING_GROUPS: { key: PendingGroupKey; label: string; statuses: OrderStatus[] }[] = [
  { key: 'payment', label: 'Pago por confirmar', statuses: ['PENDING_PAYMENT'] },
  { key: 'intake', label: 'En tienda o en camino', statuses: ['RECEIVED', 'ON_THE_WAY'] },
  { key: 'review', label: 'En revisión o esperando aprobación', statuses: ['DIAGNOSING', 'WAITING_APPROVAL'] },
  { key: 'repair', label: 'En reparación', statuses: ['APPROVED', 'REPAIRING', 'WAITING_EXTRA_PAYMENT'] },
  { key: 'ready', label: 'Listas: por cobrar o por entregar', statuses: ['READY', 'PAID_PENDING_DELIVERY'] },
  { key: 'pickup', label: 'Rechazadas: por retirar', statuses: ['REJECTED_PENDING_PICKUP'] },
]

const DEFAULT_REVISION = 15
const round2 = (n: number) => Math.round(n * 100) / 100
const sumAmount = (rows: { amount: unknown }[]) => rows.reduce((s, r) => s + Number(r.amount), 0)

export const getPendingReport = async (f: { technicianId?: string; clientId?: string; channel?: 'WEB' | 'APK' }) => {
  const orders = await prisma.order.findMany({
    where: { ...orderScope(f), status: { in: PENDING_GROUPS.flatMap((g) => g.statuses) } },
    include: {
      client: { select: { name: true, lastName: true } },
      technician: { select: { name: true } },
      advancePaymentSubmissions: { where: { status: { in: ['PENDING', 'CONFIRMED'] } } },
      inventoryMovements: { where: { awaitingClientPayment: true, reversedAt: null } },
    },
    orderBy: { receivedAt: 'asc' },
  })

  const now = Date.now()
  const rows = orders.map((o) => {
    const subs = o.advancePaymentSubmissions
    const pending = subs.filter((s) => s.status === 'PENDING')
    const confirmedBudget = sumAmount(subs.filter((s) => s.status === 'CONFIRMED' && s.kind === 'BUDGET'))
    const finalBalance = Math.max(0, Number(o.budget ?? 0) - Number(o.revisionAmount ?? DEFAULT_REVISION) - confirmedBudget)
    const finalReported = o.status === 'READY' && o.finalPaymentDetails != null && !o.finalPaymentConfirmed

    // Un abono de presupuesto pendiente ya está dentro de "por confirmar": no se cobra otra vez.
    const pendingBudget = sumAmount(pending.filter((s) => s.kind === 'BUDGET'))
    const finalOutstanding = Math.max(0, finalBalance - pendingBudget)

    let pendingConfirmation = sumAmount(pending)
    let balanceDue = 0
    if (finalReported) pendingConfirmation += finalOutstanding
    if (o.status === 'PENDING_PAYMENT') {
      const advanceTotal = Number(o.revisionAmount ?? DEFAULT_REVISION) + Number(o.deliveryAmount ?? 0)
      balanceDue = Math.max(0, advanceTotal - sumAmount(subs.filter((s) => s.kind === 'REVISION')))
    } else if (o.status === 'WAITING_EXTRA_PAYMENT') {
      const extra = o.inventoryMovements.reduce((s, m) => s + m.quantity * Number(m.unitPriceAtUse ?? 0), 0)
      balanceDue = Math.max(0, extra - sumAmount(pending.filter((s) => s.kind === 'BUDGET')))
    } else if (o.status === 'READY' && !finalReported) {
      balanceDue = finalOutstanding
    }

    return {
      orderId: o.id,
      orderNumber: o.orderNumber,
      status: o.status,
      clientName: formatFullName(o.client.name, o.client.lastName),
      technicianName: o.technician?.name ?? 'Sin asignar',
      channel: getOrderChannel(o),
      receivedAt: o.receivedAt,
      daysOpen: Math.floor((now - o.receivedAt.getTime()) / 86_400_000),
      pendingConfirmation: round2(pendingConfirmation),
      balanceDue: round2(balanceDue),
    }
  })

  const confirmRows = rows.filter((r) => r.pendingConfirmation > 0.009)
  const dueRows = rows.filter((r) => r.balanceDue > 0.009)
  const confirmAmount = round2(confirmRows.reduce((s, r) => s + r.pendingConfirmation, 0))
  const openRows = rows.filter((r) => r.pendingConfirmation > 0.009 || r.balanceDue > 0.009)
  const dueAmount = round2(dueRows.reduce((s, r) => s + r.balanceDue, 0))

  return {
    groups: PENDING_GROUPS.map((g) => {
      const groupRows = rows.filter((r) => (g.statuses as string[]).includes(r.status))
      return { key: g.key, label: g.label, count: groupRows.length, orders: groupRows }
    }),
    toCollect: {
      orders: openRows.length,
      pendingConfirmation: { count: confirmRows.length, amount: confirmAmount },
      balanceDue: { count: dueRows.length, amount: dueAmount },
      total: round2(confirmAmount + dueAmount),
    },
  }
}

export type PendingReport = Awaited<ReturnType<typeof getPendingReport>>
export interface PendingOrderRow {
  orderId: string
  orderNumber: string
  status: string
  clientName: string
  technicianName: string
  channel: 'WEB' | 'APK'
  receivedAt: Date
  daysOpen: number
  pendingConfirmation: number
  balanceDue: number
}
