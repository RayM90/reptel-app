import prisma from '../lib/prisma'
import { createProduct, updateProduct, getInventoryMovements } from '../modules/products/products.service'
import { useProductInOrder } from '../modules/orders/orders.service'

let category: { id: string }

beforeAll(async () => {
  category = await prisma.productCategory.create({ data: { name: `Categoria Inv ${Date.now()}` } })
})

afterAll(async () => {
  await prisma.productCategory.delete({ where: { id: category.id } }).catch(() => {})
})

describe('InventoryMovement', () => {
  it('createProduct con stock inicial > 0 registra un movimiento IN', async () => {
    const product = await createProduct({ name: 'Producto Inv', price: 10, stock: 20, categoryId: category.id })

    const movement = await prisma.inventoryMovement.findFirst({ where: { productId: product.id } })
    expect(movement?.type).toBe('IN')
    expect(movement?.quantity).toBe(20)

    await prisma.inventoryMovement.deleteMany({ where: { productId: product.id } })
    await prisma.product.delete({ where: { id: product.id } })
  })

  it('updateProduct que sube el stock registra un movimiento IN con la diferencia', async () => {
    const product = await createProduct({ name: 'Producto Inv 2', price: 10, stock: 5, categoryId: category.id })
    await prisma.inventoryMovement.deleteMany({ where: { productId: product.id } }) // limpiar el IN inicial

    await updateProduct(product.id, { stock: 15 })

    const movement = await prisma.inventoryMovement.findFirst({
      where: { productId: product.id }, orderBy: { createdAt: 'desc' },
    })
    expect(movement?.type).toBe('IN')
    expect(movement?.quantity).toBe(10)

    await prisma.inventoryMovement.deleteMany({ where: { productId: product.id } })
    await prisma.product.delete({ where: { id: product.id } })
  })
})

describe('getInventoryMovements', () => {
  it('filtra por productId e incluye product.name y channel (default AJUSTE_MANUAL)', async () => {
    const product = await createProduct({ name: 'Producto Historial', price: 10, stock: 10, categoryId: category.id })

    const movements = await getInventoryMovements({ productId: product.id })
    expect(movements).toHaveLength(1)
    expect(movements[0].product.name).toBe('Producto Historial')
    expect(movements[0].channel).toBe('AJUSTE_MANUAL')

    await prisma.inventoryMovement.deleteMany({ where: { productId: product.id } })
    await prisma.product.delete({ where: { id: product.id } })
  })

  it('filtra por channel', async () => {
    const product = await createProduct({ name: 'Producto Historial 2', price: 10, stock: 10, categoryId: category.id })

    const withChannel = await getInventoryMovements({ productId: product.id, channel: 'AJUSTE_MANUAL' })
    const withOtherChannel = await getInventoryMovements({ productId: product.id, channel: 'SERVICIO_TECNICO' })
    expect(withChannel).toHaveLength(1)
    expect(withOtherChannel).toHaveLength(0)

    await prisma.inventoryMovement.deleteMany({ where: { productId: product.id } })
    await prisma.product.delete({ where: { id: product.id } })
  })

  it('incluye el deliveryAmount de la orden relacionada en movimientos de servicio tecnico', async () => {
    const product = await createProduct({ name: 'Producto Historial 3', price: 10, stock: 10, categoryId: category.id })
    const technician = await prisma.user.create({
      data: { name: 'Tecnico', lastName: 'Inv', email: `tecnico-inv-${Date.now()}@test.com`, password: 'x', role: 'TECHNICIAN_DELIVERY' },
    })
    const client = await prisma.client.create({
      data: { name: 'Cliente', lastName: 'Inv', idNumber: `TEST-INV-${Date.now()}`, phone: '04120000000' },
    })
    const device = await prisma.device.create({ data: { type: 'LAPTOP', brand: 'Test', model: 'Inv X1' } })
    const order = await prisma.order.create({
      data: {
        orderNumber: `REP-TEST-INV-${Date.now()}`,
        problem: 'Falla original',
        status: 'DIAGNOSING',
        budget: 50,
        budgetApproved: true,
        deliveryAmount: 5, // orden de la App
        clientId: client.id,
        deviceId: device.id,
        technicianId: technician.id,
      },
    })

    const used = await useProductInOrder(order.id, product.id, 1, technician.email)
    const movements = await getInventoryMovements({ channel: 'SERVICIO_TECNICO' })
    const found = movements.find((m) => m.id === used.movement.id)!
    expect(found.order).toBeDefined()
    expect(found.order?.deliveryAmount).not.toBeNull()

    await prisma.inventoryMovement.deleteMany({ where: { orderId: order.id } })
    await prisma.orderStatusHistory.deleteMany({ where: { orderId: order.id } })
    await prisma.order.delete({ where: { id: order.id } })
    await prisma.device.delete({ where: { id: device.id } })
    await prisma.client.delete({ where: { id: client.id } })
    await prisma.user.delete({ where: { id: technician.id } })
    await prisma.inventoryMovement.deleteMany({ where: { productId: product.id } })
    await prisma.product.delete({ where: { id: product.id } })
  })
})
