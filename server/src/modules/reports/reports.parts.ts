import prisma from '../../lib/prisma'
import { venezuelaDayKey } from './reports.dates'
import { PeriodFilters, orderScope, findUsedParts } from './reports.period'

// Motivos fijos del formulario de ajuste de stock (InventoryForm.tsx).
export const STOCK_REASON_DAMAGED = 'Producto dañado al recibir'
export const STOCK_REASON_SALE = 'Venta en tienda'

const round2 = (n: number) => Math.round(n * 100) / 100

export const getPartsReport = async (f: PeriodFilters) => {
  const range = { gte: f.from, lte: f.to }
  const hasOrderFilter = Boolean(f.technicianId || f.clientId || f.channel)

  const [used, losses, manual] = await Promise.all([
    findUsedParts(f),
    prisma.inventoryMovement.findMany({
      where: { channel: 'SERVICIO_TECNICO', lossReportedAt: range, order: orderScope(f) },
      include: {
        product: { select: { name: true } },
        order: { select: { orderNumber: true, technician: { select: { name: true } } } },
      },
      orderBy: { lossReportedAt: 'asc' },
    }),
    // Ajustes manuales: son de la tienda, sin orden ni técnico — no se pueden
    // filtrar por técnico/cliente/canal, así que con esos filtros no aplican.
    hasOrderFilter
      ? Promise.resolve(null)
      : prisma.inventoryMovement.findMany({
          where: { type: 'OUT', channel: 'AJUSTE_MANUAL', createdAt: range },
          include: { product: { select: { price: true } } },
        }),
  ])

  const byProduct = new Map<string, { productId: string; productName: string; units: number; amount: number; orderIds: Set<string> }>()
  for (const p of used) {
    const entry = byProduct.get(p.productId) ?? { productId: p.productId, productName: p.productName, units: 0, amount: 0, orderIds: new Set<string>() }
    entry.units += p.quantity
    entry.amount += p.amount
    entry.orderIds.add(p.orderId)
    byProduct.set(p.productId, entry)
  }

  const lossItems = losses.map((m) => ({
    movementId: m.id,
    day: venezuelaDayKey(m.lossReportedAt!),
    productName: m.product.name,
    quantity: m.quantity,
    amount: round2(m.quantity * Number(m.unitPriceAtUse ?? 0)),
    orderNumber: m.order?.orderNumber ?? '—',
    technicianName: m.order?.technician?.name ?? 'Sin asignar',
    description: m.lossDescription ?? '',
  }))

  let store = null
  if (manual) {
    const sum = (reason: string | null) => {
      const rows = manual.filter((m) => (reason === null ? m.reason !== STOCK_REASON_DAMAGED && m.reason !== STOCK_REASON_SALE : m.reason === reason))
      return {
        units: rows.reduce((s, m) => s + m.quantity, 0),
        amount: round2(rows.reduce((s, m) => s + m.quantity * Number(m.unitPriceAtUse ?? m.product.price), 0)),
      }
    }
    const damaged = sum(STOCK_REASON_DAMAGED)
    const sales = sum(STOCK_REASON_SALE)
    store = {
      damagedOnArrival: damaged,
      sales: { units: sales.units, estimatedAmount: sales.amount },
      otherAdjustments: { units: sum(null).units },
    }
  }

  return {
    used: {
      units: used.reduce((s, p) => s + p.quantity, 0),
      amount: round2(used.reduce((s, p) => s + p.amount, 0)),
      awaitingPaymentAmount: round2(used.filter((p) => p.awaitingClientPayment).reduce((s, p) => s + p.amount, 0)),
      byProduct: [...byProduct.values()]
        .map(({ orderIds, ...e }) => ({ ...e, amount: round2(e.amount), orders: orderIds.size }))
        .sort((a, b) => b.units - a.units),
    },
    technicianLosses: {
      units: lossItems.reduce((s, m) => s + m.quantity, 0),
      amount: round2(lossItems.reduce((s, m) => s + m.amount, 0)),
      items: lossItems,
    },
    store,
  }
}

export type PartsReport = Awaited<ReturnType<typeof getPartsReport>>
