import prisma from '../lib/prisma'
import { approveBudget, rejectBudget } from '../modules/orders/orders.service'

let clientA: { id: string }
let userA: { id: string; email: string }
let clientB: { id: string }
let userB: { id: string; email: string }
let technician: { id: string }
let device: { id: string }

const makeOrder = async (overrides: Partial<{ status: string; budget: number }> = {}) => {
  return prisma.order.create({
    data: {
      orderNumber: `REP-TEST-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      status: (overrides.status ?? 'WAITING_APPROVAL') as any,
      problem: 'Pantalla dañada — test automatizado',
      budget: overrides.budget ?? 50,
      deliveryAmount: 10,
      revisionAmount: 15,
      clientId: clientA.id,
      deviceId: device.id,
      technicianId: technician.id,
    },
  })
}

beforeAll(async () => {
  const suffix = Date.now()

  clientA = await prisma.client.create({
    data: {
      name: 'Cliente', lastName: 'Presupuesto A',
      idNumber: `TEST-BUDGET-A-${suffix}`, phone: '0000000001',
      email: `cliente-budget-a-${suffix}@test.com`, password: '',
    },
  })
  userA = await prisma.user.create({
    data: {
      name: 'Cliente Presupuesto A',
      email: `cliente-budget-a-${suffix}@test.com`,
      password: 'x', role: 'CLIENT', clientId: clientA.id,
    },
  })

  clientB = await prisma.client.create({
    data: {
      name: 'Cliente', lastName: 'Presupuesto B',
      idNumber: `TEST-BUDGET-B-${suffix}`, phone: '0000000002',
      email: `cliente-budget-b-${suffix}@test.com`, password: '',
    },
  })
  userB = await prisma.user.create({
    data: {
      name: 'Cliente Presupuesto B',
      email: `cliente-budget-b-${suffix}@test.com`,
      password: 'x', role: 'CLIENT', clientId: clientB.id,
    },
  })

  technician = await prisma.user.create({
    data: {
      name: 'Técnico Test', email: `tecnico-budget-${suffix}@test.com`,
      password: 'x', role: 'TECHNICIAN_DELIVERY',
      technicianStatus: 'BUSY', activeOrderCount: 1,
    },
  })

  device = await prisma.device.create({
    data: { type: 'LAPTOP', brand: 'HP', model: 'Pavilion 15' },
  })
}, 20000)

afterAll(async () => {
  await prisma.orderStatusHistory.deleteMany({ where: { order: { clientId: { in: [clientA.id, clientB.id] } } } })
  await prisma.order.deleteMany({ where: { clientId: { in: [clientA.id, clientB.id] } } })
  await prisma.device.delete({ where: { id: device.id } }).catch(() => {})
  await prisma.user.delete({ where: { id: userA.id } }).catch(() => {})
  await prisma.user.delete({ where: { id: userB.id } }).catch(() => {})
  await prisma.user.delete({ where: { id: technician.id } }).catch(() => {})
  await prisma.client.delete({ where: { id: clientA.id } }).catch(() => {})
  await prisma.client.delete({ where: { id: clientB.id } }).catch(() => {})
})

describe('orders.service — approveBudget', () => {
  it('aprueba una orden en WAITING_APPROVAL', async () => {
    const order = await makeOrder()
    const result = await approveBudget(order.id, userA.email)
    expect(result.status).toBe('APPROVED')
    expect(result.budgetApproved).toBe(true)
  })

  it('lanza error si el status no es WAITING_APPROVAL', async () => {
    const order = await makeOrder({ status: 'RECEIVED' })
    await expect(approveBudget(order.id, userA.email)).rejects.toThrow(
      'Esta acción solo aplica a órdenes esperando aprobación de presupuesto'
    )
  })

  it('lanza error si la orden no pertenece al cliente', async () => {
    const order = await makeOrder()
    await expect(approveBudget(order.id, userB.email)).rejects.toThrow('Orden no encontrada')
  })
})

describe('orders.service — rejectBudget', () => {
  it('rechaza una orden en WAITING_APPROVAL: CANCELLED, comisión fija, finalPaymentConfirmedAt seteado', async () => {
    const order = await makeOrder({ budget: 80 })
    const result = await rejectBudget(order.id, userA.email, 'Es muy costoso')

    expect(result.status).toBe('CANCELLED')
    expect(Number(result.technicianCommission)).toBe(16) // 10 + 0.4*15
    expect(result.finalPaymentConfirmedAt).not.toBeNull()
    expect(result.finalPaymentConfirmed).toBe(true)

    const techAfter = await prisma.user.findUnique({ where: { id: technician.id } })
    expect(techAfter?.activeOrderCount).toBe(0)

    const history = await prisma.orderStatusHistory.findFirst({
      where: { orderId: order.id, status: 'CANCELLED' },
      orderBy: { createdAt: 'desc' },
    })
    expect(history?.comment).toContain('Es muy costoso')
  })

  it('la comisión no depende del monto del presupuesto rechazado', async () => {
    const order = await makeOrder({ budget: 500 })
    const result = await rejectBudget(order.id, userA.email, 'Prefiero resolverlo por mi cuenta')
    expect(Number(result.technicianCommission)).toBe(16)
  })

  it('lanza error si el status no es WAITING_APPROVAL', async () => {
    const order = await makeOrder({ status: 'READY' })
    await expect(rejectBudget(order.id, userA.email, 'Otro')).rejects.toThrow(
      'Esta acción solo aplica a órdenes esperando aprobación de presupuesto'
    )
  })

  it('lanza error si la orden no pertenece al cliente', async () => {
    const order = await makeOrder()
    await expect(rejectBudget(order.id, userB.email, 'Otro')).rejects.toThrow('Orden no encontrada')
  })
})
