import prisma from '../lib/prisma'
import { getPartsReport } from '../modules/reports/reports.parts'

const FROM = new Date('2026-04-01T04:00:00.000Z')
const TO = new Date('2026-05-01T03:59:59.999Z')

describe('reports.parts — getPartsReport', () => {
  it('separa repuestos usados, mermas de técnico, dañados al recibir y ventas en tienda', async () => {
    const suffix = Date.now()
    const tech = await prisma.user.create({
      data: { name: `Tec Partes ${suffix}`, email: `tec-partes-${suffix}@test.com`, password: 'x', role: 'TECHNICIAN' },
    })
    const client = await prisma.client.create({
      data: { name: 'Cliente', lastName: 'Partes', idNumber: `TEST-PARTS-${suffix}`, phone: '0000000011' },
    })
    const dev = await prisma.device.create({ data: { type: 'LAPTOP', brand: 'Moto', model: 'E' } })
    let cat = await prisma.productCategory.findFirst()
    if (!cat) {
      cat = await prisma.productCategory.create({ data: { name: `Test Cat Parts ${suffix}` } })
    }
    const screen = await prisma.product.create({ data: { name: `Pantalla P ${suffix}`, price: 50, stock: 10, categoryId: cat.id } })
    const order = await prisma.order.create({
      data: {
        orderNumber: `REP-PARTS-${suffix}`, status: 'REPAIRING', problem: 'p', clientId: client.id,
        deviceId: dev.id, technicianId: tech.id, receivedAt: new Date('2026-04-05T15:00:00Z'),
      },
    })
    const at = new Date('2026-04-06T15:00:00Z')
    const movements = await Promise.all([
      prisma.inventoryMovement.create({ data: { productId: screen.id, type: 'OUT', channel: 'SERVICIO_TECNICO', quantity: 2, reason: 't', orderId: order.id, unitPriceAtUse: 45, createdAt: at } }),
      prisma.inventoryMovement.create({ data: { productId: screen.id, type: 'OUT', channel: 'SERVICIO_TECNICO', quantity: 1, reason: 't', orderId: order.id, unitPriceAtUse: 45, createdAt: at, awaitingClientPayment: true } }),
      prisma.inventoryMovement.create({ data: { productId: screen.id, type: 'OUT', channel: 'SERVICIO_TECNICO', quantity: 1, reason: 't', orderId: order.id, unitPriceAtUse: 45, createdAt: at, lossReportedAt: at, lossDescription: 'se partió', lossReportedByUserId: tech.id } }),
      prisma.inventoryMovement.create({ data: { productId: screen.id, type: 'OUT', channel: 'SERVICIO_TECNICO', quantity: 1, reason: 't', orderId: order.id, unitPriceAtUse: 45, createdAt: at, reversedAt: at } }),
      prisma.inventoryMovement.create({ data: { productId: screen.id, type: 'OUT', channel: 'AJUSTE_MANUAL', quantity: 3, reason: 'Venta en tienda', createdAt: at } }),
      prisma.inventoryMovement.create({ data: { productId: screen.id, type: 'OUT', channel: 'AJUSTE_MANUAL', quantity: 1, reason: 'Producto dañado al recibir', createdAt: at } }),
      prisma.inventoryMovement.create({ data: { productId: screen.id, type: 'OUT', channel: 'AJUSTE_MANUAL', quantity: 2, reason: 'Corrección de conteo', createdAt: at } }),
    ])

    try {
      const r = await getPartsReport({ from: FROM, to: TO, technicianId: tech.id })
      expect(r.used.units).toBe(3)
      expect(r.used.amount).toBe(135)
      expect(r.used.awaitingPaymentAmount).toBe(45)
      expect(r.used.byProduct).toEqual([{ productId: screen.id, productName: screen.name, units: 3, amount: 135, orders: 1 }])
      expect(r.technicianLosses.units).toBe(1)
      expect(r.technicianLosses.amount).toBe(45)
      expect(r.technicianLosses.items[0]).toMatchObject({ day: '2026-04-06', orderNumber: order.orderNumber, technicianName: tech.name, description: 'se partió' })
      // Con filtro de técnico, los movimientos de tienda no aplican.
      expect(r.store).toBeNull()

      // Sin filtros: los movimientos de tienda aparecen (pueden existir otros
      // de la BD compartida en el rango, por eso se compara con >=).
      const all = await getPartsReport({ from: FROM, to: TO })
      expect(all.store!.sales.units).toBeGreaterThanOrEqual(3)
      expect(all.store!.sales.estimatedAmount).toBeGreaterThanOrEqual(150)
      expect(all.store!.damagedOnArrival.units).toBeGreaterThanOrEqual(1)
      expect(all.store!.otherAdjustments.units).toBeGreaterThanOrEqual(2)
    } finally {
      await prisma.inventoryMovement.deleteMany({ where: { id: { in: movements.map((m) => m.id) } } }).catch(() => {})
      await prisma.order.delete({ where: { id: order.id } }).catch(() => {})
      await prisma.product.delete({ where: { id: screen.id } }).catch(() => {})
      if (cat.name.startsWith('Test Cat Parts')) await prisma.productCategory.delete({ where: { id: cat.id } }).catch(() => {})
      await prisma.device.delete({ where: { id: dev.id } }).catch(() => {})
      await prisma.client.delete({ where: { id: client.id } }).catch(() => {})
      await prisma.user.delete({ where: { id: tech.id } }).catch(() => {})
    }
  }, 20000)
})
