import prisma from '../lib/prisma'
import { updateOrderStatus } from '../modules/orders/orders.service'

let client: { id: string }
let device: { id: string }
let staffUser: { id: string; email: string }
let order: { id: string }

beforeAll(async () => {
  const suffix = Date.now()
  client = await prisma.client.create({
    data: {
      name: 'Cliente', lastName: 'ActorTest', idNumber: `TEST-ACTOR-${suffix}`,
      phone: '0000000000', email: `cliente-actor-${suffix}@test.com`,
    },
  })
  device = await prisma.device.create({
    data: { type: 'LAPTOP', brand: 'TestBrand', model: 'X1' },
  })
  staffUser = await prisma.user.create({
    data: {
      name: 'Cajera Prueba', email: `cajera-${suffix}@test.com`,
      role: 'CASHIER', password: 'COGNITO_MANAGED',
    },
  })
  order = await prisma.order.create({
    data: {
      orderNumber: `TEST-ACTOR-ORDER-${suffix}`,
      clientId: client.id, deviceId: device.id,
      problem: 'Prueba automatizada — actor en status history',
    },
  })
}, 20000)

afterAll(async () => {
  await prisma.orderStatusHistory.deleteMany({ where: { orderId: order.id } })
  await prisma.order.delete({ where: { id: order.id } }).catch(() => {})
  await prisma.device.delete({ where: { id: device.id } }).catch(() => {})
  await prisma.user.delete({ where: { id: staffUser.id } }).catch(() => {})
  await prisma.client.delete({ where: { id: client.id } }).catch(() => {})
})

describe('orders.service — actor en OrderStatusHistory', () => {
  it('registra el userId del actor cuando se pasa actorEmail', async () => {
    await updateOrderStatus(order.id, 'DIAGNOSING', 'Diagnóstico iniciado', undefined, staffUser.email)

    const history = await prisma.orderStatusHistory.findFirst({
      where: { orderId: order.id, status: 'DIAGNOSING' },
      orderBy: { createdAt: 'desc' },
    })
    expect(history?.userId).toBe(staffUser.id)
  })

  it('deja userId en null cuando no se pasa actorEmail (compatibilidad con llamadas existentes)', async () => {
    await updateOrderStatus(order.id, 'WAITING_APPROVAL', 'Sin actor')

    const history = await prisma.orderStatusHistory.findFirst({
      where: { orderId: order.id, status: 'WAITING_APPROVAL' },
      orderBy: { createdAt: 'desc' },
    })
    expect(history?.userId).toBeNull()
  })
})
