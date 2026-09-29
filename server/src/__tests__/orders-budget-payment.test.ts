import prisma from '../lib/prisma'
import { submitAdvancePaymentInstallment, submitBudgetPaymentInstallment, submitCounterBudgetInstallment, confirmAdvancePaymentInstallment, getOrdersByClient } from '../modules/orders/orders.service'
import { createProduct } from '../modules/products/products.service'

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
  await prisma.orderStatusHistory.deleteMany({ where: { order: { clientId: client.id } } })
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
  it('crea el abono con kind BUDGET, mínimo 50% de (budget - revisionAmount)', async () => {
    // budget 30, revision 15 -> base 15 -> mínimo 7.50
    const order = await makeOrder({ budget: 30, revisionAmount: 15 })
    const submission = await submitBudgetPaymentInstallment(
      order.id, clientUser.email, { banco: 'Bancaribe', telefono: '04121234567', referencia: '1111' }, 7.5
    )
    expect(submission.kind).toBe('BUDGET')
    expect(Number(submission.amount)).toBe(7.5)
  })

  it('permite pagar más del 50% hasta el 100% de la base en un solo abono', async () => {
    // budget 30, revision 15 -> base 15 -> el cliente paga todo de una vez
    const order = await makeOrder({ budget: 30, revisionAmount: 15 })
    const submission = await submitBudgetPaymentInstallment(
      order.id, clientUser.email, { banco: 'Bancaribe', telefono: '04121234567', referencia: '9012' }, 15
    )
    expect(submission.kind).toBe('BUDGET')
    expect(Number(submission.amount)).toBe(15)
  })

  it('lanza error si el monto excede el 100% de la base', async () => {
    const order = await makeOrder({ budget: 30, revisionAmount: 15 })
    await expect(
      submitBudgetPaymentInstallment(order.id, clientUser.email, { banco: 'Bancaribe', telefono: '04121234567', referencia: '2222' }, 20)
    ).rejects.toThrow(/excede/)
  })

  it('lanza error si el status no es WAITING_APPROVAL', async () => {
    const order = await makeOrder({ status: 'DIAGNOSING' })
    await expect(
      submitBudgetPaymentInstallment(order.id, clientUser.email, { banco: 'Bancaribe', telefono: '04121234567', referencia: '3333' }, 5)
    ).rejects.toThrow('Esta acción solo aplica a órdenes esperando aprobación de presupuesto')
  })
})

describe('orders.service — submitCounterBudgetInstallment', () => {
  it('crea el abono con kind BUDGET desde mostrador, sin verificar dueño', async () => {
    const order = await makeOrder({ budget: 30, revisionAmount: 15 })
    const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' }, select: { email: true } })
    const submission = await submitCounterBudgetInstallment(
      order.id, admin!.email, { banco: 'Bancaribe', telefono: '04121234567', referencia: '4444' }, 7.5
    )
    expect(submission.kind).toBe('BUDGET')
    expect(Number(submission.amount)).toBe(7.5)
  })

  it('lanza error si el monto excede el 100% de la base', async () => {
    const order = await makeOrder({ budget: 30, revisionAmount: 15 })
    const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' }, select: { email: true } })
    await expect(
      submitCounterBudgetInstallment(order.id, admin!.email, { banco: 'Bancaribe', telefono: '04121234567', referencia: '5555' }, 20)
    ).rejects.toThrow(/excede/)
  })
})

describe('orders.service — confirmAdvancePaymentInstallment con kind BUDGET', () => {
  it('al completar el 50%, pasa WAITING_APPROVAL -> REPAIRING', async () => {
    const order = await makeOrder({ budget: 30, revisionAmount: 15 })
    const submission = await submitBudgetPaymentInstallment(
      order.id, clientUser.email, { banco: 'Bancaribe', telefono: '04121234567', referencia: '6666' }, 7.5
    )
    const updated = await confirmAdvancePaymentInstallment(submission.id, true, undefined, undefined)
    expect(updated.status).toBe('REPAIRING')
  })

  it('con pago en partes, solo transiciona cuando se completa el 50% total', async () => {
    const order = await makeOrder({ budget: 30, revisionAmount: 15 })
    const first = await submitBudgetPaymentInstallment(
      order.id, clientUser.email, { banco: 'Bancaribe', telefono: '04121234567', referencia: '7777' }, 4
    )
    const afterFirst = await confirmAdvancePaymentInstallment(first.id, true, undefined, undefined)
    expect(afterFirst.status).toBe('WAITING_APPROVAL')

    const second = await submitBudgetPaymentInstallment(
      order.id, clientUser.email, { banco: 'Bancaribe', telefono: '04121234567', referencia: '8888' }, 3.5
    )
    const afterSecond = await confirmAdvancePaymentInstallment(second.id, true, undefined, undefined)
    expect(afterSecond.status).toBe('REPAIRING')
  })

  it('un abono REVISION en mostrador nuevo pasa PENDING_PAYMENT -> RECEIVED', async () => {
    const order = await makeOrder({ status: 'PENDING_PAYMENT', budget: undefined as any, revisionAmount: 15 })
    const submission = await prisma.advancePaymentSubmission.create({
      data: { orderId: order.id, amount: 15, paymentDetails: { banco: 'Bancaribe' }, kind: 'REVISION' },
    })
    const updated = await confirmAdvancePaymentInstallment(submission.id, true, undefined, undefined)
    expect(updated.status).toBe('RECEIVED')
  })
})

