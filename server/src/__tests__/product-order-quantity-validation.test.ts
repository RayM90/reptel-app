import prisma from '../lib/prisma'
import { createProductOrder } from '../modules/product-orders/product-orders.service'

let client: { id: string }
let category: { id: string }
let product: { id: string }

beforeAll(async () => {
  const suffix = Date.now()
  client = await prisma.client.create({
    data: { name: 'Cliente', lastName: 'Qty', idNumber: `TEST-QTY-${suffix}`, phone: '0000000000', email: `qty-${suffix}@test.com`, password: '' },
  })
  category = await prisma.productCategory.create({ data: { name: `Categoria Qty ${suffix}` } })
  product = await prisma.product.create({
    data: { name: 'Producto Qty', price: 10, stock: 5, categoryId: category.id },
  })
}, 20000)

afterAll(async () => {
  await prisma.product.delete({ where: { id: product.id } }).catch(() => {})
  await prisma.productCategory.delete({ where: { id: category.id } }).catch(() => {})
  await prisma.client.delete({ where: { id: client.id } }).catch(() => {})
})

describe('product-orders.service — validación de quantity', () => {
  it('rechaza quantity negativa', async () => {
    await expect(
      createProductOrder({
        clientId: client.id,
        deliveryMethod: 'PICKUP_AT_STORE',
        paymentMethod: 'CASH',
        items: [{ productId: product.id, quantity: -5 }],
      } as any)
    ).rejects.toThrow(/mayor a 0/)
  })

  it('rechaza quantity igual a 0', async () => {
    await expect(
      createProductOrder({
        clientId: client.id,
        deliveryMethod: 'PICKUP_AT_STORE',
        paymentMethod: 'CASH',
        items: [{ productId: product.id, quantity: 0 }],
      } as any)
    ).rejects.toThrow(/mayor a 0/)
  })

  it('rechaza quantity no entera', async () => {
    await expect(
      createProductOrder({
        clientId: client.id,
        deliveryMethod: 'PICKUP_AT_STORE',
        paymentMethod: 'CASH',
        items: [{ productId: product.id, quantity: 1.5 }],
      } as any)
    ).rejects.toThrow(/mayor a 0/)
  })

  it('no modifica el stock cuando la orden se rechaza por quantity inválida', async () => {
    await expect(
      createProductOrder({
        clientId: client.id,
        deliveryMethod: 'PICKUP_AT_STORE',
        paymentMethod: 'CASH',
        items: [{ productId: product.id, quantity: -5 }],
      } as any)
    ).rejects.toThrow()

    const unchanged = await prisma.product.findUnique({ where: { id: product.id } })
    expect(unchanged?.stock).toBe(5)
  })
})
