import prisma from '../lib/prisma'
import { getPeriodReport } from '../modules/reports/reports.period'

const FROM = new Date('2026-05-01T04:00:00.000Z') // 1 may 00:00 VET
const TO = new Date('2026-06-01T03:59:59.999Z')   // 31 may 23:59 VET

describe('reports.period — getPeriodReport', () => {
  it('cuenta dinero cobrado por pagos confirmados, actividad, días y técnicos', async () => {
    const suffix = Date.now()
    const tech = await prisma.user.create({
      data: { name: `Tec Periodo ${suffix}`, email: `tec-periodo-${suffix}@test.com`, password: 'x', role: 'TECHNICIAN' },
    })
    const client = await prisma.client.create({
      data: { name: 'Cliente', lastName: 'Periodo', idNumber: `TEST-PER-${suffix}`, phone: '0000000010' },
    })
    const dev = await prisma.device.create({ data: { type: 'LAPTOP', brand: 'Dell', model: 'XPS' } })
    let cat = await prisma.productCategory.findFirst()
    if (!cat) {
      cat = await prisma.productCategory.create({ data: { name: `Test Cat ${suffix}` } })
    }
    const product = await prisma.product.create({ data: { name: `Pantalla ${suffix}`, price: 40, stock: 5, categoryId: cat.id } })

    // Orden de mostrador: entra el 10 may (11:00 VET), se entrega el 12 may.
    const counter = await prisma.order.create({
      data: {
        orderNumber: `REP-PER-${suffix}-1`, status: 'DELIVERED', problem: 'p', budget: 55, revisionAmount: 15,
        technicianCommission: 16, clientId: client.id, deviceId: dev.id, technicianId: tech.id,
        receivedAt: new Date('2026-05-10T15:00:00Z'), deliveredAt: new Date('2026-05-12T15:00:00Z'),
      },
    })
    // Orden de la app, rechazada: solo pagó revisión + delivery ($25), cancelada.
    const app = await prisma.order.create({
      data: {
        orderNumber: `REP-PER-${suffix}-2`, status: 'CANCELLED', problem: 'p', budget: 90, revisionAmount: 15,
        deliveryAmount: 10, budgetRejectionReason: 'caro', clientId: client.id, deviceId: dev.id, technicianId: tech.id,
        receivedAt: new Date('2026-05-10T20:00:00Z'),
      },
    })
    const subs = await Promise.all([
      prisma.advancePaymentSubmission.create({ data: { orderId: counter.id, amount: 15, kind: 'REVISION', status: 'CONFIRMED', confirmedAt: new Date('2026-05-10T15:30:00Z'), paymentDetails: {} } }),
      prisma.advancePaymentSubmission.create({ data: { orderId: counter.id, amount: 40, kind: 'BUDGET', status: 'CONFIRMED', confirmedAt: new Date('2026-05-12T14:00:00Z'), paymentDetails: {} } }),
      prisma.advancePaymentSubmission.create({ data: { orderId: app.id, amount: 25, kind: 'REVISION', status: 'CONFIRMED', confirmedAt: new Date('2026-05-11T02:00:00Z'), paymentDetails: {} } }),
      // Pendiente: no es dinero cobrado.
      prisma.advancePaymentSubmission.create({ data: { orderId: app.id, amount: 99, kind: 'BUDGET', status: 'PENDING', paymentDetails: {} } }),
    ])
    const part = await prisma.inventoryMovement.create({
      data: { productId: product.id, type: 'OUT', channel: 'SERVICIO_TECNICO', quantity: 1, reason: 'test', orderId: counter.id, unitPriceAtUse: 40, createdAt: new Date('2026-05-11T15:00:00Z') },
    })

    try {
      const r = await getPeriodReport({ from: FROM, to: TO, technicianId: tech.id })

      expect(r.money).toEqual({ total: 80, revision: 40, repair: 40, byChannel: { WEB: 55, APK: 25 } })
      expect(r.activity).toEqual({ received: 2, delivered: 1 })
      // El pago de $25 se confirmó el 11 may 02:00 UTC = 10 may 22:00 VET.
      expect(r.daily).toEqual([
        { day: '2026-05-10', received: 2, delivered: 0, collected: 40, partsUnits: 0, partsAmount: 0 },
        { day: '2026-05-11', received: 0, delivered: 0, collected: 0, partsUnits: 1, partsAmount: 40 },
        { day: '2026-05-12', received: 0, delivered: 1, collected: 40, partsUnits: 0, partsAmount: 0 },
      ])
      expect(r.technicians).toEqual([
        { technicianId: tech.id, technicianName: tech.name, delivered: 1, commission: 16, avgHours: 48 },
      ])

      const onlyApp = await getPeriodReport({ from: FROM, to: TO, technicianId: tech.id, channel: 'APK' })
      expect(onlyApp.money.total).toBe(25)
    } finally {
      await prisma.inventoryMovement.delete({ where: { id: part.id } }).catch(() => {})
      await prisma.advancePaymentSubmission.deleteMany({ where: { id: { in: subs.map((s) => s.id) } } }).catch(() => {})
      await prisma.order.deleteMany({ where: { id: { in: [counter.id, app.id] } } }).catch(() => {})
      await prisma.product.delete({ where: { id: product.id } }).catch(() => {})
      if (cat.name.startsWith('Test Cat')) await prisma.productCategory.delete({ where: { id: cat.id } }).catch(() => {})
      await prisma.device.delete({ where: { id: dev.id } }).catch(() => {})
      await prisma.client.delete({ where: { id: client.id } }).catch(() => {})
      await prisma.user.delete({ where: { id: tech.id } }).catch(() => {})
    }
  }, 20000)
})
