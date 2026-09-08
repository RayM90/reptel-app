import prisma from '../lib/prisma'
import { cancelProductOrder } from '../modules/product-orders/product-orders.service'

let client: { id: string }
let category: { id: string }
let product: { id: string }
let admin: { id: string; email: string }
let productOrder: { id: string }

beforeAll(async () => {
  const suffix = Date.now()
  client = await prisma.client.create({
    data: { name: 'Cliente', lastName: 'Historial', idNumber: `TEST-POH-${suffix}`, phone: '0000000000', email: `poh-${suffix}@test.com` },
  })
  category = await prisma.productCategory.create({ data: { name: `Categoria POH ${suffix}` } })
  product = await prisma.product.create({ data: { name: 'Producto POH', price: 10, stock: 5, categoryId: category.id } })
  admin = await prisma.user.create({
    data: { name: 'Admin POH', email: `admin-poh-${suffix}@test.com`, role: 'ADMIN', password: 'COGNITO_MANAGED' },
  })
  productOrder = await prisma.productOrder.create({
    data: {
      clientId: client.id, deliveryMethod: 'PICKUP_AT_STORE', paymentMethod: 'CASH', total: 10, status: 'PENDING',
      items: { create: [{ productId: product.id, quantity: 1, unitPrice: 10, subtotal: 10 }] },
    },
  })
}, 20000)

afterAll(async () => {
  await prisma.productOrderStatusHistory.deleteMany({ where: { productOrderId: productOrder.id } })
  await prisma.productOrderItem.deleteMany({ where: { productOrderId: productOrder.id } })
  await prisma.productOrder.delete({ where: { id: productOrder.id } }).catch(() => {})
  await prisma.product.delete({ where: { id: product.id } }).catch(() => {})
  await prisma.productCategory.delete({ where: { id: category.id } }).catch(() => {})
  await prisma.user.delete({ where: { id: admin.id } }).catch(() => {})
  await prisma.client.delete({ where: { id: client.id } }).catch(() => {})
})

describe('ProductOrderStatusHistory', () => {
  it('cancelProductOrder deja un registro de historial con el actor', async () => {
    await cancelProductOrder(productOrder.id, admin.email)

    const history = await prisma.productOrderStatusHistory.findFirst({
      where: { productOrderId: productOrder.id, status: 'CANCELLED' },
    })
    expect(history).not.toBeNull()
    expect(history?.userId).toBe(admin.id)
  })
})
