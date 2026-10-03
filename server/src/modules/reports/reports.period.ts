import { Prisma } from '@prisma/client'
import prisma from '../../lib/prisma'
import { venezuelaDayKey } from './reports.dates'
import { getOrderChannel } from './reports.service'

export interface PeriodFilters {
  from: Date
  to: Date
  technicianId?: string
  clientId?: string
  channel?: 'WEB' | 'APK'
}

export interface UsedPart {
  id: string
  createdAt: Date
  productId: string
  productName: string
  quantity: number
  amount: number
  orderId: string
  awaitingClientPayment: boolean
}

export const orderScope = ({ technicianId, clientId, channel }: Omit<PeriodFilters, 'from' | 'to'>): Prisma.OrderWhereInput => ({
  ...(technicianId ? { technicianId } : {}),
  ...(clientId ? { clientId } : {}),
  ...(channel === 'APK' ? { deliveryAmount: { not: null } } : {}),
  ...(channel === 'WEB' ? { deliveryAmount: null } : {}),
})

// Repuestos instalados y cobrables: ni revertidos (error de selección, el
// stock volvió) ni reportados como merma (no se le cobran al cliente).
export const findUsedParts = async (f: PeriodFilters): Promise<UsedPart[]> => {
  const rows = await prisma.inventoryMovement.findMany({
    where: {
      type: 'OUT', channel: 'SERVICIO_TECNICO', reversedAt: null, lossReportedAt: null,
      createdAt: { gte: f.from, lte: f.to },
      order: orderScope(f),
    },
    include: { product: { select: { name: true } } },
    orderBy: { createdAt: 'asc' },
  })
  return rows.map((m) => ({
    id: m.id,
    createdAt: m.createdAt,
    productId: m.productId,
    productName: m.product.name,
    quantity: m.quantity,
    amount: m.quantity * Number(m.unitPriceAtUse ?? 0),
    orderId: m.orderId!,
    awaitingClientPayment: m.awaitingClientPayment,
  }))
}

const round2 = (n: number) => Math.round(n * 100) / 100

export const getPeriodReport = async (f: PeriodFilters) => {
  const scope = orderScope(f)
  const range = { gte: f.from, lte: f.to }

  const [payments, received, delivered, parts] = await Promise.all([
    // Dinero cobrado = pagos confirmados por fecha de confirmación. Los pagos
    // viejos sin confirmedAt caen por createdAt.
    prisma.advancePaymentSubmission.findMany({
      where: {
        status: 'CONFIRMED',
        OR: [{ confirmedAt: range }, { confirmedAt: null, createdAt: range }],
        order: scope,
      },
      select: { amount: true, kind: true, confirmedAt: true, createdAt: true, order: { select: { deliveryAmount: true } } },
    }),
    prisma.order.findMany({ where: { ...scope, receivedAt: range }, select: { receivedAt: true } }),
    prisma.order.findMany({
      where: { ...scope, status: 'DELIVERED', deliveredAt: range },
      select: { receivedAt: true, deliveredAt: true, technicianCommission: true, technician: { select: { id: true, name: true } } },
    }),
    findUsedParts(f),
  ])

  const money = { total: 0, revision: 0, repair: 0, byChannel: { WEB: 0, APK: 0 } }
  const daily = new Map<string, { day: string; received: number; delivered: number; collected: number; partsUnits: number; partsAmount: number }>()
  const dayRow = (date: Date) => {
    const day = venezuelaDayKey(date)
    const row = daily.get(day) ?? { day, received: 0, delivered: 0, collected: 0, partsUnits: 0, partsAmount: 0 }
    daily.set(day, row)
    return row
  }

  for (const p of payments) {
    const amount = Number(p.amount)
    money.total += amount
    if (p.kind === 'REVISION') money.revision += amount
    else money.repair += amount
    money.byChannel[getOrderChannel(p.order)] += amount
    dayRow(p.confirmedAt ?? p.createdAt).collected += amount
  }
  for (const o of received) dayRow(o.receivedAt).received += 1
  for (const o of delivered) dayRow(o.deliveredAt!).delivered += 1
  for (const part of parts) {
    const row = dayRow(part.createdAt)
    row.partsUnits += part.quantity
    row.partsAmount += part.amount
  }

  const techMap = new Map<string, { technicianId: string; technicianName: string; delivered: number; commission: number; totalHours: number }>()
  for (const o of delivered) {
    if (!o.technician) continue
    const entry = techMap.get(o.technician.id) ?? { technicianId: o.technician.id, technicianName: o.technician.name, delivered: 0, commission: 0, totalHours: 0 }
    entry.delivered += 1
    entry.commission += Number(o.technicianCommission ?? 0)
    entry.totalHours += (o.deliveredAt!.getTime() - o.receivedAt.getTime()) / 3_600_000
    techMap.set(o.technician.id, entry)
  }

  return {
    money: {
      total: round2(money.total), revision: round2(money.revision), repair: round2(money.repair),
      byChannel: { WEB: round2(money.byChannel.WEB), APK: round2(money.byChannel.APK) },
    },
    activity: { received: received.length, delivered: delivered.length },
    daily: [...daily.values()]
      .map((r) => ({ ...r, collected: round2(r.collected), partsAmount: round2(r.partsAmount) }))
      .sort((a, b) => a.day.localeCompare(b.day)),
    technicians: [...techMap.values()]
      .map(({ totalHours, ...t }) => ({ ...t, commission: round2(t.commission), avgHours: t.delivered ? Math.round((totalHours / t.delivered) * 10) / 10 : null }))
      .sort((a, b) => b.delivered - a.delivered),
  }
}

export type PeriodReport = Awaited<ReturnType<typeof getPeriodReport>>
