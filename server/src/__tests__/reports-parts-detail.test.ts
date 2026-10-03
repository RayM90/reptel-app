import prisma from '../lib/prisma'
import { getPartsDetail } from '../modules/reports/reports.parts'

const FROM = new Date('2026-04-01T04:00:00.000Z')
const TO = new Date('2026-05-01T03:59:59.999Z')

describe('reports.parts — getPartsDetail', () => {
  it('lista cada uso de repuesto con orden, técnico, cliente y estado', async () => {
    const suffix = Date.now()
    const tech = await prisma.user.create({
      data: { name: `Tec Detalle ${suffix}`, email: `tec-detalle-${suffix}@test.com`, password: 'x', role: 'TECHNICIAN' },
    })
    const client = await prisma.client.create({
      data: { name: 'Cliente', lastName: 'Detalle', idNumber: `TEST-DET-${suffix}`, phone: '0000000012' },
    })
    const dev = await prisma.device.create({ data: { type: 'LAPTOP', brand: 'Moto', model: 'D' } })
    let cat = await prisma.productCategory.findFirst()
    if (!cat) cat = await prisma.productCategory.create({ data: { name: `Test Cat Det ${suffix}` } })
    const ram = await prisma.product.create({ data: { name: `RAM D ${suffix}`, price: 30, stock: 10, categoryId: cat.id } })
    const order = await prisma.order.create({
      data: {
        orderNumber: `REP-DET-${suffix}`, status: 'REPAIRING', problem: 'p', clientId: client.id,
        deviceId: dev.id, technicianId: tech.id, receivedAt: new Date('2026-04-05T15:00:00Z'),
      },
    })
    const at = new Date('2026-04-06T15:00:00Z')
    const base = { productId: ram.id, type: 'OUT' as const, channel: 'SERVICIO_TECNICO' as const, reason: 't', orderId: order.id, unitPriceAtUse: 25, createdAt: at }
    const movements = await Promise.all([
      prisma.inventoryMovement.create({ data: { ...base, quantity: 2 } }),
      prisma.inventoryMovement.create({ data: { ...base, quantity: 1, reversedAt: at } }),
      prisma.inventoryMovement.create({ data: { ...base, quantity: 1, lossReportedAt: at, lossDescription: 'se dañó', lossReportedByUserId: tech.id } }),
    ])

    try {
      const r = await getPartsDetail({ from: FROM, to: TO, technicianId: tech.id })
      expect(r.rows).toHaveLength(3)
      const byStatus = Object.fromEntries(r.rows.map((x) => [x.status, x]))
      expect(byStatus.USED).toMatchObject({
        day: '2026-04-06', productName: ram.name, quantity: 2, unitPrice: 25, amount: 50,
        orderNumber: order.orderNumber, technicianName: tech.name, clientName: 'Cliente Detalle',
      })
      expect(byStatus.RETURNED.quantity).toBe(1)
      expect(byStatus.LOSS.amount).toBe(25)
      expect(r.totals).toEqual({ usedUnits: 2, usedAmount: 50, lossUnits: 1, lossAmount: 25, returnedUnits: 1 })

      // Fuera del rango no aparece.
      const none = await getPartsDetail({ from: new Date('2026-06-01T04:00:00Z'), to: new Date('2026-06-30T03:59:59Z'), technicianId: tech.id })
      expect(none.rows).toHaveLength(0)
    } finally {
      await prisma.inventoryMovement.deleteMany({ where: { id: { in: movements.map((m) => m.id) } } }).catch(() => {})
      await prisma.order.delete({ where: { id: order.id } }).catch(() => {})
      await prisma.product.delete({ where: { id: ram.id } }).catch(() => {})
      if (cat.name.startsWith('Test Cat Det')) await prisma.productCategory.delete({ where: { id: cat.id } }).catch(() => {})
      await prisma.device.delete({ where: { id: dev.id } }).catch(() => {})
      await prisma.client.delete({ where: { id: client.id } }).catch(() => {})
      await prisma.user.delete({ where: { id: tech.id } }).catch(() => {})
    }
  }, 20000)
})
