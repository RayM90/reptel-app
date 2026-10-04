import prisma from '../lib/prisma'
import { updateOrderStatus, useProductInOrder } from '../modules/orders/orders.service'

// Cancelar solo órdenes activas (sin descontar dos veces la carga del técnico
// y devolviendo los repuestos al stock) y repuestos solo en revisión/reparación.
describe('Órdenes — cancelación y repuestos según el estado', () => {
  const suffix = Date.now()
  let techId = ''
  let techEmail = ''
  let clientId = ''
  let deviceId = ''
  let productId = ''
  let categoryId = ''
  let createdCategory = false
  const orderIds: string[] = []

  beforeAll(async () => {
    techEmail = `tec-cancel-${suffix}@test.com`
    const tech = await prisma.user.create({ data: { name: 'Tec Cancel', email: techEmail, password: 'x', role: 'TECHNICIAN_DELIVERY', activeOrderCount: 1 } })
    techId = tech.id
    const client = await prisma.client.create({ data: { name: 'Cliente', lastName: 'Cancel', idNumber: `TEST-CANCEL-${suffix}`, phone: '0000000021' } })
    clientId = client.id
    const dev = await prisma.device.create({ data: { type: 'LAPTOP', brand: 'HP', model: 'C' } })
    deviceId = dev.id
    let cat = await prisma.productCategory.findFirst()
    if (!cat) { cat = await prisma.productCategory.create({ data: { name: `Test Cat Cancel ${suffix}` } }); createdCategory = true }
    categoryId = cat.id
    const product = await prisma.product.create({ data: { name: `RAM Cancel ${suffix}`, price: 20, stock: 10, categoryId } })
    productId = product.id
  })

  afterAll(async () => {
    await prisma.inventoryMovement.deleteMany({ where: { orderId: { in: orderIds } } }).catch(() => {})
    await prisma.orderStatusHistory.deleteMany({ where: { orderId: { in: orderIds } } }).catch(() => {})
    await prisma.order.deleteMany({ where: { id: { in: orderIds } } }).catch(() => {})
    await prisma.product.delete({ where: { id: productId } }).catch(() => {})
    if (createdCategory) await prisma.productCategory.delete({ where: { id: categoryId } }).catch(() => {})
    await prisma.device.delete({ where: { id: deviceId } }).catch(() => {})
    await prisma.client.delete({ where: { id: clientId } }).catch(() => {})
    await prisma.user.delete({ where: { id: techId } }).catch(() => {})
  })

  const newOrder = async (status: string) => {
    const o = await prisma.order.create({
      data: { orderNumber: `REP-CXL-${suffix}-${orderIds.length}`, status: status as any, problem: 'p', clientId, deviceId, technicianId: techId },
    })
    orderIds.push(o.id)
    return o
  }

  it('cancelar devuelve los repuestos al stock y descuenta la carga del técnico una sola vez', async () => {
    const order = await newOrder('REPAIRING')
    await useProductInOrder(order.id, productId, 2, techEmail)
    expect((await prisma.product.findUniqueOrThrow({ where: { id: productId } })).stock).toBe(8)

    await updateOrderStatus(order.id, 'CANCELLED', 'cliente desistió')
    expect((await prisma.product.findUniqueOrThrow({ where: { id: productId } })).stock).toBe(10)
    expect((await prisma.user.findUniqueOrThrow({ where: { id: techId } })).activeOrderCount).toBe(0)

    // Cancelar otra vez se rechaza y no vuelve a tocar la carga.
    await expect(updateOrderStatus(order.id, 'CANCELLED')).rejects.toThrow(/ya no se puede cancelar/)
    expect((await prisma.user.findUniqueOrThrow({ where: { id: techId } })).activeOrderCount).toBe(0)
  })

  it('no se puede cancelar una orden entregada', async () => {
    const order = await newOrder('DELIVERED')
    await expect(updateOrderStatus(order.id, 'CANCELLED')).rejects.toThrow(/ya no se puede cancelar/)
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe('DELIVERED')
  })

  it('no se pueden cargar repuestos en una orden entregada', async () => {
    const order = await newOrder('DELIVERED')
    await expect(useProductInOrder(order.id, productId, 1, techEmail)).rejects.toThrow(/solo se pueden modificar/)
    expect((await prisma.product.findUniqueOrThrow({ where: { id: productId } })).stock).toBe(10)
  })
})
