import prisma from '../lib/prisma'
import { createSelfServiceOrder, createCounterOrder, decrementTechnicianLoad, syncTechnicianLoad } from '../modules/orders/orders.service'

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

// La carga del técnico se calcula contando sus órdenes activas reales, no
// sumando y restando un contador: si alguien borra órdenes a mano (o un test
// deja datos a medias), el contador guardado queda desfasado y el técnico
// parece lleno sin tener nada. Incidente del 2026-09-23.
describe('syncTechnicianLoad — recalcula la carga desde las órdenes reales', () => {
  let tech: { id: string }
  let client: { id: string }
  const orderIds: string[] = []
  const deviceIds: string[] = []

  beforeAll(async () => {
    const suffix = Date.now()
    tech = await prisma.user.create({
      data: {
        name: 'Contador', lastName: 'Inflado', email: `contador-inflado-${suffix}@test.com`,
        password: 'x', role: 'TECHNICIAN', technicianStatus: 'SATURATED',
        activeOrderCount: 5, maxOrderCapacity: 5,
      },
    })
    client = await prisma.client.create({
      data: { name: 'Cliente', lastName: 'Sync Test', idNumber: `TEST-SYNC-${suffix}`, phone: '04120000003' },
    })
  })

  afterAll(async () => {
    await prisma.orderStatusHistory.deleteMany({ where: { orderId: { in: orderIds } } })
    await prisma.order.deleteMany({ where: { id: { in: orderIds } } })
    await prisma.device.deleteMany({ where: { id: { in: deviceIds } } })
    await prisma.client.delete({ where: { id: client.id } }).catch(() => {})
    await prisma.user.delete({ where: { id: tech.id } }).catch(() => {})
  })

  const createOrderFor = async (status: 'DIAGNOSING' | 'DELIVERED' | 'PAID_PENDING_DELIVERY') => {
    const device = await prisma.device.create({
      data: { type: 'LAPTOP', brand: 'TestBrand', model: 'Sync X1', color: 'Negro', accessories: 'Ninguno' },
    })
    deviceIds.push(device.id)
    const order = await prisma.order.create({
      data: {
        orderNumber: `REP-TEST-SYNC-${Date.now()}-${orderIds.length}`,
        clientId: client.id, deviceId: device.id, technicianId: tech.id,
        problem: 'Prueba de recálculo de carga', status,
      },
    })
    orderIds.push(order.id)
  }

  it('un contador inflado sin órdenes reales vuelve a 0 / AVAILABLE', async () => {
    await syncTechnicianLoad(tech.id)
    const t = await prisma.user.findUnique({ where: { id: tech.id } })
    expect(t?.activeOrderCount).toBe(0)
    expect(t?.technicianStatus).toBe('AVAILABLE')
  })

  it('solo cuenta las órdenes que todavía ocupan al técnico', async () => {
    await createOrderFor('DIAGNOSING')
    await createOrderFor('DELIVERED')
    await createOrderFor('PAID_PENDING_DELIVERY')
    await syncTechnicianLoad(tech.id)
    const t = await prisma.user.findUnique({ where: { id: tech.id } })
    expect(t?.activeOrderCount).toBe(1)
    expect(t?.technicianStatus).toBe('BUSY')
  })
})

// El caso reportado: los técnicos de mostrador figuraban SATURATED 5/5 sin
// tener órdenes, y la orden nueva quedaba "en cola". La asignación tiene que
// guiarse por las órdenes reales, no por el contador guardado.
describe('assignTechnician — ignora contadores guardados desfasados', () => {
  let client: { id: string }
  let admin: { email: string } | null
  let orderId: string | undefined
  let deviceId: string | undefined
  let assignedTechnicianId: string | null | undefined
  let mostradorTechIds: string[] = []

  beforeAll(async () => {
    const suffix = Date.now()
    // Se inflan los contadores guardados de todos los técnicos de mostrador.
    // Con el cálculo real esto ya no afecta la asignación, y el afterAll los
    // recalcula (no restaura a ciegas un valor que podía estar mal).
    const mostradorTechs = await prisma.user.findMany({
      where: { role: 'TECHNICIAN', isActive: true },
      select: { id: true },
    })
    mostradorTechIds = mostradorTechs.map((t) => t.id)
    await prisma.user.updateMany({
      where: { id: { in: mostradorTechIds } },
      data: { technicianStatus: 'SATURATED', activeOrderCount: 999 },
    })
    client = await prisma.client.create({
      data: { name: 'Cliente', lastName: 'Inflado Test', idNumber: `TEST-INFL-${suffix}`, phone: '04120000004' },
    })
    admin = await prisma.user.findFirst({ where: { role: 'ADMIN' }, select: { email: true } })

    const order = await createCounterOrder({
      actorEmail: admin!.email,
      clientId: client.id,
      device: { type: 'LAPTOP', brand: 'TestBrand', model: 'Inflado X1', color: 'Negro', accessories: 'Ninguno' },
      problem: 'Prueba — contador guardado inflado no debe dejar la orden en cola',
      advancePaymentMethod: 'MOBILE_PAYMENT',
      paymentDetails: { banco: 'Banesco', telefono: '04121234567', referencia: '9999' },
    })
    orderId = order.id
    deviceId = order.deviceId
    assignedTechnicianId = order.technicianId
  }, 20000)

  afterAll(async () => {
    try {
      if (orderId) {
        await prisma.advancePaymentSubmission.deleteMany({ where: { orderId } })
        await prisma.orderStatusHistory.deleteMany({ where: { orderId } })
        await prisma.order.delete({ where: { id: orderId } }).catch(() => {})
      }
      if (deviceId) await prisma.device.delete({ where: { id: deviceId } }).catch(() => {})
      await prisma.client.delete({ where: { id: client.id } }).catch(() => {})
    } finally {
      for (const id of mostradorTechIds) await syncTechnicianLoad(id)
    }
  })

  it('asigna un técnico de mostrador aunque todos figuren SATURATED en el contador', async () => {
    expect(assignedTechnicianId).not.toBeNull()
  })
})

