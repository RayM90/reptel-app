import prisma from '../lib/prisma'
import { confirmDeliveryByClient } from '../modules/orders/orders.service'

let clientA: { id: string }
let userA: { id: string; email: string }
let clientB: { id: string }
let userB: { id: string; email: string }
let technician: { id: string }
let device: { id: string }

const makeOrder = async (overrides: Partial<{ status: string; deliveryAmount: number | null }> = {}) => {
  return prisma.order.create({
    data: {
      orderNumber: `REP-TEST-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      status: (overrides.status ?? 'PAID_PENDING_DELIVERY') as any,
      problem: 'Pantalla dañada — test automatizado',
      budget: 50,
      deliveryAmount: 'deliveryAmount' in overrides ? overrides.deliveryAmount : 10,
      revisionAmount: 15,
      finalPaymentConfirmed: true,
      technicianCommission: 20,
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
      name: 'Cliente', lastName: 'Entrega A',
      idNumber: `TEST-DELIVERY-A-${suffix}`, phone: '0000000001',
      email: `cliente-delivery-a-${suffix}@test.com`,
    },
  })
  userA = await prisma.user.create({
    data: {
      name: 'Cliente Entrega A',
      email: `cliente-delivery-a-${suffix}@test.com`,
      password: 'x', role: 'CLIENT', clientId: clientA.id,
    },
  })

  clientB = await prisma.client.create({
    data: {
      name: 'Cliente', lastName: 'Entrega B',
      idNumber: `TEST-DELIVERY-B-${suffix}`, phone: '0000000002',
      email: `cliente-delivery-b-${suffix}@test.com`,
    },
  })
  userB = await prisma.user.create({
    data: {
      name: 'Cliente Entrega B',
      email: `cliente-delivery-b-${suffix}@test.com`,
      password: 'x', role: 'CLIENT', clientId: clientB.id,
    },
  })

  technician = await prisma.user.create({
    data: {
      name: 'Técnico Test', email: `tecnico-delivery-${suffix}@test.com`,
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
  await prisma.device.delete({ where: { id: device.id } }).catch((e) => console.error('DEVICE DELETE FAILED', e))
  await prisma.user.delete({ where: { id: userA.id } }).catch((e) => console.error('USER A DELETE FAILED', e))
  await prisma.user.delete({ where: { id: userB.id } }).catch((e) => console.error('USER B DELETE FAILED', e))
  await prisma.user.delete({ where: { id: technician.id } }).catch((e) => console.error('TECH DELETE FAILED', e))
  await prisma.client.delete({ where: { id: clientA.id } }).catch((e) => console.error('CLIENT A DELETE FAILED', e))
  await prisma.client.delete({ where: { id: clientB.id } }).catch((e) => console.error('CLIENT B DELETE FAILED', e))
})

describe('orders.service — confirmDeliveryByClient', () => {
  it('confirma la entrega de una orden a domicilio pagada: DELIVERED, deliveredAt seteado', async () => {
    const order = await makeOrder()
    const result = await confirmDeliveryByClient(order.id, userA.email)

    expect(result.status).toBe('DELIVERED')
    expect(result.deliveredAt).not.toBeNull()

    const history = await prisma.orderStatusHistory.findFirst({
      where: { orderId: order.id, status: 'DELIVERED' },
      orderBy: { createdAt: 'desc' },
    })
    expect(history?.comment).toContain('Cliente confirmó la recepción')
  })

  it('lanza error si la orden es de mostrador (deliveryAmount null)', async () => {
    const order = await makeOrder({ deliveryAmount: null })
    await expect(confirmDeliveryByClient(order.id, userA.email)).rejects.toThrow(
      'Esta acción solo aplica a órdenes con entrega a domicilio'
    )
  })

  it('lanza error si el estado no es PAID_PENDING_DELIVERY', async () => {
    const order = await makeOrder({ status: 'READY' })
    await expect(confirmDeliveryByClient(order.id, userA.email)).rejects.toThrow(
      'Esta acción solo aplica a órdenes pagadas, pendientes de entrega'
    )
  })

  it('lanza error si la orden no pertenece al cliente', async () => {
    const order = await makeOrder()
    await expect(confirmDeliveryByClient(order.id, userB.email)).rejects.toThrow('Orden no encontrada')
  })
})
