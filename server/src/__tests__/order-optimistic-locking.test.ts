import prisma from '../lib/prisma'
import { updateOrderStatus } from '../modules/orders/orders.service'

let client: { id: string }
let device: { id: string }
let order: { id: string }

beforeAll(async () => {
  const suffix = Date.now()
  client = await prisma.client.create({
    data: { name: 'Cliente', lastName: 'Version', idNumber: `TEST-VER-${suffix}`, phone: '0000000000', email: `ver-${suffix}@test.com` },
  })
  device = await prisma.device.create({ data: { type: 'LAPTOP', brand: 'TestBrand', model: 'X1' } })
  order = await prisma.order.create({
    data: { orderNumber: `TEST-VER-ORDER-${suffix}`, clientId: client.id, deviceId: device.id, problem: 'Prueba bloqueo optimista' },
  })
}, 20000)

afterAll(async () => {
  await prisma.orderStatusHistory.deleteMany({ where: { orderId: order.id } })
  await prisma.order.delete({ where: { id: order.id } }).catch(() => {})
  await prisma.device.delete({ where: { id: device.id } }).catch(() => {})
  await prisma.client.delete({ where: { id: client.id } }).catch(() => {})
})

describe('bloqueo optimista en Order', () => {
  it('incrementa version en cada actualización exitosa', async () => {
    const updated = await updateOrderStatus(order.id, 'DIAGNOSING', 'Paso 1')
    expect(updated.version).toBe(1)
  })

  it('rechaza la actualización si expectedVersion no coincide (edición concurrente)', async () => {
    await expect(
      updateOrderStatus(order.id, 'WAITING_APPROVAL', 'Paso 2 con version vieja', undefined, undefined, 0)
    ).rejects.toThrow(/modificada por otro usuario/)
  })
})
