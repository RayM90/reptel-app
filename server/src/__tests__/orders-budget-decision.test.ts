import prisma from '../lib/prisma'
import { rejectBudget, rejectBudgetByAdmin, confirmZeroBudgetDiagnosis, disputeZeroBudgetDiagnosis } from '../modules/orders/orders.service'
import { submitDiagnosis } from '../modules/orders/orders.service'

let clientA: { id: string }
let userA: { id: string; email: string }
let clientB: { id: string }
let userB: { id: string; email: string }
let technician: { id: string }
let admin: { id: string; email: string }
let device: { id: string }

const makeOrder = async (overrides: Partial<{ status: string; budget: number | undefined }> = {}) => {
  return prisma.order.create({
    data: {
      orderNumber: `REP-TEST-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      status: (overrides.status ?? 'WAITING_APPROVAL') as any,
      problem: 'Pantalla dañada — test automatizado',
      budget: 'budget' in overrides ? overrides.budget : 50,
      deliveryAmount: 10,
      revisionAmount: 15,
      clientId: clientA.id,
      deviceId: device.id,
      technicianId: technician.id,
    },
  })
}

beforeAll(async () => {
  const suffix = Date.now()

  clientA = await prisma.client.create({
    data: {
      name: 'Cliente', lastName: 'Presupuesto A',
      idNumber: `TEST-BUDGET-A-${suffix}`, phone: '0000000001',
      email: `cliente-budget-a-${suffix}@test.com`,
    },
  })
  userA = await prisma.user.create({
    data: {
      name: 'Cliente Presupuesto A',
      email: `cliente-budget-a-${suffix}@test.com`,
      password: 'x', role: 'CLIENT', clientId: clientA.id,
    },
  })

  clientB = await prisma.client.create({
    data: {
      name: 'Cliente', lastName: 'Presupuesto B',
      idNumber: `TEST-BUDGET-B-${suffix}`, phone: '0000000002',
      email: `cliente-budget-b-${suffix}@test.com`,
    },
  })
  userB = await prisma.user.create({
    data: {
      name: 'Cliente Presupuesto B',
      email: `cliente-budget-b-${suffix}@test.com`,
      password: 'x', role: 'CLIENT', clientId: clientB.id,
    },
  })

  technician = await prisma.user.create({
    data: {
      name: 'Técnico Test', email: `tecnico-budget-${suffix}@test.com`,
      password: 'x', role: 'TECHNICIAN_DELIVERY',
      technicianStatus: 'BUSY', activeOrderCount: 1,
    },
  })

  admin = await prisma.user.create({
    data: {
      name: 'Admin Presupuesto', email: `admin-budget-${suffix}@test.com`,
      password: 'x', role: 'ADMIN',
    },
  })

  device = await prisma.device.create({
    data: { type: 'LAPTOP', brand: 'HP', model: 'Pavilion 15' },
  })
}, 20000)

afterAll(async () => {
  await prisma.orderStatusHistory.deleteMany({ where: { order: { clientId: { in: [clientA.id, clientB.id] } } } })
  await prisma.order.deleteMany({ where: { clientId: { in: [clientA.id, clientB.id] } } })
  await prisma.device.delete({ where: { id: device.id } }).catch((e) => console.error('DEVICE DELETE FAILED', e))
  await prisma.user.delete({ where: { id: userA.id } }).catch((e) => console.error('USER A DELETE FAILED', e))
  await prisma.user.delete({ where: { id: userB.id } }).catch((e) => console.error('USER B DELETE FAILED', e))
  await prisma.user.delete({ where: { id: technician.id } }).catch((e) => console.error('TECH DELETE FAILED', e))
  await prisma.user.delete({ where: { id: admin.id } }).catch((e) => console.error('ADMIN DELETE FAILED', e))
  await prisma.client.delete({ where: { id: clientA.id } }).catch((e) => console.error('CLIENT A DELETE FAILED', e))
  await prisma.client.delete({ where: { id: clientB.id } }).catch((e) => console.error('CLIENT B DELETE FAILED', e))
})

describe('orders.service — rejectBudget', () => {
  it('rechaza una orden en WAITING_APPROVAL: REJECTED_PENDING_PICKUP, comisión fija, motivo guardado', async () => {
    const order = await makeOrder({ budget: 80 })
    const result = await rejectBudget(order.id, userA.email, 'Es muy costoso')

    expect(result.status).toBe('REJECTED_PENDING_PICKUP')
    expect(Number(result.technicianCommission)).toBe(16) // 10 + 0.4*15
    expect(result.budgetRejectionReason).toBe('Es muy costoso')
    expect(result.finalPaymentConfirmed).toBe(false)
    expect(result.deliveredAt).toBeNull()

    const techAfter = await prisma.user.findUnique({ where: { id: technician.id } })
    expect(techAfter?.activeOrderCount).toBe(0)

    const history = await prisma.orderStatusHistory.findFirst({
      where: { orderId: order.id, status: 'REJECTED_PENDING_PICKUP' },
      orderBy: { createdAt: 'desc' },
    })
    expect(history?.comment).toContain('Es muy costoso')
  })

  it('la comisión no depende del monto del presupuesto rechazado', async () => {
    const order = await makeOrder({ budget: 500 })
    const result = await rejectBudget(order.id, userA.email, 'Prefiero resolverlo por mi cuenta')
    expect(Number(result.technicianCommission)).toBe(16)
  })

  it('lanza error si el status no es WAITING_APPROVAL', async () => {
    const order = await makeOrder({ status: 'READY' })
    await expect(rejectBudget(order.id, userA.email, 'Otro')).rejects.toThrow(
      'Esta acción solo aplica a órdenes esperando aprobación de presupuesto'
    )
  })

  it('lanza error si la orden no pertenece al cliente', async () => {
    const order = await makeOrder()
    await expect(rejectBudget(order.id, userB.email, 'Otro')).rejects.toThrow('Orden no encontrada')
  })
})

describe('orders.service — rejectBudgetByAdmin', () => {
  it('el admin rechaza en nombre del cliente: REJECTED_PENDING_PICKUP, comisión fija, historial con el admin', async () => {
    const order = await makeOrder({ budget: 65 })
    const result = await rejectBudgetByAdmin(order.id, admin.email, 'No quiere reparar')

    expect(result.status).toBe('REJECTED_PENDING_PICKUP')
    expect(Number(result.technicianCommission)).toBe(16) // 10 + 0.4*15
    expect(result.budgetRejectionReason).toBe('No quiere reparar')

    const history = await prisma.orderStatusHistory.findFirst({
      where: { orderId: order.id, status: 'REJECTED_PENDING_PICKUP' },
      orderBy: { createdAt: 'desc' },
    })
    expect(history?.userId).toBe(admin.id)
    expect(history?.comment).toContain('administrador')
    expect(history?.comment).toContain('No quiere reparar')
  })

  it('lanza error si el status no es WAITING_APPROVAL', async () => {
    const order = await makeOrder({ status: 'REPAIRING' })
    await expect(rejectBudgetByAdmin(order.id, admin.email, 'Otro')).rejects.toThrow(
      'Esta acción solo aplica a órdenes esperando aprobación de presupuesto'
    )
  })
})

describe('orders.service — submitDiagnosis siempre WAITING_APPROVAL', () => {
  it('con presupuesto > 0 deja WAITING_APPROVAL (sin cambios)', async () => {
    const order = await makeOrder({ status: 'RECEIVED', budget: undefined as any })
    const result = await submitDiagnosis(order.id, 'Pantalla dañada', 50)
    expect(result.status).toBe('WAITING_APPROVAL')
    expect(result.budgetApproved).toBeNull()
  })

  it('con presupuesto = 0 TAMBIÉN deja WAITING_APPROVAL (antes saltaba a READY)', async () => {
    const order = await makeOrder({ status: 'RECEIVED', budget: undefined as any })
    const result = await submitDiagnosis(order.id, 'No es la laptop, es el cargador', 0)
    expect(result.status).toBe('WAITING_APPROVAL')
    expect(result.budgetApproved).toBeNull() // ya no se auto-aprueba, decide el cliente
  })
})

describe('orders.service — confirmZeroBudgetDiagnosis', () => {
  it('confirma un diagnóstico $0: DELIVERED, comisión $16', async () => {
    const order = await makeOrder({ budget: 0 })
    const result = await confirmZeroBudgetDiagnosis(order.id, userA.email)
    expect(result.status).toBe('DELIVERED')
    expect(Number(result.technicianCommission)).toBe(16)
    expect(result.finalPaymentConfirmedAt).not.toBeNull()
  })

  it('lanza error si el presupuesto no es $0', async () => {
    const order = await makeOrder({ budget: 50 })
    await expect(confirmZeroBudgetDiagnosis(order.id, userA.email)).rejects.toThrow(
      'Esta acción solo aplica a diagnósticos sin costo'
    )
  })

  it('lanza error si la orden no pertenece al cliente', async () => {
    const order = await makeOrder({ budget: 0 })
    await expect(confirmZeroBudgetDiagnosis(order.id, userB.email)).rejects.toThrow('Orden no encontrada')
  })

  it('lanza error si la orden no está en WAITING_APPROVAL', async () => {
    const order = await makeOrder({ status: 'RECEIVED', budget: 0 })
    await expect(confirmZeroBudgetDiagnosis(order.id, userA.email)).rejects.toThrow(
      'Esta acción solo aplica a órdenes esperando aprobación de presupuesto'
    )
  })
})

describe('orders.service — disputeZeroBudgetDiagnosis', () => {
  it('vuelve la orden al técnico: RECEIVED, budget y diagnosis en null', async () => {
    const order = await makeOrder({ budget: 0 })

    const techBefore = await prisma.user.findUnique({ where: { id: technician.id } })
    const result = await disputeZeroBudgetDiagnosis(order.id, userA.email, 'Sigue sin encender')
    const techAfter = await prisma.user.findUnique({ where: { id: technician.id } })

    expect(result.status).toBe('RECEIVED')
    expect(result.budget).toBeNull()
    expect(result.diagnosis).toBeNull()
    expect(techAfter?.activeOrderCount).toBe(techBefore?.activeOrderCount) // NO se decrementa NI se incrementa

    const history = await prisma.orderStatusHistory.findFirst({
      where: { orderId: order.id, status: 'RECEIVED' },
      orderBy: { createdAt: 'desc' },
    })
    expect(history?.comment).toContain('Sigue sin encender')
  })

  it('lanza error si el presupuesto no es $0', async () => {
    const order = await makeOrder({ budget: 50 })
    await expect(disputeZeroBudgetDiagnosis(order.id, userA.email)).rejects.toThrow(
      'Esta acción solo aplica a diagnósticos sin costo'
    )
  })

  it('lanza error si la orden no está en WAITING_APPROVAL', async () => {
    const order = await makeOrder({ status: 'RECEIVED', budget: 0 })
    await expect(disputeZeroBudgetDiagnosis(order.id, userA.email)).rejects.toThrow(
      'Esta acción solo aplica a órdenes esperando aprobación de presupuesto'
    )
  })
})
