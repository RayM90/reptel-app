import prisma from '../lib/prisma'
import { createSelfServiceOrder, createCounterOrder, decrementTechnicianLoad } from '../modules/orders/orders.service'

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

// Simétrico al de arriba: mostrador (equipo ya en el local) nunca debe
// asignarse a un motorizado, aunque sea la candidata más disponible.
describe('assignTechnician — mostrador nunca asigna a un TECHNICIAN_DELIVERY', () => {
  let deliveryTech: { id: string }
  let client: { id: string }
  let admin: { email: string } | null
  let orderId: string | undefined
  let deviceId: string | undefined
  let assignedTechnicianId: string | null | undefined

  beforeAll(async () => {
    const suffix = Date.now()
    deliveryTech = await prisma.user.create({
      data: {
        name: 'Motorizado', lastName: 'Pool Test', email: `delivery-pool-${suffix}@test.com`,
        password: 'x', role: 'TECHNICIAN_DELIVERY', technicianStatus: 'AVAILABLE', activeOrderCount: 0,
      },
    })
    client = await prisma.client.create({
      data: { name: 'Cliente', lastName: 'Pool Counter Test', idNumber: `TEST-POOL-C-${suffix}`, phone: '04120000001' },
    })
    admin = await prisma.user.findFirst({ where: { role: 'ADMIN' }, select: { email: true } })

    const order = await createCounterOrder({
      actorEmail: admin!.email,
      clientId: client.id,
      device: { type: 'LAPTOP', brand: 'TestBrand', model: 'Pool Counter X1', color: 'Negro', accessories: 'Ninguno' },
      problem: 'Prueba de pool de técnicos — no debe asignarse a motorizado',
      advancePaymentMethod: 'MOBILE_PAYMENT',
      paymentDetails: { banco: 'Banesco', telefono: '04121234567', referencia: '1234' },
    })
    orderId = order.id
    deviceId = order.deviceId
    assignedTechnicianId = order.technicianId
  }, 20000)

  afterAll(async () => {
    if (orderId) {
      await prisma.advancePaymentSubmission.deleteMany({ where: { orderId } })
      await prisma.orderStatusHistory.deleteMany({ where: { orderId } })
      await prisma.order.delete({ where: { id: orderId } }).catch(() => {})
    }
    if (deviceId) await prisma.device.delete({ where: { id: deviceId } }).catch(() => {})
    if (assignedTechnicianId) await decrementTechnicianLoad(assignedTechnicianId)
    await prisma.client.delete({ where: { id: client.id } }).catch(() => {})
    await prisma.user.delete({ where: { id: deliveryTech.id } }).catch(() => {})
  })

  it('nunca asigna el TECHNICIAN_DELIVERY, aunque sea la candidata más disponible', async () => {
    expect(assignedTechnicianId).not.toBe(deliveryTech.id)

    if (assignedTechnicianId) {
      const assigned = await prisma.user.findUnique({ where: { id: assignedTechnicianId } })
      expect(assigned?.role).toBe('TECHNICIAN')
    }
  })
})

// Cuando nadie del cargo correcto está disponible NI con capacidad, la orden
// queda en cola (technicianId null) — y en cuanto alguien de ese cargo libera
// capacidad, se le asigna sola, sin que un admin tenga que intervenir.
describe('decrementTechnicianLoad — reasigna sola la orden más antigua en cola', () => {
  let onlyMostradorTech: { id: string }
  let client: { id: string }
  let admin: { email: string } | null
  let queuedOrderId: string | undefined
  let queuedDeviceId: string | undefined
  // Corre contra la BD real de dev, que ya tiene TECHNICIAN reales
  // (Ibrahim, Gabriela) libres — hay que saturarlos temporalmente para que
  // assignTechnician('TECHNICIAN') devuelva null de verdad y la orden quede
  // en cola, no que uno de ellos se la lleve. Se restauran en afterAll.
  let realMostradorTechs: { id: string; activeOrderCount: number; technicianStatus: string }[] = []

  beforeAll(async () => {
    const suffix = Date.now()
    realMostradorTechs = await prisma.user.findMany({
      where: { role: 'TECHNICIAN', isActive: true },
      select: { id: true, activeOrderCount: true, technicianStatus: true },
    })
    for (const t of realMostradorTechs) {
      await prisma.user.update({ where: { id: t.id }, data: { technicianStatus: 'SATURATED', activeOrderCount: 999 } })
    }

    onlyMostradorTech = await prisma.user.create({
      data: {
        name: 'Único', lastName: 'Mostrador Cola', email: `unico-mostrador-${suffix}@test.com`,
        password: 'x', role: 'TECHNICIAN', technicianStatus: 'SATURATED',
        activeOrderCount: 5, maxOrderCapacity: 5,
      },
    })
    client = await prisma.client.create({
      data: { name: 'Cliente', lastName: 'Cola Test', idNumber: `TEST-QUEUE-${suffix}`, phone: '04120000002' },
    })
    admin = await prisma.user.findFirst({ where: { role: 'ADMIN' }, select: { email: true } })

    const order = await createCounterOrder({
      actorEmail: admin!.email,
      clientId: client.id,
      device: { type: 'LAPTOP', brand: 'TestBrand', model: 'Cola X1', color: 'Negro', accessories: 'Ninguno' },
      problem: 'Prueba de cola — nadie de mostrador libre al crear',
      advancePaymentMethod: 'MOBILE_PAYMENT',
      paymentDetails: { banco: 'Banesco', telefono: '04121234567', referencia: '5678' },
    })
    queuedOrderId = order.id
    queuedDeviceId = order.deviceId
  }, 20000)

  afterAll(async () => {
    if (queuedOrderId) {
      await prisma.advancePaymentSubmission.deleteMany({ where: { orderId: queuedOrderId } })
      await prisma.orderStatusHistory.deleteMany({ where: { orderId: queuedOrderId } })
      await prisma.order.delete({ where: { id: queuedOrderId } }).catch(() => {})
    }
    if (queuedDeviceId) await prisma.device.delete({ where: { id: queuedDeviceId } }).catch(() => {})
    await prisma.client.delete({ where: { id: client.id } }).catch(() => {})
    await prisma.user.delete({ where: { id: onlyMostradorTech.id } }).catch(() => {})
    for (const t of realMostradorTechs) {
      await prisma.user.update({
        where: { id: t.id },
        data: { technicianStatus: t.technicianStatus as any, activeOrderCount: t.activeOrderCount },
      })
    }
  })

  it('la orden queda sin técnico al crearse (nadie de mostrador con capacidad)', async () => {
    const order = await prisma.order.findUnique({ where: { id: queuedOrderId } })
    expect(order?.technicianId).toBeNull()
  })

  it('al liberar capacidad, el técnico se auto-asigna la orden en cola', async () => {
    await decrementTechnicianLoad(onlyMostradorTech.id)

    const order = await prisma.order.findUnique({ where: { id: queuedOrderId } })
    expect(order?.technicianId).toBe(onlyMostradorTech.id)

    const tech = await prisma.user.findUnique({ where: { id: onlyMostradorTech.id } })
    // Bajó de 5 a 4 por el decrement, y volvió a subir a 5 al tomar la orden en cola.
    expect(tech?.activeOrderCount).toBe(5)
  })
})
