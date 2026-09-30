import prisma from '../lib/prisma'
import { getPendingReport } from '../modules/reports/reports.pending'

describe('reports.pending — getPendingReport', () => {
  it('agrupa órdenes abiertas y calcula lo que falta confirmar y cobrar', async () => {
    const suffix = Date.now()
    const tech = await prisma.user.create({
      data: { name: `Tec Pend ${suffix}`, email: `tec-pend-${suffix}@test.com`, password: 'x', role: 'TECHNICIAN' },
    })
    const client = await prisma.client.create({
      data: { name: 'Cliente', lastName: 'Pend', idNumber: `TEST-PEND-${suffix}`, phone: '0000000012' },
    })
    const dev = await prisma.device.create({ data: { type: 'LAPTOP', brand: 'Dell', model: 'XPS' } })
    const base = { problem: 'p', clientId: client.id, deviceId: dev.id, technicianId: tech.id, revisionAmount: 15 }
    const paying = await prisma.order.create({ data: { ...base, orderNumber: `REP-PEND-${suffix}-1`, status: 'PENDING_PAYMENT' } })
    const ready = await prisma.order.create({ data: { ...base, orderNumber: `REP-PEND-${suffix}-2`, status: 'READY', budget: 75 } })
    const done = await prisma.order.create({ data: { ...base, orderNumber: `REP-PEND-${suffix}-3`, status: 'DELIVERED', budget: 40 } })
    const subs = await Promise.all([
      prisma.advancePaymentSubmission.create({ data: { orderId: paying.id, amount: 10, kind: 'REVISION', status: 'PENDING', paymentDetails: {} } }),
      prisma.advancePaymentSubmission.create({ data: { orderId: ready.id, amount: 20, kind: 'BUDGET', status: 'CONFIRMED', confirmedAt: new Date(), paymentDetails: {} } }),
    ])

    try {
      const r = await getPendingReport({ technicianId: tech.id })
      const byKey = Object.fromEntries(r.groups.map((g: any) => [g.key, g]))

      expect(r.groups.map((g: any) => g.key)).toEqual(['payment', 'intake', 'review', 'repair', 'ready', 'pickup'])
      expect(byKey.payment.count).toBe(1)
      expect(byKey.payment.orders[0]).toMatchObject({ orderNumber: paying.orderNumber, pendingConfirmation: 10, balanceDue: 5 })
      expect(byKey.ready.orders[0]).toMatchObject({ orderNumber: ready.orderNumber, pendingConfirmation: 0, balanceDue: 40 })
      expect(r.groups.flatMap((g: any) => g.orders).some((o: any) => o.orderId === done.id)).toBe(false)
      expect(r.toCollect).toEqual({
        orders: 2,
        pendingConfirmation: { count: 1, amount: 10 },
        balanceDue: { count: 2, amount: 45 },
        total: 55,
      })

      // Si el cliente ya reportó el pago final, pasa a "por confirmar".
      await prisma.order.update({ where: { id: ready.id }, data: { finalPaymentDetails: { referencia: '1' } } })
      const after = await getPendingReport({ technicianId: tech.id })
      const readyRow = after.groups.find((g: any) => g.key === 'ready')!.orders[0]
      expect(readyRow).toMatchObject({ pendingConfirmation: 40, balanceDue: 0 })

      // Filtro de cliente: otro cliente no ve estas órdenes.
      const mine = await getPendingReport({ technicianId: tech.id, clientId: client.id })
      expect(mine.groups.flatMap((g: any) => g.orders)).toHaveLength(2)
      const other = await getPendingReport({ technicianId: tech.id, clientId: 'no-existe' })
      expect(other.groups.flatMap((g: any) => g.orders)).toHaveLength(0)
    } finally {
      await prisma.advancePaymentSubmission.deleteMany({ where: { id: { in: subs.map((s) => s.id) } } }).catch(() => {})
      await prisma.order.deleteMany({ where: { id: { in: [paying.id, ready.id, done.id] } } }).catch(() => {})
      await prisma.device.delete({ where: { id: dev.id } }).catch(() => {})
      await prisma.client.delete({ where: { id: client.id } }).catch(() => {})
      await prisma.user.delete({ where: { id: tech.id } }).catch(() => {})
    }
  }, 20000)

  it('un abono de presupuesto pendiente en una orden lista no se cuenta dos veces', async () => {
    const suffix = Date.now()
    const tech = await prisma.user.create({
      data: { name: `Tec Pend2 ${suffix}`, email: `tec-pend2-${suffix}@test.com`, password: 'x', role: 'TECHNICIAN' },
    })
    const client = await prisma.client.create({
      data: { name: 'Cliente', lastName: 'Pend2', idNumber: `TEST-PEND2-${suffix}`, phone: '0000000013' },
    })
    const dev = await prisma.device.create({ data: { type: 'LAPTOP', brand: 'Dell', model: 'XPS' } })
    const order = await prisma.order.create({
      data: { problem: 'p', clientId: client.id, deviceId: dev.id, technicianId: tech.id, revisionAmount: 15, orderNumber: `REP-PEND2-${suffix}`, status: 'READY', budget: 75 },
    })
    const subs = await Promise.all([
      prisma.advancePaymentSubmission.create({ data: { orderId: order.id, amount: 20, kind: 'BUDGET', status: 'CONFIRMED', confirmedAt: new Date(), paymentDetails: {} } }),
      prisma.advancePaymentSubmission.create({ data: { orderId: order.id, amount: 10, kind: 'BUDGET', status: 'PENDING', paymentDetails: {} } }),
    ])

    try {
      const r = await getPendingReport({ technicianId: tech.id })
      const row = r.groups.find((g: any) => g.key === 'ready')!.orders[0]
      expect(row).toMatchObject({ pendingConfirmation: 10, balanceDue: 30 })

      await prisma.order.update({ where: { id: order.id }, data: { finalPaymentDetails: { referencia: '1' } } })
      const after = await getPendingReport({ technicianId: tech.id })
      const rowAfter = after.groups.find((g: any) => g.key === 'ready')!.orders[0]
      expect(rowAfter).toMatchObject({ pendingConfirmation: 40, balanceDue: 0 })
    } finally {
      await prisma.advancePaymentSubmission.deleteMany({ where: { id: { in: subs.map((s) => s.id) } } }).catch(() => {})
      await prisma.order.deleteMany({ where: { id: order.id } }).catch(() => {})
      await prisma.device.delete({ where: { id: dev.id } }).catch(() => {})
      await prisma.client.delete({ where: { id: client.id } }).catch(() => {})
      await prisma.user.delete({ where: { id: tech.id } }).catch(() => {})
    }
  }, 20000)
})
