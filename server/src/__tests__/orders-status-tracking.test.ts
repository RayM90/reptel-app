import prisma from '../lib/prisma'
import { confirmAdvancePaymentInstallment, startReview, submitDiagnosis } from '../modules/orders/orders.service'

let client: { id: string }
let device: { id: string }
let technician: { id: string; email: string }
let otherTechnician: { id: string; email: string }

const makeOrder = (data: { status: string; deliveryAmount?: number | null; technicianId?: string | null }) =>
  prisma.order.create({
    data: {
      orderNumber: `REP-TEST-TRK-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      problem: 'Prueba seguimiento de estados',
      status: data.status as any,
      revisionAmount: 15,
      deliveryAmount: data.deliveryAmount ?? null,
      technicianId: data.technicianId === undefined ? technician.id : data.technicianId,
      clientId: client.id,
      deviceId: device.id,
    },
  })

beforeAll(async () => {
  const suffix = Date.now()
  client = await prisma.client.create({ data: { name: 'Cliente', lastName: 'Tracking', idNumber: `TEST-TRK-${suffix}`, phone: '04120000000' } })
  device = await prisma.device.create({ data: { type: 'LAPTOP', brand: 'Test', model: 'Tracking' } })
  technician = await prisma.user.create({ data: { name: 'Tec', lastName: 'Trk', email: `tec-trk-${suffix}@test.com`, password: 'x', role: 'TECHNICIAN_DELIVERY' } })
  otherTechnician = await prisma.user.create({ data: { name: 'Otro', lastName: 'Trk', email: `otro-trk-${suffix}@test.com`, password: 'x', role: 'TECHNICIAN_DELIVERY' } })
}, 20000)

afterAll(async () => {
  await prisma.advancePaymentSubmission.deleteMany({ where: { order: { clientId: client.id } } })
  await prisma.orderStatusHistory.deleteMany({ where: { order: { clientId: client.id } } })
  await prisma.order.deleteMany({ where: { clientId: client.id } })
  await prisma.device.delete({ where: { id: device.id } }).catch(() => {})
  await prisma.client.delete({ where: { id: client.id } }).catch(() => {})
  await prisma.user.delete({ where: { id: technician.id } }).catch(() => {})
  await prisma.user.delete({ where: { id: otherTechnician.id } }).catch(() => {})
})

describe('confirmar el anticipo', () => {
  it('orden de la app: PENDING_PAYMENT → ON_THE_WAY', async () => {
    const order = await makeOrder({ status: 'PENDING_PAYMENT', deliveryAmount: 10 })
    const s = await prisma.advancePaymentSubmission.create({ data: { orderId: order.id, amount: 25, paymentDetails: { banco: 'Test' } } })
    const updated = await confirmAdvancePaymentInstallment(s.id, true)
    expect(updated.status).toBe('ON_THE_WAY')
  })

  it('orden de mostrador: PENDING_PAYMENT → RECEIVED', async () => {
    const order = await makeOrder({ status: 'PENDING_PAYMENT' })
    const s = await prisma.advancePaymentSubmission.create({ data: { orderId: order.id, amount: 15, paymentDetails: { banco: 'Test' } } })
    const updated = await confirmAdvancePaymentInstallment(s.id, true)
    expect(updated.status).toBe('RECEIVED')
  })
})

describe('startReview', () => {
  it('el técnico asignado pasa ON_THE_WAY → DIAGNOSING con historial a su nombre', async () => {
    const order = await makeOrder({ status: 'ON_THE_WAY', deliveryAmount: 10 })
    const updated = await startReview(order.id, technician.email)
    expect(updated!.status).toBe('DIAGNOSING')
    const h = await prisma.orderStatusHistory.findFirst({ where: { orderId: order.id, status: 'DIAGNOSING' } })
    expect(h?.userId).toBe(technician.id)
  })

  it('también desde RECEIVED (mostrador)', async () => {
    const order = await makeOrder({ status: 'RECEIVED' })
    const updated = await startReview(order.id, technician.email)
    expect(updated!.status).toBe('DIAGNOSING')
  })

  it('rechaza a un técnico que no es el asignado', async () => {
    const order = await makeOrder({ status: 'ON_THE_WAY', deliveryAmount: 10 })
    await expect(startReview(order.id, otherTechnician.email)).rejects.toThrow(/Solo el técnico asignado/)
  })

  it('rechaza si la orden todavía espera el pago', async () => {
    const order = await makeOrder({ status: 'PENDING_PAYMENT', deliveryAmount: 10 })
    await expect(startReview(order.id, technician.email)).rejects.toThrow(/solo puede iniciarse/)
  })
})

describe('submitDiagnosis', () => {
  it('rechaza el diagnóstico si el técnico no marcó que está revisando', async () => {
    const order = await makeOrder({ status: 'ON_THE_WAY', deliveryAmount: 10 })
    await expect(submitDiagnosis(order.id, 'Pantalla', 50)).rejects.toThrow(/mientras el técnico está revisando/)
  })
})
