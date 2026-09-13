import prisma from '../lib/prisma'
import { addBudgetAdjustment, finishRepair } from '../modules/orders/orders.service'

let client: { id: string }
let clientUser: { id: string; email: string }
let device: { id: string }
let adminEmail: string
let technician: { id: string; email: string }
let otherTechnician: { id: string; email: string }

const makeOrder = async (
  overrides: Partial<{
    status: string
    budget: number
    revisionAmount: number
    deliveryAmount: number
    technicianId: string | null
    finalPaymentConfirmed: boolean
    finalPaymentConfirmedAt: Date
    technicianCommission: number
  }> = {}
) => {
  return prisma.order.create({
    data: {
      orderNumber: `REP-TEST-FR-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      status: (overrides.status ?? 'REPAIRING') as any,
      problem: 'Formateo + respaldo — test finalizar reparación',
      budget: overrides.budget ?? 30,
      revisionAmount: overrides.revisionAmount ?? 15,
      deliveryAmount: overrides.deliveryAmount ?? 10,
      technicianId: overrides.technicianId === undefined ? technician.id : overrides.technicianId,
      finalPaymentConfirmed: overrides.finalPaymentConfirmed ?? false,
      finalPaymentConfirmedAt: overrides.finalPaymentConfirmedAt ?? null,
      technicianCommission: overrides.technicianCommission ?? null,
      clientId: client.id,
      deviceId: device.id,
    },
  })
}

beforeAll(async () => {
  const suffix = Date.now()
  client = await prisma.client.create({
    data: { name: 'Cliente', lastName: 'Finalizar Reparación', idNumber: `TEST-FR-${suffix}`, phone: '0000000005' },
  })
  clientUser = await prisma.user.create({
    data: { name: 'Cliente', lastName: 'Finalizar Reparación', email: `cliente-fr-${suffix}@test.com`, password: 'x', role: 'CLIENT', clientId: client.id },
  })
  device = await prisma.device.create({ data: { type: 'LAPTOP', brand: 'HP', model: 'Pavilion' } })

  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' }, select: { email: true } })
  adminEmail = admin!.email

  technician = await prisma.user.create({
    data: {
      name: 'Técnico',
      lastName: 'Asignado FR',
      email: `tecnico-fr-${suffix}@test.com`,
      password: 'x',
      role: 'TECHNICIAN',
      technicianStatus: 'BUSY',
      activeOrderCount: 1,
    },
  })
  otherTechnician = await prisma.user.create({
    data: {
      name: 'Técnico',
      lastName: 'Otro FR',
      email: `tecnico-otro-fr-${suffix}@test.com`,
      password: 'x',
      role: 'TECHNICIAN',
      technicianStatus: 'AVAILABLE',
      activeOrderCount: 0,
    },
  })
}, 20000)

afterAll(async () => {
  await prisma.advancePaymentSubmission.deleteMany({ where: { order: { clientId: client.id } } })
  await prisma.orderStatusHistory.deleteMany({ where: { order: { clientId: client.id } } })
  await prisma.order.deleteMany({ where: { clientId: client.id } })
  await prisma.device.delete({ where: { id: device.id } }).catch(() => {})
  await prisma.user.delete({ where: { id: clientUser.id } }).catch(() => {})
  await prisma.user.delete({ where: { id: technician.id } }).catch(() => {})
  await prisma.user.delete({ where: { id: otherTechnician.id } }).catch(() => {})
  await prisma.client.delete({ where: { id: client.id } }).catch(() => {})
})

describe('orders.service — finishRepair', () => {
  it('con saldo pendiente, queda en READY y finalPaymentConfirmed sigue false', async () => {
    const order = await makeOrder({ budget: 30, revisionAmount: 15 })
    const updated = await finishRepair(order.id, technician.id)
    expect(updated.status).toBe('READY')
    expect(updated.finalPaymentConfirmed).toBe(false)
  })

  it('con el 100% ya pagado, salta a PAID_PENDING_DELIVERY con comisión correcta', async () => {
    // revisionAmount 20 (a propósito distinto de ADVANCE_REVISION_AMOUNT=15): si el código
    // confundiera el fallback de comisión con la constante hardcodeada en vez del valor real
    // de la orden, la comisión esperada acá (16) no coincidiría con la que daría ese bug (18).
    // budget 35, revisionAmount 20 -> base 15. Un abono BUDGET CONFIRMED de 15 cubre toda la base.
    const order = await makeOrder({ budget: 35, revisionAmount: 20, deliveryAmount: 10 })
    await prisma.advancePaymentSubmission.create({
      data: {
        orderId: order.id,
        amount: 15,
        paymentDetails: { banco: 'Bancaribe' },
        status: 'CONFIRMED',
        kind: 'BUDGET',
        confirmedAt: new Date(),
      },
    })

    const updated = await finishRepair(order.id, technician.id, 'Listo, probado')

    expect(updated.status).toBe('PAID_PENDING_DELIVERY')
    expect(updated.finalPaymentConfirmed).toBe(true)
    // comisión = deliveryAmount + 0.4 * (budget - (revisionAmount ? Number(revisionAmount) : 0))
    // = 10 + 0.4 * (35 - 20) = 16
    expect(Number(updated.technicianCommission)).toBe(16)
  })

  it('rechaza si el status no es REPAIRING', async () => {
    const order = await makeOrder({ status: 'WAITING_APPROVAL' })
    await expect(finishRepair(order.id, technician.id)).rejects.toThrow(
      'Esta acción solo aplica a órdenes en reparación'
    )
  })

  it('rechaza si el technicianId no es el asignado a la orden', async () => {
    const order = await makeOrder({ status: 'REPAIRING' })
    await expect(finishRepair(order.id, otherTechnician.id)).rejects.toThrow(
      'Solo el técnico asignado a esta orden puede finalizar la reparación'
    )
  })
})

describe('orders.service — addBudgetAdjustment', () => {
  it('suma correctamente el monto a order.budget en REPAIRING', async () => {
    const order = await makeOrder({ status: 'REPAIRING', budget: 30 })
    const updated = await addBudgetAdjustment(order.id, adminEmail, 10, 'Repuesto adicional no previsto')
    expect(Number(updated.budget)).toBe(40)
    expect(updated.status).toBe('REPAIRING')
  })

  it('en PAID_PENDING_DELIVERY revierte a READY y limpia el pago final confirmado', async () => {
    const order = await makeOrder({
      status: 'PAID_PENDING_DELIVERY',
      budget: 30,
      finalPaymentConfirmed: true,
      finalPaymentConfirmedAt: new Date(),
      technicianCommission: 16,
    })

    const updated = await addBudgetAdjustment(order.id, adminEmail, 5, 'Repuesto imprevisto tras terminar')

    expect(updated.status).toBe('READY')
    expect(Number(updated.budget)).toBe(35)
    expect(updated.finalPaymentConfirmed).toBe(false)
    expect(updated.finalPaymentConfirmedAt).toBeNull()
    expect(updated.technicianCommission).toBeNull()
  })

  it('rechaza si falta el reason', async () => {
    const order = await makeOrder({ status: 'REPAIRING' })
    await expect(addBudgetAdjustment(order.id, adminEmail, 10, '')).rejects.toThrow('reason es requerido')
  })

  it('rechaza en DELIVERED', async () => {
    const order = await makeOrder({ status: 'DELIVERED' })
    await expect(addBudgetAdjustment(order.id, adminEmail, 10, 'motivo')).rejects.toThrow(
      'Esta acción solo aplica a órdenes en reparación, listas o pagadas pendientes de entrega'
    )
  })

  it('rechaza si el actor TECHNICIAN no es el asignado a la orden', async () => {
    const order = await makeOrder({ status: 'REPAIRING', technicianId: technician.id })
    await expect(
      addBudgetAdjustment(order.id, otherTechnician.email, 10, 'motivo')
    ).rejects.toThrow('Solo el técnico asignado a esta orden puede ajustar su presupuesto')
  })
})
