import prisma from '../lib/prisma'
import { createSelfServiceOrder, decrementTechnicianLoad } from '../modules/orders/orders.service'

// Self-service + delivery requiere ir a buscar el equipo — a diferencia de
// las órdenes de mostrador, el pool de auto-asignación NUNCA debe incluir
// TECHNICIAN (mostrador), solo TECHNICIAN_DELIVERY.
describe('assignTechnician — self-service nunca asigna a un TECHNICIAN de mostrador', () => {
  let mostradorTech: { id: string }
  let client: { id: string }
  let clientUser: { id: string; email: string }
  let orderId: string | undefined
  let deviceId: string | undefined
  let assignedTechnicianId: string | null | undefined

  beforeAll(async () => {
    const suffix = Date.now()
    // AVAILABLE + activeOrderCount 0 — la mejor candidata posible si el pool
    // llegara a incluirla por error.
    mostradorTech = await prisma.user.create({
      data: {
        name: 'Mostrador', lastName: 'Pool Test', email: `mostrador-pool-${suffix}@test.com`,
        password: 'x', role: 'TECHNICIAN', technicianStatus: 'AVAILABLE', activeOrderCount: 0,
      },
    })
    client = await prisma.client.create({
      data: { name: 'Cliente', lastName: 'Pool Test', idNumber: `TEST-POOL-${suffix}`, phone: '04120000000' },
    })
    clientUser = await prisma.user.create({
      data: {
        name: 'Cliente', lastName: 'Pool Test', email: `cliente-pool-${suffix}@test.com`,
        password: 'x', role: 'CLIENT', clientId: client.id,
      },
    })

    const order = await createSelfServiceOrder({
      email: clientUser.email,
      device: { type: 'LAPTOP', brand: 'TestBrand', model: 'Pool X1', color: 'Negro', accessories: 'Ninguno' },
      problem: 'Prueba de pool de técnicos — no debe asignarse a mostrador',
      advancePaymentMethod: 'MOBILE_PAYMENT',
    })
    orderId = order.id
    deviceId = order.deviceId
    assignedTechnicianId = order.technicianId
  }, 20000)

  afterAll(async () => {
    if (orderId) {
      await prisma.orderStatusHistory.deleteMany({ where: { orderId } })
      await prisma.order.delete({ where: { id: orderId } }).catch(() => {})
    }
    if (deviceId) await prisma.device.delete({ where: { id: deviceId } }).catch(() => {})
    if (assignedTechnicianId) await decrementTechnicianLoad(assignedTechnicianId)
    await prisma.user.delete({ where: { id: clientUser.id } }).catch(() => {})
    await prisma.client.delete({ where: { id: client.id } }).catch(() => {})
    await prisma.user.delete({ where: { id: mostradorTech.id } }).catch(() => {})
  })

  it('nunca asigna el TECHNICIAN de mostrador, aunque sea la candidata más disponible', async () => {
    expect(assignedTechnicianId).not.toBe(mostradorTech.id)

    if (assignedTechnicianId) {
      const assigned = await prisma.user.findUnique({ where: { id: assignedTechnicianId } })
      expect(assigned?.role).toBe('TECHNICIAN_DELIVERY')
    }
  })
})
