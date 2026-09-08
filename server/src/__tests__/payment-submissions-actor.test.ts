import prisma from '../lib/prisma'
import { confirmAdvancePaymentInstallment } from '../modules/orders/orders.service'
import { confirmPartialPayment } from '../modules/product-orders/product-orders.service'

let client: { id: string }
let device: { id: string }
let admin: { id: string; email: string }
let order: { id: string }
let submission: { id: string }

let productCategory: { id: string }
let product: { id: string }
let productOrder: { id: string }
let productOrderItem: { id: string }
let productOrderSubmission: { id: string }

beforeAll(async () => {
  const suffix = Date.now()
  client = await prisma.client.create({
    data: { name: 'Cliente', lastName: 'Abono', idNumber: `TEST-ABONO-${suffix}`, phone: '0000000000', email: `abono-${suffix}@test.com` },
  })
  device = await prisma.device.create({ data: { type: 'LAPTOP', brand: 'TestBrand', model: 'X1' } })
  admin = await prisma.user.create({
    data: { name: 'Admin Prueba', email: `admin-abono-${suffix}@test.com`, role: 'ADMIN', password: 'COGNITO_MANAGED' },
  })
  order = await prisma.order.create({
    data: {
      orderNumber: `TEST-ABONO-ORDER-${suffix}`, clientId: client.id, deviceId: device.id,
      problem: 'Prueba automatizada — actor en abono', status: 'PENDING_PAYMENT',
    },
  })
  submission = await prisma.advancePaymentSubmission.create({
    data: { orderId: order.id, amount: 25, paymentDetails: { banco: 'Test' }, status: 'PENDING' },
  })

  productCategory = await prisma.productCategory.create({
    data: { name: `Categoría Prueba Abono ${suffix}` },
  })
  product = await prisma.product.create({
    data: {
      name: 'Producto Prueba Abono', price: 50, stock: 10,
      categoryId: productCategory.id,
    },
  })
  productOrder = await prisma.productOrder.create({
    data: {
      clientId: client.id, deliveryMethod: 'PICKUP_AT_STORE', total: 50,
      paymentMethod: 'TRANSFER', status: 'PENDING',
    },
  })
  productOrderItem = await prisma.productOrderItem.create({
    data: { productId: product.id, productOrderId: productOrder.id, quantity: 1, unitPrice: 50, subtotal: 50 },
  })
  productOrderSubmission = await prisma.productOrderPaymentSubmission.create({
    data: { productOrderId: productOrder.id, amount: 25, paymentDetails: { banco: 'Test' }, status: 'PENDING' },
  })
}, 20000)

afterAll(async () => {
  await prisma.advancePaymentSubmission.deleteMany({ where: { orderId: order.id } })
  await prisma.orderStatusHistory.deleteMany({ where: { orderId: order.id } })
  await prisma.order.delete({ where: { id: order.id } }).catch(() => {})
  await prisma.device.delete({ where: { id: device.id } }).catch(() => {})

  await prisma.productOrderPaymentSubmission.deleteMany({ where: { productOrderId: productOrder.id } })
  await prisma.productOrderItem.deleteMany({ where: { productOrderId: productOrder.id } })
  await prisma.productOrder.delete({ where: { id: productOrder.id } }).catch(() => {})
  await prisma.product.delete({ where: { id: product.id } }).catch(() => {})
  await prisma.productCategory.delete({ where: { id: productCategory.id } }).catch(() => {})

  await prisma.user.delete({ where: { id: admin.id } }).catch(() => {})
  await prisma.client.delete({ where: { id: client.id } }).catch(() => {})
})

describe('actor en confirmación de abonos', () => {
  it('confirmAdvancePaymentInstallment registra confirmedByUserId', async () => {
    await confirmAdvancePaymentInstallment(submission.id, true, undefined, admin.email)
    const updated = await prisma.advancePaymentSubmission.findUnique({ where: { id: submission.id } })
    expect(updated?.confirmedByUserId).toBe(admin.id)
  })

  it('confirmPartialPayment registra confirmedByUserId (ProductOrderPaymentSubmission)', async () => {
    await confirmPartialPayment(productOrderSubmission.id, true, undefined, admin.email)
    const updated = await prisma.productOrderPaymentSubmission.findUnique({ where: { id: productOrderSubmission.id } })
    expect(updated?.confirmedByUserId).toBe(admin.id)
  })
})