// Cuando nadie del cargo correcto tiene capacidad, la orden queda en cola
// (technicianId null), y en cuanto alguien de ese cargo libera capacidad se
// le asigna sola. Se arma sin tocar a los técnicos reales: la orden en cola
// se crea directo con receivedAt muy antiguo para que sea la primera de la
// fila (FIFO), y el técnico de prueba tiene capacidad 1.
describe('decrementTechnicianLoad — reasigna sola la orden más antigua en cola', () => {
  let tech: { id: string }
  let client: { id: string }
  let busyOrderId: string
  let queuedOrderId: string
  const deviceIds: string[] = []

  beforeAll(async () => {
    const suffix = Date.now()
    tech = await prisma.user.create({
      data: {
        name: 'Único', lastName: 'Mostrador Cola', email: `unico-mostrador-${suffix}@test.com`,
        password: 'x', role: 'TECHNICIAN', technicianStatus: 'SATURATED',
        activeOrderCount: 1, maxOrderCapacity: 1,
      },
    })
    client = await prisma.client.create({
      data: { name: 'Cliente', lastName: 'Cola Test', idNumber: `TEST-QUEUE-${suffix}`, phone: '04120000002' },
    })
    const newDevice = async () => {
      const d = await prisma.device.create({
        data: { type: 'LAPTOP', brand: 'TestBrand', model: 'Cola X1', color: 'Negro', accessories: 'Ninguno' },
      })
      deviceIds.push(d.id)
      return d.id
    }
    const busy = await prisma.order.create({
      data: {
        orderNumber: `REP-TEST-BUSY-${suffix}`, clientId: client.id, deviceId: await newDevice(),
        technicianId: tech.id, problem: 'Orden que ocupa al técnico', status: 'DIAGNOSING',
      },
    })
    busyOrderId = busy.id
    const queued = await prisma.order.create({
      data: {
        orderNumber: `REP-TEST-QUEUE-${suffix}`, clientId: client.id, deviceId: await newDevice(),
        technicianId: null, problem: 'Prueba de cola', status: 'RECEIVED',
        receivedAt: new Date('2000-01-01T00:00:00Z'),
      },
    })
    queuedOrderId = queued.id
  })

  afterAll(async () => {
    const ids = [busyOrderId, queuedOrderId].filter(Boolean)
    await prisma.orderStatusHistory.deleteMany({ where: { orderId: { in: ids } } })
    await prisma.order.deleteMany({ where: { id: { in: ids } } })
    await prisma.device.deleteMany({ where: { id: { in: deviceIds } } })
    await prisma.client.delete({ where: { id: client.id } }).catch(() => {})
    await prisma.user.delete({ where: { id: tech.id } }).catch(() => {})
  })

  it('no toma la orden en cola si sigue sin capacidad', async () => {
    await decrementTechnicianLoad(tech.id)
    const order = await prisma.order.findUnique({ where: { id: queuedOrderId } })
    expect(order?.technicianId).toBeNull()
  })

  it('al liberar capacidad de verdad, se auto-asigna la orden en cola', async () => {
    await prisma.order.update({ where: { id: busyOrderId }, data: { status: 'DELIVERED' } })
    await decrementTechnicianLoad(tech.id)

    const order = await prisma.order.findUnique({ where: { id: queuedOrderId } })
    expect(order?.technicianId).toBe(tech.id)

    const t = await prisma.user.findUnique({ where: { id: tech.id } })
    expect(t?.activeOrderCount).toBe(1)
    expect(t?.technicianStatus).toBe('SATURATED')
  })
})
