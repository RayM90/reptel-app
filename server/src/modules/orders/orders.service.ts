import { Prisma } from '@prisma/client'
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
// PAGO ANTICIPADO — MONTOS FIJOS (constantes)
// TODO: mover a configuración en BD si en el futuro se necesitan
// hacer editables desde el panel admin (Fase 4).
// ─────────────────────────────────────────────

const ADVANCE_DELIVERY_AMOUNT = 10
const ADVANCE_REVISION_AMOUNT = 15

// ─────────────────────────────────────────────
// ASIGNACIÓN AUTOMÁTICA DE TÉCNICO
// Prioridad 1: AVAILABLE (menos carga)
// Prioridad 2: BUSY bajo su límite (menos carga)
// Prioridad 3: null → asignación manual
// ─────────────────────────────────────────────

const assignTechnician = async (): Promise<string | null> => {
  const available = await prisma.user.findMany({
    where: {
      role: 'TECHNICIAN_DELIVERY',
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

  const busy = await prisma.user.findMany({
    where: {
      role: 'TECHNICIAN_DELIVERY',
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

  return null
}

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
      // Endpoint público (sin autenticación) — solo lo mínimo para que el
      // cliente identifique su orden. Nunca teléfono/apellido (PII) ni la
      // contraseña del equipo.
      client: {
        select: { id: true, name: true },
      },
      device: {
        select: { id: true, type: true, brand: true, model: true, color: true, accessories: true },
      },
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
  technicianId?: string
}) => {
  const orderNumber = generateOrderNumber()
  const trackingUrl = `http://192.168.0.116:3000/api/orders/track/${orderNumber}`
  const qrCode = await QRCode.toDataURL(trackingUrl)

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
//
// PAGO ANTICIPADO: toda orden self-service requiere pago adelantado de
// delivery + revisión antes de que el técnico-delivery sea despachado.
// La orden nace en status PENDING_PAYMENT con los montos fijos ya
// asignados. El técnico SÍ se asigna automáticamente (igual que antes),
// pero no se notifica/despacha hasta que el pago quede confirmado por
// el ADMIN.
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
  advancePaymentMethod: string // ya mapeado al enum PaymentMethod de Prisma
}) => {
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

  const resolvedTechnicianId = await assignTechnician()

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
        status: 'PENDING_PAYMENT',
        deliveryAmount: ADVANCE_DELIVERY_AMOUNT,
        revisionAmount: ADVANCE_REVISION_AMOUNT,
        advancePaymentMethod: data.advancePaymentMethod as any,
        statusHistory: {
          create: {
            status: 'PENDING_PAYMENT',
            comment: resolvedTechnicianId
              ? 'Orden creada por el cliente — técnico asignado, pendiente de pago anticipado (delivery + revisión)'
              : 'Orden creada por el cliente — pendiente de asignación de técnico y de pago anticipado',
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
// PAGO ANTICIPADO — SUBIR DATOS DE PAGO (cliente)
// Mismo patrón que product-orders.service.ts → uploadReceipt().
// Guarda los datos ingresados por el cliente y notifica a los
// administradores.
// ─────────────────────────────────────────────

export const submitAdvancePayment = async (
  orderId: string,
  email: string,
  paymentDetails: Record<string, string>
) => {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { clientId: true },
  })

  if (!user || !user.clientId) {
    throw new Error('Cliente no encontrado para este usuario')
  }

  const order = await prisma.order.findFirst({
    where: { id: orderId, clientId: user.clientId },
  })

  if (!order) {
    throw new Error('Orden no encontrada')
  }

  const updatedOrder = await prisma.order.update({
    where: { id: orderId },
    data: { advancePaymentDetails: paymentDetails },
    include: {
      client: true,
      device: true,
      technician: { select: { id: true, name: true } },
      statusHistory: { orderBy: { createdAt: 'desc' } },
    },
  })

  const admins = await prisma.user.findMany({
    where: { role: 'ADMIN', isActive: true },
    select: { id: true },
  })

  if (admins.length > 0) {
    await prisma.notification.createMany({
      data: admins.map((admin) => ({
        type: 'PAYMENT_CONFIRMED',
        channel: 'PUSH',
        message: `Datos de pago anticipado registrados para la orden de servicio técnico #${order.orderNumber}`,
        userId: admin.id,
        orderId,
      })),
    })
  }

  return updatedOrder
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
      role: 'TECHNICIAN_DELIVERY',
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

// ─────────────────────────────────────────────
// TÉCNICO — Confirmar o corregir diagnóstico + presupuesto (Fase 4)
// El técnico visita/revisa el equipo, confirma si la falla reportada por
// el cliente es correcta o la corrige, y asigna el presupuesto. La orden
// pasa a WAITING_APPROVAL a la espera de que el cliente decida (registrado
// después por el ADMIN vía el endpoint /:id/budget ya existente).
// ─────────────────────────────────────────────

export const submitDiagnosis = async (
  id: string,
  diagnosis: string,
  budget: number,
  serviceCatalogId?: string
) => {
  return await prisma.order.update({
    where: { id },
    data: {
      diagnosis,
      budget,
      serviceCatalogId: serviceCatalogId ?? null,
      status: 'WAITING_APPROVAL',
      statusHistory: {
        create: {
          status: 'WAITING_APPROVAL',
          comment: `Diagnóstico registrado por el técnico. Presupuesto: $${budget}`,
        },
      },
    },
    include: {
      client: true,
      device: true,
      technician: { select: { id: true, name: true } },
      serviceCatalog: true,
      statusHistory: { orderBy: { createdAt: 'desc' } },
    },
  })
}

// ─────────────────────────────────────────────
// ADMIN — Confirmar o rechazar el pago anticipado (Fase 4)
// Al aprobar: la orden pasa de PENDING_PAYMENT a RECEIVED, quedando
// lista para que el técnico-delivery asignado sea despachado.
// Al rechazar: se guarda el motivo obligatorio, la orden permanece en
// PENDING_PAYMENT, y se limpian los datos de pago viejos (para que el
// botón "Aprobar" del admin no quede habilitado con información
// incorrecta) — el cliente debe reenviar sus datos.
// ─────────────────────────────────────────────

export const confirmAdvancePayment = async (
  id: string,
  approved: boolean,
  rejectionReason?: string
) => {
  const order = await prisma.order.findUnique({
    where: { id },
    include: { client: { include: { user: true } } },
  })

  if (!order) {
    throw new Error('Orden no encontrada')
  }

  const updatedOrder = await prisma.order.update({
    where: { id },
    data: {
      advancePaymentConfirmed: approved,
      advancePaymentConfirmedAt: approved ? new Date() : null,
      advancePaymentRejectionReason: approved ? null : rejectionReason,
      ...(approved
        ? {}
        : { advanceReceiptUrl: null, advancePaymentDetails: Prisma.JsonNull }),
      status: approved ? 'RECEIVED' : 'PENDING_PAYMENT',
      statusHistory: {
        create: {
          status: approved ? 'RECEIVED' : 'PENDING_PAYMENT',
          comment: approved
            ? 'Pago anticipado confirmado por el administrador'
            : `Pago anticipado rechazado: ${rejectionReason}`,
        },
      },
    },
    include: {
      client: true,
      device: true,
      technician: { select: { id: true, name: true } },
      statusHistory: { orderBy: { createdAt: 'desc' } },
    },
  })

  if (order.client.user) {
    await prisma.notification.create({
      data: {
        type: 'PAYMENT_CONFIRMED',
        channel: 'PUSH',
        message: approved
          ? `Tu pago anticipado para la orden #${order.orderNumber} fue confirmado. El técnico será despachado pronto.`
          : `No pudimos confirmar tu pago para la orden #${order.orderNumber}: ${rejectionReason}. Por favor envía tus datos de pago nuevamente.`,
        userId: order.client.user.id,
        orderId: id,
      },
    })
  }

  return updatedOrder
}

// ─────────────────────────────────────────────
// CLIENTE — Enviar datos del pago final (saldo restante tras reparación)
// ─────────────────────────────────────────────

export const submitFinalPayment = async (
  orderId: string,
  email: string,
  paymentDetails: Record<string, string>
) => {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { clientId: true },
  })

  if (!user || !user.clientId) {
    throw new Error('Cliente no encontrado para este usuario')
  }

  const order = await prisma.order.findFirst({
    where: { id: orderId, clientId: user.clientId },
  })

  if (!order) {
    throw new Error('Orden no encontrada')
  }

  const updatedOrder = await prisma.order.update({
    where: { id: orderId },
    data: { finalPaymentDetails: paymentDetails },
    include: {
      client: true,
      device: true,
      technician: { select: { id: true, name: true } },
      statusHistory: { orderBy: { createdAt: 'desc' } },
    },
  })

  const admins = await prisma.user.findMany({
    where: { role: 'ADMIN', isActive: true },
    select: { id: true },
  })

  if (admins.length > 0) {
    await prisma.notification.createMany({
      data: admins.map((admin) => ({
        type: 'PAYMENT_CONFIRMED',
        channel: 'PUSH',
        message: `Datos de pago final registrados para la orden #${order.orderNumber}`,
        userId: admin.id,
        orderId,
      })),
    })
  }

  return updatedOrder
}

// ─────────────────────────────────────────────
// ADMIN — Confirmar o rechazar el pago final (Fase 4 — comisión)
// Al aprobar: orden pasa a DELIVERED y se calcula la comisión del técnico:
//   comisión = deliveryAmount (100%) + 40% × (budget - revisionAmount)
// Al rechazar: se guarda el motivo, se limpian los datos de pago viejos
// (Prisma.JsonNull) para que el cliente reenvíe.
// ─────────────────────────────────────────────

export const confirmFinalPayment = async (
  id: string,
  approved: boolean,
  rejectionReason?: string
) => {
  const order = await prisma.order.findUnique({
    where: { id },
    include: { client: { include: { user: true } } },
  })

  if (!order) {
    throw new Error('Orden no encontrada')
  }

  let commission: number | null = null
  if (approved) {
    const budget = order.budget ? Number(order.budget) : 0
    const deliveryAmount = order.deliveryAmount ? Number(order.deliveryAmount) : 0
    const revisionAmount = order.revisionAmount ? Number(order.revisionAmount) : 0
    const laborCommission = 0.4 * (budget - revisionAmount)
    commission = deliveryAmount + laborCommission
  }

  const updatedOrder = await prisma.order.update({
    where: { id },
    data: {
      finalPaymentConfirmed: approved,
      finalPaymentConfirmedAt: approved ? new Date() : null,
      finalPaymentRejectionReason: approved ? null : rejectionReason,
      technicianCommission: approved ? commission : null,
      ...(approved
        ? {}
        : { finalPaymentDetails: Prisma.JsonNull }),
      status: approved ? 'DELIVERED' : 'READY',
      deliveredAt: approved ? new Date() : null,
      statusHistory: {
        create: {
          status: approved ? 'DELIVERED' : 'READY',
          comment: approved
            ? `Pago final confirmado por el administrador. Comisión del técnico: $${commission?.toFixed(2)}`
            : `Pago final rechazado: ${rejectionReason}`,
        },
      },
    },
    include: {
      client: true,
      device: true,
      technician: { select: { id: true, name: true } },
      statusHistory: { orderBy: { createdAt: 'desc' } },
    },
  })

  if (approved && order.technicianId) {
    await decrementTechnicianLoad(order.technicianId)
  }

  if (order.client.user) {
    await prisma.notification.create({
      data: {
        type: 'PAYMENT_CONFIRMED',
        channel: 'PUSH',
        message: approved
          ? `Tu pago fue confirmado. La orden #${order.orderNumber} fue completada. ¡Gracias por confiar en RepTel!`
          : `No pudimos confirmar tu pago final para la orden #${order.orderNumber}: ${rejectionReason}. Por favor envía tus datos de pago nuevamente.`,
        userId: order.client.user.id,
        orderId: id,
      },
    })
  }

  return updatedOrder
}

// ─────────────────────────────────────────────
// TÉCNICO — Historial de sus órdenes asignadas (Fase 4)
// ─────────────────────────────────────────────

export const getOrdersByTechnician = async (technicianId: string) => {
  return await prisma.order.findMany({
    where: { technicianId },
    include: {
      client: true,
      device: true,
      serviceCatalog: true,
      statusHistory: { orderBy: { createdAt: 'desc' } },
    },
    orderBy: { receivedAt: 'desc' },
  })
}