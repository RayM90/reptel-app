import request from 'supertest'
import app from '../app'
import prisma from '../lib/prisma'
import { decrementTechnicianLoad } from '../modules/orders/orders.service'

let authToken: string
let client: { id: string }
let createdOrderId: string

beforeAll(async () => {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: 'admin@reptel.com', password: 'RepTel2024*' })
  authToken = res.body.data.token

  client = await prisma.client.create({
    data: {
      name: 'Cliente',
      lastName: 'Prueba Mostrador',
      idNumber: `TEST-COUNTER-${Date.now()}`,
      phone: '04120000000',
    },
  })
}, 20000)

afterAll(async () => {
  if (createdOrderId) {
    const order = await prisma.order.findUnique({
      where: { id: createdOrderId },
      select: { technicianId: true },
    })
    await prisma.orderStatusHistory.deleteMany({ where: { orderId: createdOrderId } })
    await prisma.order.delete({ where: { id: createdOrderId } }).catch(() => {})
    if (order?.technicianId) {
      await decrementTechnicianLoad(order.technicianId)
    }
  }
  await prisma.client.delete({ where: { id: client.id } }).catch(() => {})
})

describe('Orders — POST /api/orders/counter', () => {
  it('crea la orden directo en RECEIVED, sin AdvancePaymentSubmission', async () => {
    const res = await request(app)
      .post('/api/orders/counter')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        clientId: client.id,
        device: {
          type: 'LAPTOP',
          brand: 'TestBrand',
          model: 'Mostrador X1',
          color: 'Negro',
          accessories: 'Cargador',
        },
        problem: 'Pantalla rota — orden de mostrador (test)',
        advancePaymentMethod: 'PAGO_MOVIL',
      })

    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)
    expect(res.body.data.status).toBe('RECEIVED')
    expect(Number(res.body.data.revisionAmount)).toBe(15)
    expect(res.body.data.deliveryAmount).toBeNull()
    createdOrderId = res.body.data.id

    const submissions = await prisma.advancePaymentSubmission.findMany({ where: { orderId: createdOrderId } })
    expect(submissions).toHaveLength(0)

    const history = await prisma.orderStatusHistory.findFirst({ where: { orderId: createdOrderId } })
    expect(history?.comment).toMatch(/mostrador/i)
    expect(history?.userId).toBeTruthy()
  }, 15000)

  it('retorna 400 si faltan campos requeridos', async () => {
    const res = await request(app)
      .post('/api/orders/counter')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ clientId: client.id })

    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
  })
})
