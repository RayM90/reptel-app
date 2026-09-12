import prisma from '../lib/prisma'
import { submitAdvancePaymentInstallment, submitBudgetPaymentInstallment } from '../modules/orders/orders.service'

let client: { id: string }
let clientUser: { id: string; email: string }
let device: { id: string }

const makeOrder = async (overrides: Partial<{ status: string; budget: number; revisionAmount: number }> = {}) => {
  return prisma.order.create({
    data: {
      orderNumber: `REP-TEST-BP-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      status: (overrides.status ?? 'WAITING_APPROVAL') as any,
      problem: 'Formateo + respaldo — test anticipo de presupuesto',
      budget: overrides.budget ?? 30,
      revisionAmount: overrides.revisionAmount ?? 15,
      clientId: client.id,
      deviceId: device.id,
    },
  })
}

beforeAll(async () => {
  const suffix = Date.now()
  client = await prisma.client.create({
    data: { name: 'Cliente', lastName: 'Anticipo Presupuesto', idNumber: `TEST-BP-${suffix}`, phone: '0000000004' },
  })
  clientUser = await prisma.user.create({
    data: { name: 'Cliente', lastName: 'Anticipo Presupuesto', email: `cliente-bp-${suffix}@test.com`, password: 'x', role: 'CLIENT', clientId: client.id },
  })
  device = await prisma.device.create({ data: { type: 'LAPTOP', brand: 'HP', model: 'Pavilion' } })
}, 20000)

afterAll(async () => {
  await prisma.advancePaymentSubmission.deleteMany({ where: { order: { clientId: client.id } } })
  await prisma.order.deleteMany({ where: { clientId: client.id } })
  await prisma.device.delete({ where: { id: device.id } }).catch(() => {})
  await prisma.user.delete({ where: { id: clientUser.id } }).catch(() => {})
  await prisma.client.delete({ where: { id: client.id } }).catch(() => {})
})

describe('orders.service — submitAdvancePaymentInstallment marca kind REVISION', () => {
  it('el abono de revisión queda con kind REVISION', async () => {
    const order = await makeOrder({ status: 'RECEIVED', budget: undefined as any })
    const submission = await submitAdvancePaymentInstallment(
      order.id, clientUser.email, { banco: 'Bancaribe', telefono: '04121234567', referencia: '9999' }, 15
    )
    expect(submission.kind).toBe('REVISION')
  })
})

describe('orders.service — submitBudgetPaymentInstallment', () => {
  it('crea el abono con kind BUDGET, tope = 50% de (budget - revisionAmount)', async () => {
    // budget 30, revision 15 -> base 15 -> tope anticipo 7.50
    const order = await makeOrder({ budget: 30, revisionAmount: 15 })
    const submission = await submitBudgetPaymentInstallment(
      order.id, clientUser.email, { banco: 'Bancaribe', telefono: '04121234567', referencia: '1111' }, 7.5
    )
    expect(submission.kind).toBe('BUDGET')
    expect(Number(submission.amount)).toBe(7.5)
  })

  it('lanza error si el monto excede el tope del 50%', async () => {
    const order = await makeOrder({ budget: 30, revisionAmount: 15 })
    await expect(
      submitBudgetPaymentInstallment(order.id, clientUser.email, { banco: 'Bancaribe', telefono: '04121234567', referencia: '2222' }, 10)
    ).rejects.toThrow(/excede/)
  })

  it('lanza error si el status no es WAITING_APPROVAL', async () => {
    const order = await makeOrder({ status: 'DIAGNOSING' })
    await expect(
      submitBudgetPaymentInstallment(order.id, clientUser.email, { banco: 'Bancaribe', telefono: '04121234567', referencia: '3333' }, 5)
    ).rejects.toThrow('Esta acción solo aplica a órdenes esperando aprobación de presupuesto')
  })
})
