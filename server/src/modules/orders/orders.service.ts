import prisma from '../../lib/prisma'
import QRCode from 'qrcode'

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

const generateOrderNumber = (): string => {
  const date = new Date()
  const year = date.getFullYear().toString().slice(-2)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const random = Math.floor(Math.random() * 9000) + 1000
  return `REP-${year}${month}${day}-${random}`
}

// ─────────────────────────────────────────────
// ASIGNACIÓN AUTOMÁTICA DE TÉCNICO
// Prioridad 1: AVAILABLE (menos carga)
// Prioridad 2: BUSY bajo su límite (menos carga)
// Prioridad 3: null → asignación manual
// ─────────────────────────────────────────────

const assignTechnician = async (): Promise<string | null> => {
  // Prioridad 1: técnicos disponibles, ordenados por menor carga y más
  // tiempo sin recibir orden
  const available = await prisma.user.findMany({
    where: {
      role: { in: ['TECHNICIAN', 'TECHNICIAN_DELIVERY'] },
      isActive: true,
      technicianStatus: 'AVAILABLE',
    },
    orderBy: [
      { activeOrderCount: 'asc' },
      { updatedAt: 'asc' },
    ],
  })

  if (available.length > 0) {
    return available[0].id
  }

  // Prioridad 2: técnicos ocupados pero bajo su límite de capacidad
  const busy = await prisma.user.findMany({
    where: {
      role: { in: ['TECHNICIAN', 'TECHNICIAN_DELIVERY'] },
      isActive: true,
      technicianStatus: 'BUSY',
    },
    orderBy: { activeOrderCount: 'asc' },
  })

  const underCapacity = busy.filter(
    (t) => t.activeOrderCount < t.maxOrderCapacity
  )

  if (underCapacity.length > 0) {
    return underCapacity[0].id
  }

  // Sin técnicos disponibles → asignación manual
  return null
}

// Actualiza el contador y estado del técnico al asignarle una orden
const incrementTechnicianLoad = async (technicianId: string) => {
  const technician = await prisma.user.findUnique({
    where: { id: technicianId },
  })

  if (!technician) return

  const newCount = technician.activeOrderCount + 1
  const newStatus =
    newCount >= technician.maxOrderCapacity ? 'SATURATED' : 'BUSY'

  await prisma.user.update({
    where: { id: technicianId },
    data: {
      activeOrderCount: newCount,
      technicianStatus: newStatus,
    },
  })
}

// Actualiza el contador y estado del técnico al cerrar una orden
export const decrementTechnicianLoad = async (technicianId: string) => {
  const technician = await prisma.user.findUnique({
    where: { id: technicianId },
  })

  if (!technician) return

  const newCount = Math.max(0, technician.activeOrderCount - 1)
  const newStatus = newCount === 0 ? 'AVAILABLE' : 'BUSY'

  await prisma.user.update({
    where: { id: technicianId },
    data: {
      activeOrderCount: newCount,
      technicianStatus: newStatus,
    },
  })
}

// ─────────────────────────────────────────────
// ÓRDENES — CONSULTAS
// ─────────────────────────────────────────────

export const getAllOrders = async () => {
  return await prisma.order.findMany({
    include: {
      client: true,
      technician: { select: { id: true, name: true, email: true } },
      device: true,
      statusHistory: { orderBy: { createdAt: 'desc' } },
    },
    orderBy: { receivedAt: 'desc' },
  })
}

// Órdenes del día — para la pantalla de la cajera
export const getTodayOrders = async () => {
  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)

  const endOfDay = new Date()
  endOfDay.setHours(23, 59, 59, 999)

  return await prisma.order.findMany({
    where: {
      receivedAt: {
        gte: startOfDay,
        lte: endOfDay,
      },
    },
    include: {
      client: true,
      technician: { select: { id: true, name: true } },
      device: true,
      statusHistory: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
    orderBy: { receivedAt: 'desc' },
  })
}

export const getOrderById = async (id: string) => {
  return await prisma.order.findUnique({
    where: { id },
    include: {
      client: true,
      technician: { select: { id: true, name: true, email: true } },
      device: true,
      statusHistory: { orderBy: { createdAt: 'desc' } },
      notifications: true,
      documents: true,
    },
  })
}

export const getOrderByNumber = async (orderNumber: string) => {
  return await prisma.order.findUnique({
    where: { orderNumber },
    include: {
      client: {
        select: { id: true, name: true, lastName: true, phone: true },
      },
      device: true,
      statusHistory: { orderBy: { createdAt: 'desc' } },
    },
  })
}

export const getOrdersByClient = async (clientId: string) => {
  return await prisma.order.findMany({
    where: { clientId },
    include: {
      device: true,
      technician: { select: { id: true, name: true } },
      statusHistory: { orderBy: { createdAt: 'desc' } },
    },
    orderBy: { receivedAt: 'desc' },
  })
}

// ─────────────────────────────────────────────
// ÓRDENES — CREACIÓN
// ─────────────────────────────────────────────

