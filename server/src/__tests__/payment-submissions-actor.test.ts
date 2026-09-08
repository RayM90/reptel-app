import prisma from '../lib/prisma'
import { confirmAdvancePaymentInstallment } from '../modules/orders/orders.service'

let client: { id: string }
let device: { id: string }
let admin: { id: string; email: string }
let order: { id: string }
let submission: { id: string }

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
}, 20000)

afterAll(async () => {
  await prisma.advancePaymentSubmission.deleteMany({ where: { orderId: order.id } })
  await prisma.orderStatusHistory.deleteMany({ where: { orderId: order.id } })
  await prisma.order.delete({ where: { id: order.id } }).catch(() => {})
  await prisma.device.delete({ where: { id: device.id } }).catch(() => {})

  await prisma.user.delete({ where: { id: admin.id } }).catch(() => {})
  await prisma.client.delete({ where: { id: client.id } }).catch(() => {})
})

describe('actor en confirmación de abonos', () => {
  it('confirmAdvancePaymentInstallment registra confirmedByUserId', async () => {
    await confirmAdvancePaymentInstallment(submission.id, true, undefined, admin.email)
    const updated = await prisma.advancePaymentSubmission.findUnique({ where: { id: submission.id } })
    expect(updated?.confirmedByUserId).toBe(admin.id)
  })
})
