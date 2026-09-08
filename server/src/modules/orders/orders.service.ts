import { Prisma } from '@prisma/client'
import prisma from '../../lib/prisma'

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
      advancePaymentSubmissions: { orderBy: { createdAt: 'desc' } },
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
      advancePaymentSubmissions: { orderBy: { createdAt: 'desc' } },
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

  const resolvedTechnicianId = data.technicianId ?? (await assignTechnician())

  const order = await prisma.order.create({
    data: {
      orderNumber,
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
// PAGO ANTICIPADO EN PARTES (abonos)
// Mismo patrón que ProductOrderPaymentSubmission: el cliente decide
// libremente cuántos pagos hace y de qué monto, cada envío es un registro
// independiente, y no puede enviar más de lo que falta para completar el
// total ($25 = ADVANCE_DELIVERY_AMOUNT + ADVANCE_REVISION_AMOUNT). Al
// confirmarse abonos que suman el total, la orden pasa a RECEIVED sola.
// ─────────────────────────────────────────────

export const submitAdvancePaymentInstallment = async (
  orderId: string,
  email: string,
  paymentDetails: Record<string, string>,
  amount: number
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
    include: {
      // Se cuentan CONFIRMED y PENDING para calcular lo disponible, así el
      // cliente nunca puede enviar de más aunque haya abonos sin revisar.
      advancePaymentSubmissions: { where: { status: { in: ['CONFIRMED', 'PENDING'] } } },
    },
  })

  if (!order) {
    throw new Error('Orden no encontrada')
  }

  if (amount == null || amount <= 0) {
    throw new Error('El monto del pago debe ser mayor a cero')
  }

  const total =
    Number(order.deliveryAmount ?? ADVANCE_DELIVERY_AMOUNT) +
    Number(order.revisionAmount ?? ADVANCE_REVISION_AMOUNT)
  const alreadyAccounted = order.advancePaymentSubmissions.reduce(
    (sum, s) => sum + Number(s.amount),
    0
  )
  const remaining = total - alreadyAccounted

  if (amount > remaining + 0.009) {
    throw new Error(
      `El monto excede lo pendiente por pagar. Restante: $${remaining.toFixed(2)}`
    )
  }

  const submission = await prisma.advancePaymentSubmission.create({
    data: { orderId, amount, paymentDetails },
  })

  return submission
}

export const confirmAdvancePaymentInstallment = async (
  submissionId: string,
  approved: boolean,
  rejectionReason?: string,
  actorEmail?: string
) => {
  const actor = actorEmail
    ? await prisma.user.findUnique({ where: { email: actorEmail }, select: { id: true } })
    : null

  const submission = await prisma.advancePaymentSubmission.findUnique({
    where: { id: submissionId },
    include: {
      order: {
        include: {
          client: { include: { user: true } },
          advancePaymentSubmissions: { where: { status: 'CONFIRMED' } },
        },
      },
    },
  })

  if (!submission) {
    throw new Error('Abono de pago no encontrado')
  }

  if (submission.status !== 'PENDING') {
    throw new Error('Este abono ya fue procesado')
  }

  if (!approved && !rejectionReason) {
    throw new Error('rejectionReason es requerido cuando se rechaza el abono')
  }

  const order = submission.order
  const total =
    Number(order.deliveryAmount ?? ADVANCE_DELIVERY_AMOUNT) +
    Number(order.revisionAmount ?? ADVANCE_REVISION_AMOUNT)

  const updatedOrder = await prisma.$transaction(async (tx) => {
    await tx.advancePaymentSubmission.update({
      where: { id: submissionId },
      data: {
        status: approved ? 'CONFIRMED' : 'REJECTED',
        rejectionReason: approved ? null : rejectionReason,
        confirmedAt: approved ? new Date() : null,
        confirmedByUserId: actor?.id,
      },
    })

    if (approved) {
      const alreadyConfirmed = order.advancePaymentSubmissions.reduce(
        (sum, s) => sum + Number(s.amount),
        0
      )
      const newTotalConfirmed = alreadyConfirmed + Number(submission.amount)
      const orderNowComplete = newTotalConfirmed + 0.009 >= total

      if (orderNowComplete) {
        return await tx.order.update({
          where: { id: order.id },
          data: {
            status: 'RECEIVED',
            statusHistory: {
              create: {
                status: 'RECEIVED',
                comment: `Anticipo de $${total} completado mediante abonos — confirmado por el administrador`,
                userId: actor?.id,
              },
            },
          },
          include: {
            client: true,
            device: true,
            statusHistory: { orderBy: { createdAt: 'desc' } },
            advancePaymentSubmissions: true,
          },
        })
      }
    }

    return await tx.order.findUniqueOrThrow({
      where: { id: order.id },
      include: {
        client: true,
        device: true,
        statusHistory: { orderBy: { createdAt: 'desc' } },
        advancePaymentSubmissions: true,
      },
    })
  })

  return updatedOrder
}

// ─────────────────────────────────────────────
// ÓRDENES — ACTUALIZACIÓN
// ─────────────────────────────────────────────

export const updateOrderStatus = async (
  id: string,
  status: string,
  comment?: string,
  technicianId?: string,
  actorEmail?: string,
  expectedVersion?: number
) => {
  const actor = actorEmail
    ? await prisma.user.findUnique({ where: { email: actorEmail }, select: { id: true } })
    : null

  if (expectedVersion !== undefined) {
    const current = await prisma.order.findUniqueOrThrow({ where: { id }, select: { version: true } })
    if (current.version !== expectedVersion) {
      throw new Error('La orden fue modificada por otro usuario, recarga e intenta de nuevo')
    }
  }

  const order = await prisma.order.update({
    where: { id },
    data: {
      status: status as any,
      version: { increment: 1 },
      ...(technicianId && { technicianId }),
      ...(status === 'DELIVERED' && { deliveredAt: new Date() }),
      statusHistory: {
        create: {
          status: status as any,
          comment,
          userId: actor?.id,
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
  // El cliente decide siempre, incluso con budget=$0. No hay auto-aprobación.
  const hasCost = budget > 0
  const nextStatus = 'WAITING_APPROVAL'

  return await prisma.order.update({
    where: { id },
    data: {
      diagnosis,
      budget,
      budgetApproved: undefined,
      serviceCatalogId: serviceCatalogId ?? null,
      status: nextStatus,
      statusHistory: {
        create: {
          status: nextStatus,
          comment: hasCost
            ? `Diagnóstico registrado por el técnico. Presupuesto: $${budget}`
            : `Diagnóstico registrado por el técnico. Sin costo — cliente debe confirmar.`,
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

  return updatedOrder
}

// ─────────────────────────────────────────────
// ADMIN — Cerrar una orden con presupuesto $0 (diagnóstico sin costo)
// No hay saldo que el cliente deba pagar ni aprobar, así que este cierre
// no pasa por confirmFinalPayment. La comisión del técnico, en este caso,
// no sigue la fórmula normal (delivery + 40% × (presupuesto - revisión)),
// porque con presupuesto $0 esa resta da negativo — el técnico sí hizo el
// diagnóstico, así que cobra el delivery completo + 40% del monto de
// revisión ($15), en vez de que se le reste.
// ─────────────────────────────────────────────

export const closeZeroBudgetOrder = async (id: string) => {
  const order = await prisma.order.findUnique({
    where: { id },
  })

  if (!order) {
    throw new Error('Orden no encontrada')
  }

  if (order.status === 'DELIVERED' || order.status === 'CANCELLED') {
    throw new Error('Esta orden ya fue cerrada')
  }

  const budget = order.budget != null ? Number(order.budget) : null
  if (budget !== 0) {
    throw new Error('Esta acción solo aplica a órdenes con presupuesto $0')
  }

  const deliveryAmount = order.deliveryAmount ? Number(order.deliveryAmount) : 0
  const revisionAmount = order.revisionAmount ? Number(order.revisionAmount) : 0
  const commission = deliveryAmount + 0.4 * revisionAmount

  const updatedOrder = await prisma.order.update({
    where: { id },
    data: {
      finalPaymentConfirmed: true,
      finalPaymentConfirmedAt: new Date(),
      technicianCommission: commission,
      status: 'DELIVERED',
      deliveredAt: new Date(),
      statusHistory: {
        create: {
          status: 'DELIVERED',
          comment: `Orden cerrada sin costo (diagnóstico sin reparación). Comisión del técnico: $${commission.toFixed(2)}`,
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

  if (order.technicianId) {
    await decrementTechnicianLoad(order.technicianId)
  }

  return updatedOrder
}

// ─────────────────────────────────────────────
// CLIENTE — Aprobar o rechazar el presupuesto (Fase 5)
// La orden queda en WAITING_APPROVAL tras el diagnóstico del técnico
// (submitDiagnosis con budget > 0). El cliente decide en la app — coincide
// con la Figura 5 del Trabajo de Grado ("¿Cliente aprueba el presupuesto
// en la app?"). Spec completa:
// docs/design-plans/2026-08-16-rechazo-presupuesto-flujo.md
// ─────────────────────────────────────────────

export const approveBudget = async (id: string, email: string) => {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, clientId: true },
  })
  if (!user || !user.clientId) {
    throw new Error('Cliente no encontrado para este usuario')
  }

  const order = await prisma.order.findFirst({
    where: { id, clientId: user.clientId },
  })
  if (!order) {
    throw new Error('Orden no encontrada')
  }
  if (order.status !== 'WAITING_APPROVAL') {
    throw new Error('Esta acción solo aplica a órdenes esperando aprobación de presupuesto')
  }

  return await prisma.order.update({
    where: { id },
    data: {
      budgetApproved: true,
      status: 'APPROVED',
      statusHistory: {
        create: {
          status: 'APPROVED',
          comment: `Presupuesto de $${order.budget} aprobado por el cliente en la app`,
          userId: user.id,
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
}

// Cuando el cliente rechaza: la revisión ($15) y el delivery ($10) ya están
// cobrados (se pagaron antes de despachar al técnico), así que no hay nada
// más que cobrar ni reembolsar. La comisión del técnico usa la misma
// fórmula que closeZeroBudgetOrder (delivery + 40% de la revisión) — no
// depende de cuál era el presupuesto rechazado, porque el técnico sí hizo
// el trabajo de diagnóstico/revisión, solo que el cliente no siguió con la
// reparación.
export const rejectBudget = async (id: string, email: string, reason: string) => {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, clientId: true },
  })
  if (!user || !user.clientId) {
    throw new Error('Cliente no encontrado para este usuario')
  }

  const order = await prisma.order.findFirst({
    where: { id, clientId: user.clientId },
  })
  if (!order) {
    throw new Error('Orden no encontrada')
  }
  if (order.status !== 'WAITING_APPROVAL') {
    throw new Error('Esta acción solo aplica a órdenes esperando aprobación de presupuesto')
  }

  const deliveryAmount = order.deliveryAmount ? Number(order.deliveryAmount) : 0
  const revisionAmount = order.revisionAmount ? Number(order.revisionAmount) : 0
  const commission = deliveryAmount + 0.4 * revisionAmount

  const updatedOrder = await prisma.order.update({
    where: { id },
    data: {
      budgetApproved: false,
      finalPaymentConfirmed: true,
      finalPaymentConfirmedAt: new Date(),
      technicianCommission: commission,
      status: 'CANCELLED',
      statusHistory: {
        create: {
          status: 'CANCELLED',
          comment: `Cliente rechazó el presupuesto de $${order.budget}. Motivo: ${reason}. Comisión del técnico: $${commission.toFixed(2)} (delivery + 40% revisión).`,
          userId: user.id,
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

  if (order.technicianId) {
    await decrementTechnicianLoad(order.technicianId)
  }

  return updatedOrder
}

// ─────────────────────────────────────────────
// Cliente confirma diagnóstico $0
// ─────────────────────────────────────────────

// Cliente confirma que no hay nada que reparar (budget=0). Mismo cálculo de
// comisión que closeZeroBudgetOrder (ADMIN), pero disparado por el cliente.
export const confirmZeroBudgetDiagnosis = async (id: string, email: string) => {
  const user = await prisma.user.findUnique({ where: { email }, select: { clientId: true } })
  if (!user || !user.clientId) throw new Error('Cliente no encontrado para este usuario')

  const order = await prisma.order.findFirst({ where: { id, clientId: user.clientId } })
  if (!order) throw new Error('Orden no encontrada')
  if (order.status !== 'WAITING_APPROVAL') {
    throw new Error('Esta acción solo aplica a órdenes esperando aprobación de presupuesto')
  }
  if (order.budget == null || Number(order.budget) !== 0) {
    throw new Error('Esta acción solo aplica a diagnósticos sin costo')
  }

  const deliveryAmount = order.deliveryAmount ? Number(order.deliveryAmount) : 0
  const revisionAmount = order.revisionAmount ? Number(order.revisionAmount) : 0
  const commission = deliveryAmount + 0.4 * revisionAmount

  const updatedOrder = await prisma.order.update({
    where: { id },
    data: {
      budgetApproved: true,
      finalPaymentConfirmed: true,
      finalPaymentConfirmedAt: new Date(),
      technicianCommission: commission,
      status: 'DELIVERED',
      deliveredAt: new Date(),
      statusHistory: {
        create: {
          status: 'DELIVERED',
          comment: `Cliente confirmó el diagnóstico — no requiere reparación. Comisión del técnico: $${commission.toFixed(2)}.`,
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

  if (order.technicianId) {
    await decrementTechnicianLoad(order.technicianId)
  }

  return updatedOrder
}

// Cliente no está de acuerdo con el diagnóstico $0 — la orden vuelve al
// técnico para una nueva revisión. Se incrementa la carga porque la orden
// vuelve a estar activa.
export const disputeZeroBudgetDiagnosis = async (id: string, email: string, note?: string) => {
  const user = await prisma.user.findUnique({ where: { email }, select: { clientId: true } })
  if (!user || !user.clientId) throw new Error('Cliente no encontrado para este usuario')

  const order = await prisma.order.findFirst({ where: { id, clientId: user.clientId } })
  if (!order) throw new Error('Orden no encontrada')
  if (order.status !== 'WAITING_APPROVAL') {
    throw new Error('Esta acción solo aplica a órdenes esperando aprobación de presupuesto')
  }
  if (order.budget == null || Number(order.budget) !== 0) {
    throw new Error('Esta acción solo aplica a diagnósticos sin costo')
  }

  return await prisma.order.update({
    where: { id },
    data: {
      budget: null,
      diagnosis: null,
      status: 'RECEIVED',
      statusHistory: {
        create: {
          status: 'RECEIVED',
          comment: `Cliente no estuvo de acuerdo con el diagnóstico (sin costo) — solicitó nueva revisión.${note ? ` Nota: ${note}` : ''}`,
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