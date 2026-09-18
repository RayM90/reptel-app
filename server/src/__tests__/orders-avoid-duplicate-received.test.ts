import prisma from '../lib/prisma'
import { confirmAdvancePaymentInstallment } from '../modules/orders/orders.service'

let client: { id: string }
let device: { id: string }
let admin: { id: string; email: string }

const makeOrderWithSubmission = async (status: 'PENDING_PAYMENT' | 'RECEIVED') => {
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`
  const order = await prisma.order.create({
    data: {
      orderNumber: `TEST-DUPRECV-${suffix}`,
      clientId: client.id,
      deviceId: device.id,
      problem: 'Prueba automatizada — no duplicar Recibido',
      status,
      revisionAmount: 15,
    },
  })
  const submission = await prisma.advancePaymentSubmission.create({
    data: { orderId: order.id, amount: 15, paymentDetails: { banco: 'Test' }, status: 'PENDING' },
  })
  return { order, submission }
}

beforeAll(async () => {
  const suffix = Date.now()
  client = await prisma.client.create({
    data: { name: 'Cliente', lastName: 'DupRecv', idNumber: `TEST-DUPRECV-${suffix}`, phone: '0000000000', email: `duprecv-${suffix}@test.com` },
  })
  device = await prisma.device.create({ data: { type: 'LAPTOP', brand: 'TestBrand', model: 'X1' } })
  admin = await prisma.user.create({
    data: { name: 'Admin Prueba', email: `admin-duprecv-${suffix}@test.com`, role: 'ADMIN', password: 'COGNITO_MANAGED' },
  })
}, 20000)

afterAll(async () => {
  await prisma.advancePaymentSubmission.deleteMany({ where: { order: { clientId: client.id } } })
  await prisma.orderStatusHistory.deleteMany({ where: { order: { clientId: client.id } } })
  await prisma.order.deleteMany({ where: { clientId: client.id } })
  await prisma.device.delete({ where: { id: device.id } }).catch(() => {})
  await prisma.user.delete({ where: { id: admin.id } }).catch(() => {})
  await prisma.client.delete({ where: { id: client.id } }).catch(() => {})
})

describe('confirmAdvancePaymentInstallment — no duplicar "Recibido"', () => {
  it('orden de mostrador (ya RECEIVED): solo agrega DIAGNOSING, no un segundo RECEIVED', async () => {
    const { order, submission } = await makeOrderWithSubmission('RECEIVED')
    await confirmAdvancePaymentInstallment(submission.id, true, undefined, admin.email)

    const history = await prisma.orderStatusHistory.findMany({ where: { orderId: order.id } })
    const receivedEntries = history.filter((h) => h.status === 'RECEIVED')
    const diagnosingEntries = history.filter((h) => h.status === 'DIAGNOSING')
    expect(receivedEntries.length).toBe(0)
    expect(diagnosingEntries.length).toBe(1)
  })

  it('orden self-service (PENDING_PAYMENT): agrega RECEIVED y DIAGNOSING', async () => {
    const { order, submission } = await makeOrderWithSubmission('PENDING_PAYMENT')
    await confirmAdvancePaymentInstallment(submission.id, true, undefined, admin.email)

    const history = await prisma.orderStatusHistory.findMany({ where: { orderId: order.id } })
    const receivedEntries = history.filter((h) => h.status === 'RECEIVED')
    const diagnosingEntries = history.filter((h) => h.status === 'DIAGNOSING')
    expect(receivedEntries.length).toBe(1)
    expect(diagnosingEntries.length).toBe(1)
  })
})
