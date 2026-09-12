import request from 'supertest'
import app from '../app'
import prisma from '../lib/prisma'

let authToken: string
let client: { id: string }
let device: { id: string }
let orderId: string

beforeAll(async () => {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: 'admin@reptel.com', password: 'RepTel2024*' })
  authToken = res.body.data.token

  client = await prisma.client.create({
    data: {
      name: 'Cliente', lastName: 'Anticipo Mostrador HTTP',
      idNumber: `TEST-CBP-${Date.now()}`, phone: '04120000005',
    },
  })
  device = await prisma.device.create({
    data: { type: 'LAPTOP', brand: 'HP', model: 'Pavilion' },
  })
  const order = await prisma.order.create({
    data: {
      orderNumber: `REP-TEST-CBP-${Date.now()}`,
      status: 'WAITING_APPROVAL',
      problem: 'Formateo — test HTTP anticipo mostrador',
      budget: 30,
      revisionAmount: 15,
      clientId: client.id,
      deviceId: device.id,
    },
  })
  orderId = order.id
}, 20000)

afterAll(async () => {
  await prisma.advancePaymentSubmission.deleteMany({ where: { orderId } })
  await prisma.orderStatusHistory.deleteMany({ where: { orderId } })
  await prisma.order.delete({ where: { id: orderId } }).catch(() => {})
  await prisma.device.delete({ where: { id: device.id } }).catch(() => {})
  await prisma.client.delete({ where: { id: client.id } }).catch(() => {})
})

describe('Orders — POST /api/orders/:id/counter-budget-payment-installment', () => {
  it('401 sin token', async () => {
    const res = await request(app)
      .post(`/api/orders/${orderId}/counter-budget-payment-installment`)
      .send({ paymentDetails: { banco: 'Bancaribe' }, amount: 7.5 })

    expect(res.status).toBe(401)
  })

  it('400 si el monto excede el 50% de (budget - revisionAmount)', async () => {
    const res = await request(app)
      .post(`/api/orders/${orderId}/counter-budget-payment-installment`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ paymentDetails: { banco: 'Bancaribe', telefono: '04121234567', referencia: '1111' }, amount: 10 })

    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
  })

  it('201 y kind BUDGET al registrar un anticipo válido', async () => {
    const res = await request(app)
      .post(`/api/orders/${orderId}/counter-budget-payment-installment`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ paymentDetails: { banco: 'Bancaribe', telefono: '04121234567', referencia: '2222' }, amount: 7.5 })

    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)
    expect(res.body.data.kind).toBe('BUDGET')
    expect(Number(res.body.data.amount)).toBe(7.5)
  })
})