describe('mínimo dinámico por repuestos', () => {
  let category: { id: string }
  let product: { id: string }

  beforeAll(async () => {
    category = await prisma.productCategory.create({ data: { name: `Categoria Min ${Date.now()}` } })
    product = await createProduct({ name: 'Pantalla Min Test', price: 63, stock: 5, categoryId: category.id })
  })

  afterAll(async () => {
    await prisma.inventoryMovement.deleteMany({ where: { productId: product.id } })
    await prisma.product.delete({ where: { id: product.id } }).catch(() => {})
    await prisma.productCategory.delete({ where: { id: category.id } }).catch(() => {})
  })

  const addPart = (orderId: string) =>
    prisma.inventoryMovement.create({
      data: { productId: product.id, type: 'OUT', channel: 'SERVICIO_TECNICO', quantity: 1, reason: 'test', orderId, unitPriceAtUse: 63 },
    })

  it('con repuestos de $63 sobre base $100, el 50% ya no alcanza: exige 70%', async () => {
    const order = await makeOrder({ budget: 115, revisionAmount: 15 })
    await addPart(order.id)
    const s1 = await submitBudgetPaymentInstallment(order.id, clientUser.email, { banco: 'Bancaribe', telefono: '04121234567', referencia: 'MIN1' }, 50)
    const after50 = await confirmAdvancePaymentInstallment(s1.id, true, undefined, undefined)
    expect(after50.status).toBe('WAITING_APPROVAL')

    const s2 = await submitBudgetPaymentInstallment(order.id, clientUser.email, { banco: 'Bancaribe', telefono: '04121234567', referencia: 'MIN2' }, 20)
    const after70 = await confirmAdvancePaymentInstallment(s2.id, true, undefined, undefined)
    expect(after70.status).toBe('REPAIRING')
  })

  it('getOrdersByClient devuelve paymentSummary con el porcentaje y lo que falta', async () => {
    const order = await makeOrder({ budget: 115, revisionAmount: 15 })
    await addPart(order.id)
    const orders = await getOrdersByClient(client.id)
    const found = orders.find((o) => o.id === order.id)!
    expect(found.paymentSummary).toEqual({
      budget: 115, paid: 15, remaining: 100, minimumPercent: 70, minimumAmount: 70, pendingForMinimum: 70,
    })
  })

  it('acepta abonos de presupuesto en WAITING_EXTRA_PAYMENT', async () => {
    const order = await makeOrder({ status: 'WAITING_EXTRA_PAYMENT', budget: 115, revisionAmount: 15 })
    const s = await submitBudgetPaymentInstallment(order.id, clientUser.email, { banco: 'Bancaribe', telefono: '04121234567', referencia: 'MIN3' }, 10)
    expect(s.kind).toBe('BUDGET')
  })

  it('no expone el técnico mientras el pago del anticipo no está confirmado', async () => {
    const tech = await prisma.user.create({
      data: { name: 'Tec', lastName: 'Contacto', email: `tec-contacto-${Date.now()}@test.com`, password: 'x', role: 'TECHNICIAN_DELIVERY', phone: '04141234567' },
    })
    try {
      const pending = await prisma.order.create({
        data: { orderNumber: `REP-TEST-CT-${Date.now()}`, status: 'PENDING_PAYMENT', problem: 'x', clientId: client.id, deviceId: device.id, technicianId: tech.id, deliveryAmount: 10, revisionAmount: 15 },
      })
      const onTheWay = await prisma.order.create({
        data: { orderNumber: `REP-TEST-CT2-${Date.now()}`, status: 'ON_THE_WAY', problem: 'x', clientId: client.id, deviceId: device.id, technicianId: tech.id, deliveryAmount: 10, revisionAmount: 15 },
      })
      const orders = await getOrdersByClient(client.id)
      expect(orders.find((o) => o.id === pending.id)!.technician).toBeNull()
      expect(orders.find((o) => o.id === onTheWay.id)!.technician).toEqual({ id: tech.id, name: 'Tec', lastName: 'Contacto', phone: '04141234567' })
    } finally {
      await prisma.order.deleteMany({ where: { technicianId: tech.id } })
      await prisma.user.delete({ where: { id: tech.id } }).catch(() => {})
    }
  })
})
