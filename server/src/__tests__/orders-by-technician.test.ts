import prisma from '../lib/prisma'
import { getOrdersByTechnician, useProductInOrder } from '../modules/orders/orders.service'
import { createProduct } from '../modules/products/products.service'

describe('getOrdersByTechnician — incluye repuestos usados', () => {
  let category: { id: string }
  let product: { id: string }
  let technician: { id: string; email: string }
  let client: { id: string }
  let device: { id: string }
  let order: { id: string; orderNumber: string }

  beforeAll(async () => {
    const suffix = Date.now()
    category = await prisma.productCategory.create({ data: { name: `Categoria ByTech ${suffix}` } })
    product = await createProduct({ name: 'Repuesto ByTech', price: 15, stock: 10, categoryId: category.id })
    await prisma.inventoryMovement.deleteMany({ where: { productId: product.id } }) // limpiar el IN inicial

    technician = await prisma.user.create({
      data: { name: 'Tecnico', lastName: 'ByTech', email: `tecnico-bytech-${suffix}@test.com`, password: 'x', role: 'TECHNICIAN_DELIVERY' },
    })
    client = await prisma.client.create({
      data: { name: 'Cliente', lastName: 'ByTech', idNumber: `TEST-BYTECH-${suffix}`, phone: '04120000000' },
    })
    device = await prisma.device.create({ data: { type: 'LAPTOP', brand: 'Test', model: 'ByTech X1' } })
    order = await prisma.order.create({
      data: {
        orderNumber: `REP-TEST-BYTECH-${suffix}`,
        problem: 'Falla original',
        status: 'DIAGNOSING',
        budget: 50,
        clientId: client.id,
        deviceId: device.id,
        technicianId: technician.id,
      },
    })

    await useProductInOrder(order.id, product.id, 2, technician.email)
  }, 20000)

  afterAll(async () => {
    await prisma.inventoryMovement.deleteMany({ where: { orderId: order.id } })
    await prisma.orderStatusHistory.deleteMany({ where: { orderId: order.id } })
    await prisma.order.delete({ where: { id: order.id } }).catch(() => {})
    await prisma.device.delete({ where: { id: device.id } }).catch(() => {})
    await prisma.client.delete({ where: { id: client.id } }).catch(() => {})
    await prisma.user.delete({ where: { id: technician.id } }).catch(() => {})
    await prisma.product.delete({ where: { id: product.id } }).catch(() => {})
    await prisma.productCategory.delete({ where: { id: category.id } }).catch(() => {})
  })

  it('la orden trae inventoryMovements con el producto usado', async () => {
    const orders = await getOrdersByTechnician(technician.id)
    const found = orders.find((o) => o.id === order.id)
    expect(found).toBeDefined()
    expect(found?.inventoryMovements.length).toBe(1)
    expect(found?.inventoryMovements[0].product.name).toBe('Repuesto ByTech')
    expect(found?.inventoryMovements[0].quantity).toBe(2)
  })

  it('no incluye movimientos revertidos', async () => {
    const movement = (await prisma.inventoryMovement.findFirst({ where: { orderId: order.id } }))!
    await prisma.inventoryMovement.update({ where: { id: movement.id }, data: { reversedAt: new Date() } })

    const orders = await getOrdersByTechnician(technician.id)
    const found = orders.find((o) => o.id === order.id)
    expect(found?.inventoryMovements.length).toBe(0)
  })
})