export const createOrder = async (data: {
  clientId: string
  deviceId: string
  problem: string
  observations?: string
  technicianId?: string  // si viene vacío, el sistema asigna uno
}) => {
  const orderNumber = generateOrderNumber()
  const trackingUrl = `http://192.168.0.116:3000/api/orders/track/${orderNumber}`
  const qrCode = await QRCode.toDataURL(trackingUrl)

  // Si no viene un técnico específico, asignamos automáticamente
  const resolvedTechnicianId = data.technicianId ?? (await assignTechnician())

  const order = await prisma.order.create({
    data: {
      orderNumber,
      qrCode,
      clientId: data.clientId,
      deviceId: data.deviceId,
      problem: data.problem,
      observations: data.observations,
      technicianId: resolvedTechnicianId,
      statusHistory: {
        create: {
          status: 'RECEIVED',
          comment: resolvedTechnicianId
            ? 'Orden creada y técnico asignado automáticamente'
            : 'Orden creada — pendiente de asignación de técnico',
        },
      },
    },
    include: {
      client: true,
      device: true,
      technician: { select: { id: true, name: true } },
      statusHistory: true,
    },
  })

  // Actualiza la carga del técnico asignado
  if (resolvedTechnicianId) {
    await incrementTechnicianLoad(resolvedTechnicianId)
  }

  return {
    ...order,
    technicianAutoAssigned: !data.technicianId && !!resolvedTechnicianId,
    noTechnicianAvailable: !resolvedTechnicianId,
  }
}

// ─────────────────────────────────────────────
// ÓRDENES — CREACIÓN POR EL CLIENTE (self-service)
// Crea el dispositivo y la orden en una sola transacción atómica.
// El clientId se resuelve desde el email del token, nunca desde el body.
// ─────────────────────────────────────────────

export const createSelfServiceOrder = async (data: {
  email: string
  device: {
    type: string
    brand: string
    model: string
    serialNumber?: string
    color: string
    accessories: string
    devicePassword?: string
  }
  problem: string
  observations?: string
}) => {
  // Resolver clientId desde el usuario autenticado
  const user = await prisma.user.findUnique({
    where: { email: data.email },
    select: { clientId: true },
  })

  if (!user || !user.clientId) {
    throw new Error('Cliente no encontrado para este usuario')
  }

  const clientId = user.clientId
  const orderNumber = generateOrderNumber()
  const trackingUrl = `http://192.168.0.116:3000/api/orders/track/${orderNumber}`
  const qrCode = await QRCode.toDataURL(trackingUrl)

  // Asignación automática de técnico (lectura previa a la transacción)
  const resolvedTechnicianId = await assignTechnician()

  // Transacción atómica: si falla la creación de la orden, el dispositivo
  // tampoco queda creado (evita dispositivos huérfanos)
  const order = await prisma.$transaction(async (tx) => {
    const device = await tx.device.create({
      data: {
        type: data.device.type as any,
        brand: data.device.brand,
        model: data.device.model,
        serialNumber: data.device.serialNumber,
        color: data.device.color,
        accessories: data.device.accessories,
        devicePassword: data.device.devicePassword,
      },
    })

    return await tx.order.create({
      data: {
        orderNumber,
        qrCode,
        clientId,
        deviceId: device.id,
        problem: data.problem,
        observations: data.observations,
        technicianId: resolvedTechnicianId,
        statusHistory: {
          create: {
            status: 'RECEIVED',
            comment: resolvedTechnicianId
              ? 'Orden creada por el cliente y técnico asignado automáticamente'
              : 'Orden creada por el cliente — pendiente de asignación de técnico',
          },
        },
      },
      include: {
        client: true,
        device: true,
        technician: { select: { id: true, name: true } },
        statusHistory: true,
      },
    })
  })

  // Actualiza la carga del técnico asignado (fuera de la transacción,
  // igual que en createOrder())
  if (resolvedTechnicianId) {
    await incrementTechnicianLoad(resolvedTechnicianId)
  }

  return {
    ...order,
    technicianAutoAssigned: !!resolvedTechnicianId,
    noTechnicianAvailable: !resolvedTechnicianId,
  }
}

// ─────────────────────────────────────────────
// ÓRDENES — ACTUALIZACIÓN
// ─────────────────────────────────────────────

export const updateOrderStatus = async (
  id: string,
  status: string,
  comment?: string,
  technicianId?: string
) => {
  const order = await prisma.order.update({
    where: { id },
    data: {
      status: status as any,
      ...(technicianId && { technicianId }),
      ...(status === 'DELIVERED' && { deliveredAt: new Date() }),
      statusHistory: {
        create: {
          status: status as any,
          comment,
        },
      },
    },
    include: {
      client: true,
      technician: { select: { id: true, name: true } },
      device: true,
      statusHistory: { orderBy: { createdAt: 'desc' } },
    },
  })

  // Si la orden se entrega o cancela, libera al técnico
  if (
    (status === 'DELIVERED' || status === 'CANCELLED') &&
    order.technicianId
  ) {
    await decrementTechnicianLoad(order.technicianId)
  }

  return order
}

export const updateOrderBudget = async (
  id: string,
  budget: number,
  approved: boolean
) => {
  return await prisma.order.update({
    where: { id },
    data: {
      budget,
      budgetApproved: approved,
      status: approved ? 'APPROVED' : 'WAITING_APPROVAL',
      statusHistory: {
        create: {
          status: approved ? 'APPROVED' : 'WAITING_APPROVAL',
          comment: approved
            ? `Presupuesto de $${budget} aprobado por el cliente`
            : `Presupuesto de $${budget} enviado al cliente para aprobación`,
        },
      },
    },
    include: {
      client: true,
      device: true,
      statusHistory: { orderBy: { createdAt: 'desc' } },
    },
  })
}

// ─────────────────────────────────────────────
// TÉCNICOS — CONSULTAS PARA LA CAJERA
// ─────────────────────────────────────────────

export const getAvailableTechnicians = async () => {
  return await prisma.user.findMany({
    where: {
      role: { in: ['TECHNICIAN', 'TECHNICIAN_DELIVERY'] },
      isActive: true,
      technicianStatus: { in: ['AVAILABLE', 'BUSY'] },
    },
    select: {
      id: true,
      name: true,
      technicianStatus: true,
      activeOrderCount: true,
      maxOrderCapacity: true,
    },
    orderBy: { activeOrderCount: 'asc' },
  })
}