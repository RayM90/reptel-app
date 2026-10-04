import { Prisma, type Order } from '@prisma/client'
import prisma, { type ExtendedTransactionClient } from '../../lib/prisma'
import { InsufficientStockError } from '../products/products.service'
import { flattenClientAddresses } from '../../lib/clientAddress'
import { computeRepairMinimum, computeExtraPartsPending, sumPartsCost, buildPaymentSummary } from './repairMinimum'

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
// Cada cargo cubre su propio lugar — TECHNICIAN (mostrador) nunca se mezcla
// con TECHNICIAN_DELIVERY (motorizado), ni al revés, sin importar si el
// otro cargo tiene gente libre. Si nadie del cargo correcto está disponible
// (ni siquiera ocupado bajo su límite), la orden queda sin asignar — pasa a
// "en cola", ver hasPendingAssignment/statusBadge.ts en el frontend.
// Se elige al de menos carga entre los que están bajo su límite; si nadie
// lo está → null (en cola, esperando que alguien de ese cargo se libere).
//
// La carga se CUENTA desde las órdenes reales (syncTechnicianLoad), no se
// suma y resta: un contador incremental se desfasa si una orden se borra a
// mano o un test deja datos a medias, y el técnico queda "SATURATED" sin
// tener nada (incidente del 2026-09-23).
// ─────────────────────────────────────────────

// Estados en los que la orden ya no ocupa al técnico — los mismos puntos en
// los que antes se llamaba a decrementTechnicianLoad (pago completo, rechazo
// del presupuesto, entrega, cancelación).
const LOAD_RELEASED_STATUSES = ['PAID_PENDING_DELIVERY', 'REJECTED_PENDING_PICKUP', 'DELIVERED', 'CANCELLED'] as const

export const syncTechnicianLoad = async (technicianId: string) => {
  const technician = await prisma.user.findUnique({
    where: { id: technicianId },
  })

  if (!technician) return null

  const activeOrderCount = await prisma.order.count({
    where: { technicianId, status: { notIn: [...LOAD_RELEASED_STATUSES] } },
  })
  // ABSENT lo fija una persona, no la carga — se respeta.
  const technicianStatus =
    technician.technicianStatus === 'ABSENT'
      ? 'ABSENT'
      : activeOrderCount === 0
        ? 'AVAILABLE'
        : activeOrderCount >= technician.maxOrderCapacity
          ? 'SATURATED'
          : 'BUSY'

  return await prisma.user.update({
    where: { id: technicianId },
    data: { activeOrderCount, technicianStatus },
  })
}

const assignTechnician = async (role: 'TECHNICIAN' | 'TECHNICIAN_DELIVERY'): Promise<string | null> => {
  const technicians = await prisma.user.findMany({
    where: { role, isActive: true },
    orderBy: { updatedAt: 'asc' },
    select: { id: true },
  })

  const synced = []
  for (const t of technicians) {
    const s = await syncTechnicianLoad(t.id)
    if (s) synced.push(s)
  }

  // sort es estable: a igual carga gana el que lleva más tiempo sin cambios.
  const candidates = synced
    .filter((t) => t.technicianStatus !== 'ABSENT' && t.activeOrderCount < t.maxOrderCapacity)
    .sort((a, b) => a.activeOrderCount - b.activeOrderCount)

  return candidates[0]?.id ?? null
}

const incrementTechnicianLoad = async (technicianId: string) => {
  await syncTechnicianLoad(technicianId)
}

export const decrementTechnicianLoad = async (technicianId: string) => {
  const technician = await syncTechnicianLoad(technicianId)

  if (!technician) return

  // Este técnico acaba de liberar capacidad — si hay una orden de su mismo
  // cargo esperando en cola (sin técnico asignado porque nadie estaba libre
  // cuando se creó), se la asignamos ahora mismo, sin esperar a que un
  // admin lo note. FIFO: la más antigua primero. Solo si de verdad tiene
  // cupo según sus órdenes reales.
  if (
    (technician.role === 'TECHNICIAN' || technician.role === 'TECHNICIAN_DELIVERY') &&
    technician.technicianStatus !== 'ABSENT' &&
    technician.activeOrderCount < technician.maxOrderCapacity
  ) {
    await tryAssignQueuedOrder(technicianId, technician.role)
  }
}

// La orden de mostrador (equipo ya en el local, deliveryAmount null) solo
// puede ir a un TECHNICIAN; la de self-service+delivery (deliveryAmount no
// nulo) solo a un TECHNICIAN_DELIVERY — mismo criterio que assignTechnician.
const tryAssignQueuedOrder = async (technicianId: string, role: 'TECHNICIAN' | 'TECHNICIAN_DELIVERY') => {
  const queuedOrder = await prisma.order.findFirst({
    where: {
      technicianId: null,
      status: { notIn: ['DELIVERED', 'CANCELLED'] },
      deliveryAmount: role === 'TECHNICIAN_DELIVERY' ? { not: null } : null,
    },
    orderBy: { receivedAt: 'asc' },
  })

  if (!queuedOrder) return

  await prisma.order.update({
    where: { id: queuedOrder.id },
    data: {
      technicianId,
      statusHistory: {
        create: {
          status: queuedOrder.status,
          comment: 'Técnico asignado automáticamente al liberarse capacidad — la orden estaba en cola.',
        },
      },
    },
  })

  await incrementTechnicianLoad(technicianId)
}

// ─────────────────────────────────────────────
// ÓRDENES — CONSULTAS
// ─────────────────────────────────────────────

// La dirección del cliente vive en ClientAddress. Se incluye y se aplana la
// principal en `client` (mismo shape que /api/clients) para que el
// motorizado sepa a dónde ir y el modal del admin la muestre.
const CLIENT_WITH_ADDRESSES = { include: { addresses: true } } as const

const withClientAddress = <T extends { client: Record<string, any> }>(order: T) => ({
  ...order,
  client: flattenClientAddresses(order.client),
})

// Repuestos que cuentan para el presupuesto: salidas de servicio técnico no
// revertidas ni reportadas como merma (la merma no se cobra al cliente).
const ACTIVE_PARTS_WHERE = {
  type: 'OUT',
  channel: 'SERVICIO_TECNICO',
  reversedAt: null,
  lossReportedAt: null,
} satisfies Prisma.InventoryMovementWhereInput

const budgetPaidWithStatus = (subs: { kind: string; status: string; amount: unknown }[], status: string) =>
  subs.filter((s) => s.kind === 'BUDGET' && s.status === status).reduce((sum, s) => sum + Number(s.amount), 0)

// Resumen "Presupuesto · Pagado · Te falta" + mínimo para reparar — se
// calcula acá para que la app y el panel no repitan la regla.
const paymentSummaryFor = (order: {
  status: string
  budget: unknown
  revisionAmount: unknown
  advancePaymentSubmissions: { kind: string; status: string; amount: unknown }[]
  inventoryMovements: { quantity: number; unitPriceAtUse: unknown }[]
}) =>
  buildPaymentSummary({
    budget: order.budget,
    revisionAmount: Number(order.revisionAmount ?? ADVANCE_REVISION_AMOUNT),
    confirmedBudgetPaid: budgetPaidWithStatus(order.advancePaymentSubmissions, 'CONFIRMED'),
    pendingBudgetPaid: budgetPaidWithStatus(order.advancePaymentSubmissions, 'PENDING'),
    partsCost: sumPartsCost(order.inventoryMovements),
    awaitingExtraPayment: order.status === 'WAITING_EXTRA_PAYMENT',
  })

export const getAllOrders = async () => {
  const orders = await prisma.order.findMany({
    include: {
      client: CLIENT_WITH_ADDRESSES,
      technician: { select: { id: true, name: true, email: true } },
      device: true,
      statusHistory: { orderBy: { createdAt: 'desc' } },
      advancePaymentSubmissions: { orderBy: { createdAt: 'desc' } },
      inventoryMovements: { where: ACTIVE_PARTS_WHERE, select: { quantity: true, unitPriceAtUse: true } },
    },
    orderBy: { receivedAt: 'desc' },
  })
  return orders.map(({ inventoryMovements, ...order }) =>
    withClientAddress({ ...order, paymentSummary: paymentSummaryFor({ ...order, inventoryMovements }) })
  )
}

export const getTodayOrders = async () => {
  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)

  const endOfDay = new Date()
  endOfDay.setHours(23, 59, 59, 999)

  const orders = await prisma.order.findMany({
    where: {
      receivedAt: {
        gte: startOfDay,
        lte: endOfDay,
      },
    },
    include: {
      client: CLIENT_WITH_ADDRESSES,
      technician: { select: { id: true, name: true } },
      device: true,
      statusHistory: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
    orderBy: { receivedAt: 'desc' },
  })
  return orders.map(withClientAddress)
}

export const getOrderById = async (id: string) => {
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      client: CLIENT_WITH_ADDRESSES,
      technician: { select: { id: true, name: true, email: true } },
      device: true,
      statusHistory: { orderBy: { createdAt: 'desc' } },
      advancePaymentSubmissions: { orderBy: { createdAt: 'desc' } },
      inventoryMovements: { where: ACTIVE_PARTS_WHERE, select: { quantity: true, unitPriceAtUse: true } },
    },
  })
  if (!order) return null
  const { inventoryMovements, ...rest } = order
  return withClientAddress({ ...rest, paymentSummary: paymentSummaryFor({ ...rest, inventoryMovements }) })
}

export const getOrderByNumber = async (orderNumber: string) => {
  return await prisma.order.findUnique({
    where: { orderNumber },
    // Endpoint público (sin autenticación): solo lo necesario para que el
    // cliente siga su orden. Nada de montos, pagos, comisión, diagnóstico,
    // teléfono/apellido ni la contraseña del equipo.
    select: {
      orderNumber: true,
      status: true,
      receivedAt: true,
      deliveredAt: true,
      updatedAt: true,
      client: { select: { name: true } },
      device: { select: { type: true, brand: true, model: true } },
      statusHistory: { select: { status: true, createdAt: true }, orderBy: { createdAt: 'desc' } },
    },
  })
}

export const getOrdersByClient = async (clientId: string) => {
  const orders = await prisma.order.findMany({
    where: { clientId },
    include: {
      device: true,
      technician: { select: { id: true, name: true, lastName: true, phone: true } },
      statusHistory: { orderBy: { createdAt: 'desc' } },
      advancePaymentSubmissions: { orderBy: { createdAt: 'desc' } },
      inventoryMovements: {
        where: ACTIVE_PARTS_WHERE,
        include: { product: { select: { name: true } } },
      },
    },
    orderBy: { receivedAt: 'desc' },
  })

  return orders.map(({ inventoryMovements, technician, ...order }) => ({
    ...order,
    // El cliente ve el contacto del técnico recién cuando el pago del
    // anticipo está confirmado — antes todavía no hay nada que coordinar.
    technician: order.status === 'PENDING_PAYMENT' ? null : technician,
    paymentSummary: paymentSummaryFor({ ...order, inventoryMovements }),
    partsUsed: inventoryMovements.map((m) => ({
      productName: m.product.name,
      quantity: m.quantity,
      unitPriceAtUse: m.unitPriceAtUse,
    })),
  }))
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

  const resolvedTechnicianId = data.technicianId ?? (await assignTechnician('TECHNICIAN_DELIVERY'))

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

  // Self-service+delivery: el equipo hay que ir a buscarlo, solo un
  // motorizado puede tomarlo — nunca un técnico de mostrador.
  const resolvedTechnicianId = await assignTechnician('TECHNICIAN_DELIVERY')

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
// ÓRDENES — CREACIÓN EN RECEPCIÓN
// El cliente está presente y reporta en persona el pago de la revisión; la
// orden nace en PENDING_PAYMENT, igual que la de la app, y pasa a RECEIVED
// cuando el admin confirma el pago. No hay costo de delivery.
// ─────────────────────────────────────────────

export const createCounterOrder = async (data: {
  actorEmail: string
  clientId: string
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
  paymentDetails: Record<string, string>
  amount?: number // permite abonar por partes — default: el total de la revisión
  serviceCatalogId?: string
}) => {
  const actor = await prisma.user.findUnique({ where: { email: data.actorEmail } })

  const orderNumber = generateOrderNumber()
  // Mostrador: el equipo ya está en el local — solo un técnico de mostrador
  // puede tomarla, nunca un motorizado (aunque esté libre).
  const resolvedTechnicianId = await assignTechnician('TECHNICIAN')

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
        clientId: data.clientId,
        deviceId: device.id,
        problem: data.problem,
        observations: data.observations,
        technicianId: resolvedTechnicianId,
        status: 'PENDING_PAYMENT',
        revisionAmount: ADVANCE_REVISION_AMOUNT,
        advancePaymentMethod: data.advancePaymentMethod as any,
        serviceCatalogId: data.serviceCatalogId ?? null,
        statusHistory: {
          create: {
            status: 'PENDING_PAYMENT',
            comment: `Orden creada en Recepción por ${actor ? `${actor.name} ${actor.lastName ?? ''}`.trim() : 'personal de Recepción'} — abono de $${data.amount ?? ADVANCE_REVISION_AMOUNT} reportado, pendiente de confirmar por el administrador`,
            userId: actor?.id,
          },
        },
        // Mismo flujo que el self-service: el staff de recepción reporta los
        // datos del pago, pero queda PENDING hasta que un ADMIN lo confirme
        // desde el Dashboard (PaymentSubmissionsView) — no se auto-confirma.
        // `amount` puede ser menor al total: el resto se abona después con
        // submitCounterAdvanceInstallment (pago por partes, igual que self-service).
        advancePaymentSubmissions: {
          create: {
            amount: data.amount ?? ADVANCE_REVISION_AMOUNT,
            paymentDetails: data.paymentDetails,
            status: 'PENDING',
          },
        },
      },
      include: {
        client: true,
        device: true,
        technician: { select: { id: true, name: true, lastName: true } },
        statusHistory: true,
        advancePaymentSubmissions: true,
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
// El cliente decide libremente cuántos pagos hace y de qué monto, cada envío es un registro
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
      // Filtrado por kind: REVISION — el anticipo del presupuesto (Task 3)
      // usa su propio pool, no deben mezclarse.
      advancePaymentSubmissions: { where: { status: { in: ['CONFIRMED', 'PENDING'] }, kind: 'REVISION' } },
    },
  })

  if (!order) {
    throw new Error('Orden no encontrada')
  }

  // Orden de mostrador (sin delivery): la revisión se cobra en el local y la
  // registra el personal (submitCounterAdvanceInstallment), no el cliente.
  if (order.deliveryAmount == null) {
    throw new Error('Las órdenes de mostrador se pagan en el local')
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
    data: { orderId, amount, paymentDetails, kind: 'REVISION' },
  })

  return submission
}

// ─────────────────────────────────────────────
// CLIENTE — Anticipo del presupuesto (pagar es aprobar). Base = budget -
// revisionAmount (la revisión ya está pagada y no se vuelve a cobrar),
// mínimo = computeRepairMinimum (50% o lo que cubra los repuestos), tope =
// 100% de esa base. El resto se cobra al entregar (confirmFinalPayment, ya
// existente).
// ─────────────────────────────────────────────

export const submitBudgetPaymentInstallment = async (
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
      advancePaymentSubmissions: { where: { status: { in: ['CONFIRMED', 'PENDING'] }, kind: 'BUDGET' } },
    },
  })

  if (!order) {
    throw new Error('Orden no encontrada')
  }

  if (order.status !== 'WAITING_APPROVAL' && order.status !== 'WAITING_EXTRA_PAYMENT') {
    throw new Error('Esta acción solo aplica a órdenes esperando aprobación de presupuesto o el pago de un repuesto adicional')
  }

  if (amount == null || amount <= 0) {
    throw new Error('El monto del pago debe ser mayor a cero')
  }

  const base = Number(order.budget ?? 0) - Number(order.revisionAmount ?? ADVANCE_REVISION_AMOUNT)

  // budget <= revisionAmount (ej. un trabajo de $15 igual a la revisión ya
  // pagada) → no hay nada que cobrar por esta vía; la orden debe cerrarse por
  // el camino de "diagnóstico sin costo adicional" (confirmZeroBudgetDiagnosis/
  // disputeZeroBudgetDiagnosis en el cliente, onCloseZeroBudgetOrder en el
  // admin), no por un abono.
  if (base <= 0) {
    throw new Error('Esta acción no aplica — el presupuesto no supera el costo de la revisión ya pagada')
  }

  // El cliente puede abonar en partes hasta completar el 100% de la base si
  // lo desea, pero nunca más de eso — el mínimo para autorizar la reparación
  // (ver repairMinimum.ts) se exige aparte, en confirmAdvancePaymentInstallment.
  const alreadyAccounted = order.advancePaymentSubmissions.reduce(
    (sum, s) => sum + Number(s.amount),
    0
  )
  const remaining = base - alreadyAccounted

  if (amount > remaining + 0.009) {
    throw new Error(
      `El monto excede lo pendiente por pagar. Restante: $${remaining.toFixed(2)}`
    )
  }

  const submission = await prisma.advancePaymentSubmission.create({
    data: { orderId, amount, paymentDetails, kind: 'BUDGET' },
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
          inventoryMovements: { where: ACTIVE_PARTS_WHERE },
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
  const isBudgetKind = submission.kind === 'BUDGET'

  // Órdenes de recepción no tienen deliveryAmount (no hay que ir a buscar el
  // equipo) — su total es solo la revisión, no revisión+delivery como self-service.
  // Para BUDGET: el mínimo para reparar (repairMinimum.ts — 50%, o lo que
  // cubra los repuestos) autoriza a reparar; el resto se cobra al entregar.
  const total = isBudgetKind
    ? computeRepairMinimum(
        Number(order.budget ?? 0) - Number(order.revisionAmount ?? ADVANCE_REVISION_AMOUNT),
        sumPartsCost(order.inventoryMovements)
      ).amount
    : order.deliveryAmount != null
      ? Number(order.deliveryAmount) + Number(order.revisionAmount ?? ADVANCE_REVISION_AMOUNT)
      : Number(order.revisionAmount ?? ADVANCE_REVISION_AMOUNT)

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
      // Pago de la diferencia por un repuesto adicional: la cobertura se
      // recalcula con este abono ya CONFIRMED (se actualizó arriba, en esta
      // misma transacción).
      if (isBudgetKind && order.status === 'WAITING_EXTRA_PAYMENT') {
        await settleExtraPaymentIfCovered(
          tx,
          order.id,
          'Pago del repuesto adicional confirmado — el técnico continúa la reparación',
          actor?.id
        )
        return await tx.order.findUniqueOrThrow({
          where: { id: order.id },
          include: {
            client: true,
            device: true,
            statusHistory: { orderBy: { createdAt: 'desc' } },
            advancePaymentSubmissions: true,
          },
        })
      }

      const alreadyConfirmed = order.advancePaymentSubmissions
        .filter((s) => s.kind === submission.kind)
        .reduce((sum, s) => sum + Number(s.amount), 0)
      const newTotalConfirmed = alreadyConfirmed + Number(submission.amount)
      const orderNowComplete = newTotalConfirmed + 0.009 >= total

      if (orderNowComplete) {
        if (isBudgetKind) {
          // Solo transicionamos si la orden SIGUE esperando aprobación. Si ya
          // se movió (ej. el cliente rechazó el presupuesto — rejectBudget —
          // mientras este abono seguía PENDING), el dinero ya quedó CONFIRMED
          // arriba pero no volvemos a tocar status/budgetApproved/historial:
          // cae al fallback de abajo, que devuelve la orden tal cual está.
          if (order.status === 'WAITING_APPROVAL') {
            // Mínimo del presupuesto completado → pagar ES aprobar, autoriza a
            // reparar de inmediato (reemplaza el approveBudget gratis).
            return await tx.order.update({
              where: { id: order.id },
              data: {
                budgetApproved: true,
                status: 'REPAIRING',
                statusHistory: {
                  create: [
                    {
                      status: 'APPROVED',
                      comment: `Anticipo de presupuesto ($${newTotalConfirmed.toFixed(2)}) completado — confirmado por el administrador`,
                      userId: actor?.id,
                    },
                    {
                      status: 'REPAIRING',
                      comment: 'Anticipo de presupuesto confirmado — técnico autorizado a iniciar la reparación',
                    },
                  ],
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
        } else if (order.status === 'PENDING_PAYMENT') {
          // Pago completo confirmado por el admin → la orden de la app queda
          // con el técnico en camino a retirar el equipo; la de mostrador,
          // con el equipo en tienda esperando que el técnico empiece a
          // revisar. En ningún caso se salta a DIAGNOSING: ese paso lo marca
          // el técnico con "Empecé a revisar" (startReview).
          const isAppOrder = order.deliveryAmount != null
          const nextStatus = isAppOrder ? 'ON_THE_WAY' : 'RECEIVED'
          return await tx.order.update({
            where: { id: order.id },
            data: {
              status: nextStatus,
              statusHistory: {
                create: {
                  status: nextStatus,
                  comment: isAppOrder
                    ? `Anticipo de $${total} confirmado por el administrador — el técnico va en camino a retirar el equipo`
                    : `Anticipo de $${total} confirmado por el administrador — equipo en tienda, técnico asignado`,
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
        // Mostrador heredado (creado antes de este cambio, ya en RECEIVED): el
        // pago queda confirmado arriba y la orden sigue en RECEIVED — no se
        // repite "Recibido" en el historial.
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

const CANCELLABLE_STATUSES = new Set([
  'PENDING_PAYMENT', 'RECEIVED', 'ON_THE_WAY', 'DIAGNOSING', 'WAITING_APPROVAL',
  'APPROVED', 'REPAIRING', 'WAITING_EXTRA_PAYMENT', 'READY',
])

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

  const current = await prisma.order.findUniqueOrThrow({
    where: { id },
    select: { version: true },
  })

  if (expectedVersion !== undefined && current.version !== expectedVersion) {
    throw new Error('La orden fue modificada por otro usuario, recarga e intenta de nuevo')
  }

  // Los estados avanzan solo con sus acciones propias (confirmar pago,
  // "Empecé a revisar", diagnóstico, repuesto adicional, finalizar,
  // entrega). Esta vía genérica queda para que el admin cancele la orden.
  // Antes el técnico tenía un menú libre que permitía aprobar sin pago,
  // retroceder la orden o saltarse el cobro.
  if (status !== 'CANCELLED') {
    throw new Error('Por esta vía solo se puede cancelar la orden — los demás cambios de estado salen de sus acciones propias')
  }

  // Solo se cancela una orden activa: una entregada, ya cancelada, pagada o
  // rechazada no vuelve atrás. El updateMany condicionado evita que dos
  // cancelaciones simultáneas descuenten dos veces la carga del técnico.
  const order = await prisma.$transaction(async (tx) => {
    const updated = await tx.order.updateMany({
      where: { id, status: { in: [...CANCELLABLE_STATUSES] as any } },
      data: { status: 'CANCELLED', version: { increment: 1 } },
    })
    if (updated.count === 0) {
      throw new Error('Esta orden ya no se puede cancelar (está entregada, pagada, rechazada o ya cancelada)')
    }
    await tx.orderStatusHistory.create({
      data: { orderId: id, status: 'CANCELLED', comment, userId: actor?.id },
    })

    // Los repuestos cargados vuelven al stock, igual que al rechazar el
    // presupuesto. Las mermas no vuelven: la pieza se dañó.
    const current = await tx.order.findUniqueOrThrow({ where: { id }, select: { orderNumber: true } })
    const partsToReturn = await tx.inventoryMovement.findMany({
      where: { orderId: id, type: 'OUT', channel: 'SERVICIO_TECNICO', reversedAt: null, lossReportedAt: null },
    })
    for (const part of partsToReturn) {
      await tx.product.update({ where: { id: part.productId }, data: { stock: { increment: part.quantity } } })
      await tx.inventoryMovement.update({
        where: { id: part.id },
        data: { reversedAt: new Date(), reversedByUserId: actor?.id, awaitingClientPayment: false },
      })
      await tx.inventoryMovement.create({
        data: {
          productId: part.productId,
          type: 'IN',
          channel: 'SERVICIO_TECNICO',
          quantity: part.quantity,
          reason: `Reposición — orden ${current.orderNumber} cancelada`,
          userId: actor?.id,
          orderId: id,
        },
      })
    }

    return tx.order.findUniqueOrThrow({
      where: { id },
      include: {
        client: true,
        technician: { select: { id: true, name: true } },
        device: true,
        statusHistory: { orderBy: { createdAt: 'desc' } },
      },
    })
  })

  // DELIVERED ya no puede llegar por acá (ver guarda arriba) — la liberación
  // de carga en ese caso la hace markOrderDelivered/confirmFinalPayment.
  if (status === 'CANCELLED' && order.technicianId) {
    await decrementTechnicianLoad(order.technicianId)
  }

  return order
}

// Comentario de progreso: se registra con el estado en que ya está la orden,
// sin moverla. Solo el técnico asignado o un admin.
export const addOrderComment = async (orderId: string, actorEmail: string, comment: string) => {
  const text = (comment ?? '').trim()
  if (!text) throw new Error('El comentario no puede estar vacío')

  const actor = await prisma.user.findUnique({ where: { email: actorEmail }, select: { id: true, role: true } })
  if (!actor) throw new Error('Usuario no encontrado')

  const order = await prisma.order.findUnique({ where: { id: orderId }, select: { status: true, technicianId: true } })
  if (!order) throw new Error('Orden no encontrada')
  if (actor.role !== 'ADMIN' && order.technicianId !== actor.id) {
    throw new Error('Solo el técnico asignado a esta orden puede comentar')
  }

  return prisma.orderStatusHistory.create({
    data: { orderId, status: order.status, comment: text, userId: actor.id },
  })
}

// NOTA (revisión final — Finding 1b): este endpoint editaba el presupuesto Y
// podía "aprobarlo" gratis (approved: true -> status REPAIRING sin ningún
// pago), atribuyéndolo a "el cliente" en el historial aunque nadie hubiera
// pagado nada. Ningún frontend lo llama así hoy — la aprobación real pasa
// por el anticipo de presupuesto (submitBudgetPaymentInstallment +
// confirmAdvancePaymentInstallment). Se removió el salto de estado gratis;
// este endpoint ahora solo permite corregir el monto del presupuesto,
// sin tocar status ni budgetApproved.
const BUDGET_LOCKED_STATUSES = new Set(['PAID_PENDING_DELIVERY', 'DELIVERED', 'CANCELLED', 'REJECTED_PENDING_PICKUP'])

export const updateOrderBudget = async (id: string, budgetInput: number) => {
  const budget = Number(budgetInput)
  if (!Number.isFinite(budget) || budget < 0) {
    throw new Error('El presupuesto debe ser un número mayor o igual a cero')
  }
  const current = await prisma.order.findUniqueOrThrow({ where: { id }, select: { status: true } })
  if (BUDGET_LOCKED_STATUSES.has(current.status)) {
    throw new Error('No se puede cambiar el presupuesto de una orden pagada, entregada, rechazada o cancelada')
  }

  return await prisma.order.update({
    where: { id },
    data: {
      budget,
      // El historial exige un `status` — no cambiamos el estado de la orden,
      // así que registramos el que ya tenía (no un salto a REPAIRING).
      statusHistory: {
        create: [{ status: current.status, comment: `Presupuesto corregido a $${budget} por el administrador` }],
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
      role: { in: ['TECHNICIAN_DELIVERY', 'TECHNICIAN'] },
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
  serviceCatalogId?: string,
  actorEmail?: string
) => {
  const current = await prisma.order.findUnique({ where: { id }, select: { status: true, technicianId: true } })
  if (!current) throw new Error('Orden no encontrada')
  if (actorEmail) {
    const actor = await prisma.user.findUnique({ where: { email: actorEmail }, select: { id: true } })
    if (!actor || actor.id !== current.technicianId) {
      throw new Error('Solo el técnico asignado a esta orden puede registrar el diagnóstico')
    }
  }
  if (current.status !== 'DIAGNOSING') {
    throw new Error('El diagnóstico solo puede registrarse mientras el técnico está revisando el equipo')
  }

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
// TÉCNICO — "Empecé a revisar"
// El técnico marca que ya tiene el equipo en sus manos (lo retiró en casa
// del cliente, o lo tomó en tienda). Es el único camino a DIAGNOSING.
// ─────────────────────────────────────────────

export const startReview = async (orderId: string, actorEmail: string) => {
  const actor = await prisma.user.findUnique({ where: { email: actorEmail }, select: { id: true } })
  if (!actor) throw new Error('Usuario no encontrado')

  const order = await prisma.order.findUnique({ where: { id: orderId }, select: { technicianId: true } })
  if (!order) throw new Error('Orden no encontrada')
  if (order.technicianId !== actor.id) {
    throw new Error('Solo el técnico asignado a esta orden puede iniciar la revisión')
  }

  // updateMany condicionado al estado: si otra request movió la orden entre
  // la lectura y acá, count da 0 y no se escribe nada.
  const { count } = await prisma.order.updateMany({
    where: { id: orderId, technicianId: actor.id, status: { in: ['ON_THE_WAY', 'RECEIVED'] } },
    data: { status: 'DIAGNOSING', version: { increment: 1 } },
  })
  if (count === 0) {
    throw new Error('La revisión solo puede iniciarse cuando el técnico va en camino o el equipo está en tienda')
  }

  await prisma.orderStatusHistory.create({
    data: { orderId, status: 'DIAGNOSING', comment: 'El técnico comenzó a revisar el equipo', userId: actor.id },
  })

  return getOrderById(orderId)
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
  if (order.status !== 'READY') {
    throw new Error('El pago final solo se puede enviar cuando la reparación está lista')
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
// ADMIN/TECHNICIAN — Registrar el pago final desde el mostrador (equivalente
// a submitCounterAdvanceInstallment, pero para el saldo final). El cliente
// vuelve a buscar el equipo y paga en persona — el personal carga los datos
// en vez de esperar a que el cliente lo haga desde su cuenta. Sin
// verificación de dueño (a diferencia de submitFinalPayment, que sí la tiene
// porque ahí el actor es el propio cliente).
// ─────────────────────────────────────────────

export const submitCounterFinalPayment = async (
  orderId: string,
  paymentDetails: Record<string, string>
) => {
  const order = await prisma.order.findUnique({ where: { id: orderId } })
  if (!order) {
    throw new Error('Orden no encontrada')
  }
  assertCounterOrder(order)
  if (order.status !== 'READY') {
    throw new Error('Esta acción solo aplica a órdenes listas para entrega')
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
// Al aprobar: orden pasa a PAID_PENDING_DELIVERY (el pago ya está confirmado
// y la comisión del técnico ya se calcula aquí, pero el equipo todavía no
// salió del taller — eso lo marca markOrderDelivered en un paso aparte).
//   comisión = deliveryAmount (100%) + 40% × (budget - revisionAmount)
// Al rechazar: se guarda el motivo, se limpian los datos de pago viejos
// (Prisma.JsonNull) para que el cliente reenvíe.
//
// REGISTRO DEL COBRO (Finding A, revisión final): esta función es el camino
// "tradicional" del pago final y históricamente NO dejaba rastro del monto
// cobrado en `advancePaymentSubmission`. Todo el cálculo nuevo de "saldo
// pendiente" (OrderDetailModal, final-payment.tsx, finishRepair,
// addBudgetAdjustment) suma justamente ese pool (kind BUDGET, CONFIRMED), así
// que quedaba ciego a lo cobrado por acá y mostraba saldo pendiente sobre una
// orden ya cobrada. Al aprobar, registramos el saldo que realmente faltaba
// —base menos lo ya confirmado como anticipo, para no duplicar— como un
// AdvancePaymentSubmission CONFIRMED de kind BUDGET, dentro de la misma
// transacción que la actualización de la orden.
//
// CONCURRENCIA (Finding 2, re-revisión): toda la lectura vive dentro de la
// transacción y la transición se escribe con updateMany condicionado a
// status READY (y, al aprobar, al budget recién leído), igual que finishRepair.
// ─────────────────────────────────────────────

// Mensaje único para la guarda de concurrencia del pago final — viaja en la
// respuesta 400 del controller para que el admin sepa que debe recargar y
// reintentar en vez de asumir que el cobro quedó registrado.
export const CONCURRENT_FINAL_PAYMENT_ERROR =
  'La orden cambió mientras se procesaba el pago final (estado o presupuesto) — recarga e intenta de nuevo'

export const confirmFinalPayment = async (
  id: string,
  approved: boolean,
  rejectionReason?: string
) => {
  const { updatedOrder, technicianId } = await prisma.$transaction(async (tx) => {
    // Finding 2 (re-revisión): la lectura que alimenta la comisión y el
    // registro del cobro ocurre DENTRO de la transacción (mismo patrón que
    // finishRepair, Finding C). Antes se leía con findUnique fuera de la tx y
    // el update final no verificaba nada: un addBudgetAdjustment concurrente
    // dejaba la comisión y el AdvancePaymentSubmission calculados sobre un
    // budget viejo.
    const order = await tx.order.findUnique({
      where: { id },
      include: {
        advancePaymentSubmissions: { where: { kind: 'BUDGET', status: 'CONFIRMED' } },
      },
    })

    if (!order) {
      throw new Error('Orden no encontrada')
    }

    if (approved) {
      const budget = order.budget ? Number(order.budget) : 0
      const deliveryAmount = order.deliveryAmount ? Number(order.deliveryAmount) : 0
      const revisionAmount = order.revisionAmount ? Number(order.revisionAmount) : 0
      const commission = deliveryAmount + 0.4 * (budget - revisionAmount)

      // updateMany condicionado al status Y al budget recién leídos: si otra
      // request transicionó la orden —o le sumó un ajuste al presupuesto sin
      // tocar el status (addBudgetAdjustment en READY)— entre la lectura de
      // arriba y este punto, count da 0 y abortamos en vez de cobrar/comisionar
      // sobre datos viejos.
      const { count } = await tx.order.updateMany({
        where: { id, status: 'READY', budget: order.budget },
        data: {
          finalPaymentConfirmed: true,
          finalPaymentConfirmedAt: new Date(),
          finalPaymentRejectionReason: null,
          technicianCommission: commission,
          status: 'PAID_PENDING_DELIVERY',
        },
      })

      if (count === 0) {
        throw new Error(CONCURRENT_FINAL_PAYMENT_ERROR)
      }

      const alreadyConfirmedBudget = order.advancePaymentSubmissions.reduce(
        (sum, s) => sum + Number(s.amount),
        0
      )
      const base = budget - Number(order.revisionAmount ?? ADVANCE_REVISION_AMOUNT)
      const charged = base - alreadyConfirmedBudget

      // charged <= 0 → no queda nada por registrar (el anticipo ya cubría el
      // 100%, o el presupuesto no supera la revisión ya pagada). El umbral de
      // 0.009 es el mismo que usa el resto del subsistema para no arrastrar
      // centavos de redondeo.
      if (charged > 0.009) {
        await tx.advancePaymentSubmission.create({
          data: {
            orderId: id,
            amount: charged,
            kind: 'BUDGET',
            status: 'CONFIRMED',
            confirmedAt: new Date(),
            // Lo que el cliente (o el mostrador) ya había cargado como
            // comprobante de este pago final — es exactamente el pago que el
            // admin está confirmando en este momento.
            paymentDetails: (order.finalPaymentDetails ?? {}) as Prisma.InputJsonValue,
          },
        })
      }

      await tx.orderStatusHistory.create({
        data: {
          orderId: id,
          status: 'PAID_PENDING_DELIVERY',
          comment: `Pago final confirmado por el administrador. Comisión del técnico: $${commission.toFixed(2)}`,
        },
      })
    } else {
      // El rechazo no depende del budget (no cobra ni comisiona), así que la
      // guarda es solo por status — pero pasa por el mismo updateMany para que
      // no se limpie el comprobante de una orden que ya salió de READY.
      const { count } = await tx.order.updateMany({
        where: { id, status: 'READY' },
        data: {
          finalPaymentConfirmed: false,
          finalPaymentConfirmedAt: null,
          finalPaymentRejectionReason: rejectionReason ?? null,
          technicianCommission: null,
          finalPaymentDetails: Prisma.JsonNull,
          status: 'READY',
        },
      })

      if (count === 0) {
        throw new Error(CONCURRENT_FINAL_PAYMENT_ERROR)
      }

      await tx.orderStatusHistory.create({
        data: {
          orderId: id,
          status: 'READY',
          comment: `Pago final rechazado: ${rejectionReason}`,
        },
      })
    }

    const updatedOrder = await tx.order.findUniqueOrThrow({
      where: { id },
      include: {
        client: true,
        device: true,
        technician: { select: { id: true, name: true } },
        statusHistory: { orderBy: { createdAt: 'desc' } },
      },
    })

    return { updatedOrder, technicianId: order.technicianId }
  })

  if (approved && technicianId) {
    await decrementTechnicianLoad(technicianId)
  }

  return updatedOrder
}

// ─────────────────────────────────────────────
// ADMIN — Marcar la entrega física del equipo ya reparado y pagado.
// Solo aplica a órdenes en PAID_PENDING_DELIVERY (pago ya aprobado en
// confirmFinalPayment) — la comisión del técnico ya se calculó ahí, este
// paso solo cierra el ciclo físico.
// ─────────────────────────────────────────────

const closeOrderAsDelivered = async (id: string, comment: string) => {
  return prisma.order.update({
    where: { id },
    data: {
      status: 'DELIVERED',
      deliveredAt: new Date(),
      statusHistory: {
        create: {
          status: 'DELIVERED',
          comment,
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

export const markOrderDelivered = async (id: string) => {
  const order = await prisma.order.findUnique({
    where: { id },
  })

  if (!order) {
    throw new Error('Orden no encontrada')
  }

  if (order.status !== 'PAID_PENDING_DELIVERY') {
    throw new Error('Esta acción solo aplica a órdenes pagadas, pendientes de entrega')
  }

  return closeOrderAsDelivered(id, 'Equipo entregado al cliente.')
}

// ─────────────────────────────────────────────
// CLIENTE — Confirma la recepción del equipo (solo órdenes a domicilio).
// Reemplaza al "Marcar como entregado" del admin para self-service+delivery:
// el admin no está presente en la entrega física, la hace el técnico en la
// casa del cliente — quien puede confirmarla de verdad es el cliente.
// ─────────────────────────────────────────────

export const confirmDeliveryByClient = async (id: string, email: string) => {
  const user = await prisma.user.findUnique({ where: { email }, select: { clientId: true } })
  if (!user || !user.clientId) throw new Error('Cliente no encontrado para este usuario')

  const order = await prisma.order.findFirst({ where: { id, clientId: user.clientId } })
  if (!order) throw new Error('Orden no encontrada')

  if (order.deliveryAmount == null) {
    throw new Error('Esta acción solo aplica a órdenes con entrega a domicilio')
  }
  if (order.status !== 'PAID_PENDING_DELIVERY') {
    throw new Error('Esta acción solo aplica a órdenes pagadas, pendientes de entrega')
  }

  return closeOrderAsDelivered(id, 'Cliente confirmó la recepción del equipo desde la app — entrega finalizada.')
}

// ─────────────────────────────────────────────
// ADMIN — Marcar que el cliente retiró su equipo sin reparar, tras rechazar
// el presupuesto. Solo aplica a órdenes en REJECTED_PENDING_PICKUP — la
// comisión del técnico ya se calculó en rejectBudget, este paso solo cierra
// el ciclo físico. Reutiliza `deliveredAt` como "fecha en que el equipo
// salió del taller", reparado o no.
// ─────────────────────────────────────────────

export const markOrderPickedUpUnrepaired = async (id: string) => {
  const order = await prisma.order.findUnique({
    where: { id },
  })

  if (!order) {
    throw new Error('Orden no encontrada')
  }

  if (order.status !== 'REJECTED_PENDING_PICKUP') {
    throw new Error('Esta acción solo aplica a órdenes con presupuesto rechazado, pendientes de retiro')
  }

  const updatedOrder = await prisma.order.update({
    where: { id },
    data: {
      status: 'CANCELLED',
      deliveredAt: new Date(),
      statusHistory: {
        create: {
          status: 'CANCELLED',
          comment: 'Equipo retirado por el cliente sin reparar.',
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

  if (
    order.status === 'DELIVERED' ||
    order.status === 'CANCELLED' ||
    order.status === 'PAID_PENDING_DELIVERY' ||
    order.status === 'REJECTED_PENDING_PICKUP'
  ) {
    throw new Error('Esta orden ya fue cerrada')
  }

  const budget = order.budget != null ? Number(order.budget) : null
  // budget <= revisionAmount (no solo budget === 0) es económicamente el
  // mismo caso de "nada más que cobrar" — el 50% del anticipo de presupuesto
  // daría <= 0 (ver Finding 4, revisión final: submitBudgetPaymentInstallment
  // ya rechaza ese anticipo con un mensaje propio).
  if (budget == null || budget > Number(order.revisionAmount ?? ADVANCE_REVISION_AMOUNT)) {
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

// Cuando el cliente rechaza: la revisión ($15) y el delivery ($10) ya están
// cobrados (se pagaron antes de despachar al técnico), así que no hay nada
// más que cobrar ni reembolsar. La comisión del técnico usa la misma
// fórmula que closeZeroBudgetOrder (delivery + 40% de la revisión) — no
// depende de cuál era el presupuesto rechazado, porque el técnico sí hizo
// el trabajo de diagnóstico/revisión, solo que el cliente no siguió con la
// reparación.
// La orden queda en REJECTED_PENDING_PICKUP — el equipo todavía no salió
// físicamente del taller. markOrderPickedUpUnrepaired (Task 4) es quien
// marca CANCELLED cuando el cliente lo retira.
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

  return applyBudgetRejection(
    order,
    user.id,
    reason,
    'el cliente',
    (commission) =>
      `Cliente rechazó el presupuesto de $${order.budget}. Motivo: ${reason}. Comisión del técnico: $${commission.toFixed(2)} (delivery + 40% revisión).`
  )
}

// Órdenes de la app (self-service, con delivery): el cliente paga y
// rechaza desde la app — el personal solo aprueba/rechaza lo que el cliente
// envía. Las acciones "de mostrador" aplican solo a órdenes de recepción.
const APP_ORDER_ERROR = 'Las órdenes de la app las gestiona el cliente desde la app'
const assertCounterOrder = (order: { deliveryAmount: unknown }) => {
  if (order.deliveryAmount != null) throw new Error(APP_ORDER_ERROR)
}

// ADMIN registra el rechazo en nombre del cliente (mostrador, o el cliente
// avisó por teléfono/en persona). Misma regla que rejectBudget; solo cambia
// que no se filtra por cliente y el historial queda a nombre del admin.
export const rejectBudgetByAdmin = async (id: string, actorEmail: string, reason: string) => {
  const actor = await prisma.user.findUnique({ where: { email: actorEmail }, select: { id: true } })
  if (!actor) throw new Error('Usuario no encontrado')

  const order = await prisma.order.findUnique({ where: { id } })
  if (!order) throw new Error('Orden no encontrada')
  assertCounterOrder(order)

  return applyBudgetRejection(
    order,
    actor.id,
    reason,
    'el administrador',
    (commission) =>
      `Rechazo registrado por el administrador. Presupuesto $${order.budget}. Motivo: ${reason}. Comisión del técnico: $${commission.toFixed(2)} (delivery + 40% revisión).`
  )
}

const applyBudgetRejection = async (
  order: Order,
  actorUserId: string,
  reason: string,
  rejectedBy: 'el cliente' | 'el administrador',
  buildComment: (commission: number) => string
) => {
  const id = order.id
  if (order.status !== 'WAITING_APPROVAL') {
    throw new Error('Esta acción solo aplica a órdenes esperando aprobación de presupuesto')
  }

  const deliveryAmount = order.deliveryAmount ? Number(order.deliveryAmount) : 0
  const revisionAmount = order.revisionAmount ? Number(order.revisionAmount) : 0
  const commission = deliveryAmount + 0.4 * revisionAmount

  const updatedOrder = await prisma.$transaction(async (tx) => {
    // Los repuestos que el técnico registró en el diagnóstico no se llegaron
    // a instalar: vuelven al stock con una entrada propia en el historial de
    // inventario. El presupuesto NO se descuenta (a diferencia de
    // revertProductUsage) — el monto rechazado se conserva para el historial
    // y el Recibo de Cierre. Las mermas no vuelven: la pieza se dañó.
    const partsToReturn = await tx.inventoryMovement.findMany({
      where: { orderId: id, type: 'OUT', channel: 'SERVICIO_TECNICO', reversedAt: null, lossReportedAt: null },
    })
    for (const part of partsToReturn) {
      await tx.product.update({
        where: { id: part.productId },
        data: { stock: { increment: part.quantity } },
      })
      await tx.inventoryMovement.update({
        where: { id: part.id },
        data: { reversedAt: new Date(), reversedByUserId: actorUserId },
      })
      await tx.inventoryMovement.create({
        data: {
          productId: part.productId,
          type: 'IN',
          channel: 'SERVICIO_TECNICO',
          quantity: part.quantity,
          reason: `Reposición — presupuesto de la orden ${order.orderNumber} rechazado por ${rejectedBy}`,
          userId: actorUserId,
          orderId: id,
        },
      })
    }

    return tx.order.update({
      where: { id },
      data: {
        budgetApproved: false,
        budgetRejectionReason: reason,
        technicianCommission: commission,
        status: 'REJECTED_PENDING_PICKUP',
        statusHistory: {
          create: {
            status: 'REJECTED_PENDING_PICKUP',
            comment: buildComment(commission),
            userId: actorUserId,
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
  })

  // Anular cualquier abono BUDGET todavía PENDING — la orden ya se cerró con
  // el rechazo, así que ese abono nunca debe poder confirmarse después y
  // hacerla saltar de vuelta a REPAIRING (ver Finding 3, revisión final).
  await prisma.advancePaymentSubmission.updateMany({
    where: { orderId: id, status: 'PENDING', kind: 'BUDGET' },
    data: {
      status: 'REJECTED',
      rejectionReason: 'Orden cerrada — cliente rechazó el presupuesto',
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
  // budget <= revisionAmount (no solo === 0) — mismo caso de "nada más que
  // cobrar", ver Finding 4 (revisión final).
  if (order.budget == null || Number(order.budget) > Number(order.revisionAmount ?? ADVANCE_REVISION_AMOUNT)) {
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
// técnico para una nueva revisión (DIAGNOSING: el equipo ya está en sus
// manos). Se incrementa la carga porque la orden vuelve a estar activa.
export const disputeZeroBudgetDiagnosis = async (id: string, email: string, note?: string) => {
  const user = await prisma.user.findUnique({ where: { email }, select: { clientId: true } })
  if (!user || !user.clientId) throw new Error('Cliente no encontrado para este usuario')

  const order = await prisma.order.findFirst({ where: { id, clientId: user.clientId } })
  if (!order) throw new Error('Orden no encontrada')
  if (order.status !== 'WAITING_APPROVAL') {
    throw new Error('Esta acción solo aplica a órdenes esperando aprobación de presupuesto')
  }
  // budget <= revisionAmount (no solo === 0) — mismo caso de "nada más que
  // cobrar", ver Finding 4 (revisión final).
  if (order.budget == null || Number(order.budget) > Number(order.revisionAmount ?? ADVANCE_REVISION_AMOUNT)) {
    throw new Error('Esta acción solo aplica a diagnósticos sin costo')
  }

  return await prisma.order.update({
    where: { id },
    data: {
      budget: null,
      diagnosis: null,
      status: 'DIAGNOSING',
      statusHistory: {
        create: {
          status: 'DIAGNOSING',
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
  const orders = await prisma.order.findMany({
    where: { technicianId },
    include: {
      client: CLIENT_WITH_ADDRESSES,
      device: true,
      serviceCatalog: true,
      statusHistory: { orderBy: { createdAt: 'desc' } },
      inventoryMovements: {
        where: { reversedAt: null },
        include: { product: true },
      },
    },
    orderBy: { receivedAt: 'desc' },
  })
  return orders.map(withClientAddress)
}
// ─────────────────────────────────────────────
// COBERTURA DE LOS REPUESTOS DURANTE LA REPARACIÓN
// Si el técnico agrega un repuesto y lo confirmado del presupuesto ya no
// cubre el costo total de los repuestos activos, la orden espera el pago de
// la diferencia (WAITING_EXTRA_PAYMENT) antes de seguir. El mínimo de
// computeRepairMinimum rige solo para aprobar, no para esta pausa.
// ─────────────────────────────────────────────

const getRepairCoverage = async (tx: ExtendedTransactionClient, orderId: string) => {
  const order = await tx.order.findUniqueOrThrow({
    where: { id: orderId },
    include: {
      advancePaymentSubmissions: { where: { kind: 'BUDGET', status: 'CONFIRMED' } },
      inventoryMovements: { where: ACTIVE_PARTS_WHERE },
    },
  })
  const confirmed = order.advancePaymentSubmissions.reduce((sum, s) => sum + Number(s.amount), 0)
  return { order, ...computeExtraPartsPending(sumPartsCost(order.inventoryMovements), confirmed) }
}

// Si la orden estaba en pausa y lo confirmado ya cubre los repuestos (porque
// el cliente pagó, o porque se quitó el repuesto), vuelve a REPAIRING.
const settleExtraPaymentIfCovered = async (
  tx: ExtendedTransactionClient,
  orderId: string,
  comment: string,
  userId?: string
) => {
  const { order, covered } = await getRepairCoverage(tx, orderId)
  if (order.status !== 'WAITING_EXTRA_PAYMENT' || !covered) return false
  await tx.inventoryMovement.updateMany({
    where: { orderId, awaitingClientPayment: true },
    data: { awaitingClientPayment: false },
  })
  await tx.order.update({ where: { id: orderId }, data: { status: 'REPAIRING', version: { increment: 1 } } })
  await tx.orderStatusHistory.create({ data: { orderId, status: 'REPAIRING', comment, userId } })
  return true
}

// ─────────────────────────────────────────────
// REPUESTOS DE INVENTARIO USADOS EN LA ORDEN
// Solo el técnico asignado a la orden puede registrar/revertir. Se suma al
// budget de inmediato, incluso si ya fue aprobado por el cliente — el
// diagnóstico previo debería cubrir todo, pero puede aparecer una falla
// adicional mientras se repara.
// ─────────────────────────────────────────────

// Estados en los que el técnico puede cargar, revertir o reportar merma de un
// repuesto: mientras la orden está en revisión o en reparación. Con la orden
// cobrada, entregada, cancelada o sin pago confirmado, el presupuesto y la
// comisión ya no deben cambiar.
const PARTS_EDITABLE_STATUSES = new Set(['DIAGNOSING', 'WAITING_APPROVAL', 'APPROVED', 'REPAIRING', 'WAITING_EXTRA_PAYMENT'])

const assertPartsEditable = (status: string) => {
  if (!PARTS_EDITABLE_STATUSES.has(status)) {
    throw new Error('Los repuestos solo se pueden modificar mientras la orden está en revisión o en reparación')
  }
}

export const useProductInOrder = async (
  orderId: string,
  productId: string,
  quantity: number,
  actorEmail: string
) => {
  const actor = await prisma.user.findUnique({ where: { email: actorEmail } })
  if (!actor) throw new Error('Usuario no encontrado')

  const order = await prisma.order.findUnique({ where: { id: orderId } })
  if (!order) throw new Error('Orden no encontrada')
  if (order.technicianId !== actor.id) {
    throw new Error('Solo el técnico asignado a esta orden puede registrar repuestos')
  }
  assertPartsEditable(order.status)

  return await prisma.$transaction(async (tx) => {
    const product = await tx.product.findUniqueOrThrow({ where: { id: productId } })
    if (product.stock < quantity) {
      throw new InsufficientStockError()
    }

    await tx.product.update({
      where: { id: productId },
      data: { stock: { decrement: quantity } },
    })

    const movement = await tx.inventoryMovement.create({
      data: {
        productId,
        type: 'OUT',
        channel: 'SERVICIO_TECNICO',
        quantity,
        reason: `Repuesto usado en orden ${order.orderNumber}`,
        userId: actor.id,
        orderId,
        unitPriceAtUse: product.price,
      },
    })

    const addedCost = Number(product.price) * quantity
    const updatedOrder = await tx.order.update({
      where: { id: orderId },
      data: { budget: { increment: addedCost } },
    })

    // Finding H (revisión final): agregar un repuesto sube el presupuesto de
    // la orden, pero antes no dejaba ninguna entrada en el historial — el
    // cliente (y el admin) veían el monto cambiar sin explicación. Se registra
    // con el status actual, sin cambiarlo: es auditoría, no una transición.
    await tx.orderStatusHistory.create({
      data: {
        orderId,
        status: updatedOrder.status,
        comment: `Repuesto usado: ${product.name} (x${quantity}) — +$${addedCost.toFixed(2)}`,
        userId: actor.id,
      },
    })

    // Repuesto agregado con la reparación ya autorizada: si lo confirmado
    // no cubre el total de repuestos, la reparación se pausa hasta que el cliente
    // pague la diferencia (o rechace el repuesto — rejectExtraPart).
    if (updatedOrder.status === 'REPAIRING' || updatedOrder.status === 'WAITING_EXTRA_PAYMENT') {
      const coverage = await getRepairCoverage(tx, orderId)
      if (!coverage.covered) {
        const flagged = await tx.inventoryMovement.update({
          where: { id: movement.id },
          data: { awaitingClientPayment: true },
        })
        const paused = await tx.order.update({
          where: { id: orderId },
          data: { status: 'WAITING_EXTRA_PAYMENT', version: { increment: 1 } },
        })
        await tx.orderStatusHistory.create({
          data: {
            orderId,
            status: 'WAITING_EXTRA_PAYMENT',
            comment: `Repuesto adicional: ${product.name} (x${quantity}). La reparación continúa cuando se confirme el pago de $${coverage.pending.toFixed(2)}.`,
            userId: actor.id,
          },
        })
        return { movement: flagged, order: paused }
      }
    }

    return { movement, order: updatedOrder }
  })
}

export const revertProductUsage = async (movementId: string, actorEmail: string) => {
  const actor = await prisma.user.findUnique({ where: { email: actorEmail } })
  if (!actor) throw new Error('Usuario no encontrado')

  const movement = await prisma.inventoryMovement.findUnique({ where: { id: movementId } })
  if (!movement) throw new Error('Movimiento no encontrado')
  if (movement.channel !== 'SERVICIO_TECNICO' || !movement.orderId) {
    throw new Error('Este movimiento no corresponde a un repuesto de orden de servicio')
  }
  if (movement.reversedAt) {
    throw new Error('Este repuesto ya fue revertido')
  }

  const order = await prisma.order.findUnique({ where: { id: movement.orderId } })
  if (!order) throw new Error('Orden no encontrada')
  assertPartsEditable(order.status)
  if (order.technicianId !== actor.id) {
    throw new Error('Solo el técnico asignado a esta orden puede revertir este repuesto')
  }

  return await prisma.$transaction(async (tx) => {
    // Guardia contra doble reversión concurrente (ej. este mismo endpoint
    // llamado dos veces, o en carrera con rejectExtraPart sobre el mismo
    // movimiento): reclama el movimiento con reversedAt: null ANTES de tocar
    // stock/presupuesto. Si otro proceso ya lo revirtió, count es 0 y no se
    // duplica el ajuste.
    const claim = await tx.inventoryMovement.updateMany({
      where: { id: movementId, reversedAt: null },
      data: { reversedAt: new Date(), reversedByUserId: actor.id, awaitingClientPayment: false },
    })
    if (claim.count === 0) {
      throw new Error('Este repuesto ya fue revertido')
    }

    const product = await tx.product.update({
      where: { id: movement.productId },
      data: { stock: { increment: movement.quantity } },
    })

    const revertedCost = Number(movement.unitPriceAtUse ?? 0) * movement.quantity
    const updatedOrder = await tx.order.update({
      where: { id: movement.orderId! },
      data: { budget: { decrement: revertedCost } },
    })

    const updatedMovement = await tx.inventoryMovement.findUniqueOrThrow({ where: { id: movementId } })

    // Contraparte del registro de useProductInOrder (Finding H): quitar un
    // repuesto baja el presupuesto y también debe quedar asentado.
    await tx.orderStatusHistory.create({
      data: {
        orderId: movement.orderId!,
        status: updatedOrder.status,
        comment: `Repuesto revertido: ${product.name} (x${movement.quantity}) — -$${revertedCost.toFixed(2)}`,
        userId: actor.id,
      },
    })

    await settleExtraPaymentIfCovered(tx, movement.orderId!, 'Presupuesto actualizado — el técnico continúa la reparación', actor.id)
    const finalOrder = await tx.order.findUniqueOrThrow({ where: { id: movement.orderId! } })
    return { movement: updatedMovement, order: finalOrder }
  })
}

export const reportPartLoss = async (movementId: string, actorEmail: string, description: string) => {
  if (!description || !description.trim()) {
    throw new Error('La descripción de la merma es requerida')
  }

  const actor = await prisma.user.findUnique({ where: { email: actorEmail } })
  if (!actor) throw new Error('Usuario no encontrado')

  const movement = await prisma.inventoryMovement.findUnique({ where: { id: movementId } })
  if (!movement) throw new Error('Movimiento no encontrado')
  if (movement.channel !== 'SERVICIO_TECNICO' || !movement.orderId) {
    throw new Error('Este movimiento no corresponde a un repuesto de orden de servicio')
  }
  if (movement.reversedAt) {
    throw new Error('Este repuesto ya fue revertido')
  }
  if (movement.lossReportedAt) {
    throw new Error('Este repuesto ya fue reportado como merma')
  }

  const order = await prisma.order.findUnique({ where: { id: movement.orderId } })
  if (!order) throw new Error('Orden no encontrada')
  assertPartsEditable(order.status)
  if (order.technicianId !== actor.id) {
    throw new Error('Solo el técnico asignado a esta orden puede reportar esta merma')
  }

  return await prisma.$transaction(async (tx) => {
    const product = await tx.product.findUniqueOrThrow({ where: { id: movement.productId } })

    const lostCost = Number(movement.unitPriceAtUse ?? 0) * movement.quantity
    const updatedOrder = await tx.order.update({
      where: { id: movement.orderId! },
      data: { budget: { decrement: lostCost } },
    })

    const updatedMovement = await tx.inventoryMovement.update({
      where: { id: movementId },
      data: {
        lossReportedAt: new Date(),
        lossDescription: description.trim(),
        lossReportedByUserId: actor.id,
      },
    })

    await tx.orderStatusHistory.create({
      data: {
        orderId: movement.orderId!,
        status: updatedOrder.status,
        comment: `Repuesto reportado como merma: ${product.name} (x${movement.quantity}) — ${description.trim()} — no se cobra al cliente`,
        userId: actor.id,
      },
    })

    await settleExtraPaymentIfCovered(tx, movement.orderId!, 'Presupuesto actualizado — el técnico continúa la reparación', actor.id)
    const finalOrder = await tx.order.findUniqueOrThrow({ where: { id: movement.orderId! } })
    return { movement: updatedMovement, order: finalOrder }
  })
}

// CLIENTE — Rechaza el repuesto adicional. Se revierten los repuestos que
// esperaban su pago (stock de vuelta, presupuesto baja) y la reparación
// sigue sin ellos, bajo responsabilidad del cliente. Lo ya pagado no se
// devuelve; un abono PENDING que el admin confirme después suma al pagado.
export const rejectExtraPart = async (orderId: string, email: string) => {
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, clientId: true } })
  if (!user || !user.clientId) throw new Error('Cliente no encontrado para este usuario')

  const order = await prisma.order.findFirst({ where: { id: orderId, clientId: user.clientId } })
  if (!order) throw new Error('Orden no encontrada')

  return applyExtraPartRejection(
    order,
    user.id,
    (names) =>
      `El cliente rechazó el repuesto adicional ${names}. La reparación continúa sin él, bajo responsabilidad del cliente; lo ya pagado no se devuelve.`
  )
}

// ADMIN registra el rechazo del repuesto en nombre del cliente — solo en
// órdenes de mostrador (las de la app las decide el cliente desde la app).
export const rejectExtraPartByAdmin = async (orderId: string, actorEmail: string) => {
  const actor = await prisma.user.findUnique({ where: { email: actorEmail }, select: { id: true } })
  if (!actor) throw new Error('Usuario no encontrado')

  const order = await prisma.order.findUnique({ where: { id: orderId } })
  if (!order) throw new Error('Orden no encontrada')
  assertCounterOrder(order)

  // Texto más corto que el del cliente: el comentario del historial es
  // VARCHAR(191) y el prefijo "Rechazo registrado por el administrador" no
  // dejaba lugar para el nombre del repuesto.
  return applyExtraPartRejection(
    order,
    actor.id,
    (names) =>
      `Rechazo registrado por el administrador: el cliente rechazó el repuesto ${names}. La reparación sigue sin él, bajo su responsabilidad; lo ya pagado no se devuelve.`
  )
}

// Tope de orderStatusHistory.comment (String → VARCHAR(191) en MySQL).
const HISTORY_COMMENT_MAX = 191

const applyExtraPartRejection = async (
  order: Order,
  actorUserId: string,
  buildComment: (names: string) => string
) => {
  const orderId = order.id
  if (order.status !== 'WAITING_EXTRA_PAYMENT') {
    throw new Error('Esta acción solo aplica a órdenes esperando el pago de un repuesto adicional')
  }

  return await prisma.$transaction(async (tx) => {
    // Reclama la orden con optimistic locking: si otro proceso (confirmación
    // de pago, otro rechazo) ya la movió de WAITING_EXTRA_PAYMENT o le
    // cambió la versión mientras leíamos afuera de la transacción, esto
    // no actualiza nada y abortamos en vez de seguir con datos obsoletos.
    const claim = await tx.order.updateMany({
      where: { id: orderId, status: 'WAITING_EXTRA_PAYMENT', version: order.version },
      data: { version: { increment: 1 } },
    })
    if (claim.count === 0) {
      throw new Error('La orden cambió mientras se procesaba — recarga e intenta de nuevo')
    }

    const pending = await tx.inventoryMovement.findMany({
      where: { orderId, awaitingClientPayment: true, reversedAt: null, lossReportedAt: null },
      include: { product: { select: { name: true } } },
    })

    let revertedCost = 0
    const names: string[] = []
    for (const m of pending) {
      // updateMany con guardia reversedAt: null — si el técnico ya revirtió
      // este mismo movimiento por su cuenta (revertProductUsage) entre el
      // findMany de arriba y este punto, count será 0 y no se toca el stock.
      const reverted = await tx.inventoryMovement.updateMany({
        where: { id: m.id, reversedAt: null, lossReportedAt: null },
        data: { reversedAt: new Date(), reversedByUserId: actorUserId, awaitingClientPayment: false },
      })
      if (reverted.count === 0) continue
      await tx.product.update({ where: { id: m.productId }, data: { stock: { increment: m.quantity } } })
      revertedCost += Number(m.unitPriceAtUse ?? 0) * m.quantity
      names.push(`${m.product.name} (x${m.quantity})`)
    }

    if (names.length === 0) {
      throw new Error('No hay ningún repuesto adicional pendiente de rechazar — puede que ya se haya revertido o pagado')
    }

    // Nombres largos no entran en el comentario: se reemplazan por la
    // cantidad (cada repuesto ya quedó con su nombre en "Repuesto usado: …").
    const listed = buildComment(names.join(', '))
    const comment =
      listed.length <= HISTORY_COMMENT_MAX
        ? listed
        : buildComment(names.length === 1 ? '(1 repuesto)' : `(${names.length} repuestos)`)

    return tx.order.update({
      where: { id: orderId },
      data: {
        budget: { decrement: revertedCost },
        status: 'REPAIRING',
        // La versión ya se incrementó al reclamar la orden arriba — un solo
        // incremento total por llamada.
        statusHistory: {
          create: {
            status: 'REPAIRING',
            comment,
            userId: actorUserId,
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
  })
}

export const getPartsUsedInOrder = async (orderId: string) => {
  return await prisma.inventoryMovement.findMany({
    where: { orderId, type: 'OUT', channel: 'SERVICIO_TECNICO' },
    include: {
      product: { select: { id: true, name: true } },
      user: { select: { id: true, name: true, lastName: true } },
    },
    orderBy: { createdAt: 'desc' },
  })
}

// ─────────────────────────────────────────────
// ABONO ADICIONAL EN ORDEN DE RECEPCIÓN — staff (ADMIN/TECHNICIAN), no el
// cliente. A diferencia de submitAdvancePaymentInstallment (self-service,
// requiere que el actor SEA el Client dueño de la orden), aquí el actor es
// personal de recepción que reporta lo que el cliente pagó en persona.
// ─────────────────────────────────────────────

export const submitCounterAdvanceInstallment = async (
  orderId: string,
  actorEmail: string,
  paymentDetails: Record<string, string>,
  amount: number
) => {
  const actor = await prisma.user.findUnique({ where: { email: actorEmail } })
  if (!actor) throw new Error('Usuario no encontrado')

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      // Solo los abonos de la revisión: los del presupuesto se cuentan aparte.
      advancePaymentSubmissions: { where: { status: { in: ['CONFIRMED', 'PENDING'] }, kind: 'REVISION' } },
    },
  })
  if (!order) throw new Error('Orden no encontrada')
  assertCounterOrder(order)
  if (order.status !== 'PENDING_PAYMENT') {
    throw new Error('La revisión ya está pagada: este abono solo aplica a órdenes con el pago de revisión pendiente')
  }

  if (amount == null || amount <= 0) {
    throw new Error('El monto del pago debe ser mayor a cero')
  }

  const total =
    order.deliveryAmount != null
      ? Number(order.deliveryAmount) + Number(order.revisionAmount ?? ADVANCE_REVISION_AMOUNT)
      : Number(order.revisionAmount ?? ADVANCE_REVISION_AMOUNT)
  const alreadyAccounted = order.advancePaymentSubmissions.reduce((sum, s) => sum + Number(s.amount), 0)
  const remaining = total - alreadyAccounted

  if (amount > remaining + 0.009) {
    throw new Error(`El monto excede lo que falta por pagar ($${remaining.toFixed(2)})`)
  }

  return await prisma.advancePaymentSubmission.create({
    data: {
      orderId,
      amount,
      paymentDetails,
      status: 'PENDING',
    },
  })
}

// ─────────────────────────────────────────────
// ADMIN/TECHNICIAN — Anticipo del presupuesto registrado en persona
// (mostrador). Sin verificación de dueño, mismo cálculo que
// submitBudgetPaymentInstallment.
// ─────────────────────────────────────────────

export const submitCounterBudgetInstallment = async (
  orderId: string,
  actorEmail: string,
  paymentDetails: Record<string, string>,
  amount: number
) => {
  const actor = await prisma.user.findUnique({ where: { email: actorEmail } })
  if (!actor) throw new Error('Usuario no encontrado')

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      advancePaymentSubmissions: { where: { status: { in: ['CONFIRMED', 'PENDING'] }, kind: 'BUDGET' } },
    },
  })
  if (!order) throw new Error('Orden no encontrada')
  assertCounterOrder(order)

  if (order.status !== 'WAITING_APPROVAL' && order.status !== 'WAITING_EXTRA_PAYMENT') {
    throw new Error('Esta acción solo aplica a órdenes esperando aprobación de presupuesto o el pago de un repuesto adicional')
  }

  if (amount == null || amount <= 0) {
    throw new Error('El monto del pago debe ser mayor a cero')
  }

  const base = Number(order.budget ?? 0) - Number(order.revisionAmount ?? ADVANCE_REVISION_AMOUNT)

  // Mismo caso que en submitBudgetPaymentInstallment: budget <= revisionAmount
  // no deja nada que cobrar por esta vía.
  if (base <= 0) {
    throw new Error('Esta acción no aplica — el presupuesto no supera el costo de la revisión ya pagada')
  }

  // Igual que en submitBudgetPaymentInstallment: se puede abonar hasta el
  // 100% de la base, nunca más — el mínimo para autorizar (ver repairMinimum.ts)
  // se exige en confirmAdvancePaymentInstallment.
  const alreadyAccounted = order.advancePaymentSubmissions.reduce((sum, s) => sum + Number(s.amount), 0)
  const remaining = base - alreadyAccounted

  if (amount > remaining + 0.009) {
    throw new Error(`El monto excede lo que falta por pagar ($${remaining.toFixed(2)})`)
  }

  return await prisma.advancePaymentSubmission.create({
    data: { orderId, amount, paymentDetails, status: 'PENDING', kind: 'BUDGET' },
  })
}

// ─────────────────────────────────────────────
// ADMIN/TECHNICIAN/TECHNICIAN_DELIVERY — Ajuste imprevisto al presupuesto
// Permite sumar un monto adicional al presupuesto de una orden que ya está
// en reparación, lista, o ya pagada y pendiente de entrega — un imprevisto
// detectado por el técnico después de que el cliente ya aprobó/pagó el
// presupuesto original. Requiere motivo. Ownership: un TECHNICIAN o
// TECHNICIAN_DELIVERY solo puede ajustar sus propias órdenes asignadas
// (mismo criterio que useProductInOrder/revertProductUsage); ADMIN puede
// actuar sobre cualquier orden.
//
// Caso PAID_PENDING_DELIVERY: el pago final ya fue confirmado (por
// confirmFinalPayment, o por cualquier otro camino) sobre el presupuesto
// viejo. Sumar dinero al presupuesto después de eso significa, por
// definición, que la orden deja de estar "totalmente pagada" — así que
// SIEMPRE revertimos a READY y limpiamos el pago final confirmado (y la
// comisión que dependía de él), sin condición: no intentamos recalcular
// cuánto queda pendiente comparando con `advancePaymentSubmission` porque
// ese pool (kind: 'BUDGET') no ve lo cobrado por el camino tradicional de
// confirmFinalPayment, y subestimaría lo ya pagado.
//
// Al revertir a READY también se limpia el comprobante del pago final
// (finalPaymentDetails/finalPaymentRejectionReason) y se le devuelve la carga
// al técnico asignado — ver Finding E abajo.
//
// Escritura atómica (budget: { increment: amount }) dentro de una
// transacción — igual que useProductInOrder/revertProductUsage — para que
// dos ajustes simultáneos sobre la misma orden no se pisen entre sí.
// ─────────────────────────────────────────────

export const addBudgetAdjustment = async (
  orderId: string,
  actorEmail: string,
  amount: number,
  reason: string
) => {
  const actor = await prisma.user.findUnique({ where: { email: actorEmail } })
  if (!actor) throw new Error('Usuario no encontrado')

  // Validaciones que no dependen del estado de la orden — se hacen antes de
  // abrir la transacción para no ocupar una conexión al pedo.
  if (!reason || typeof reason !== 'string' || !reason.trim()) {
    throw new Error('reason es requerido')
  }

  if (amount == null || amount <= 0) {
    throw new Error('El monto del ajuste debe ser mayor a cero')
  }

  const { updatedOrder, technicianToRestore } = await prisma.$transaction(async (tx) => {
    // Finding D (revisión final): la lectura que decide `reopensBalance` —y la
    // que valida estado/ownership— ocurre DENTRO de la transacción, justo
    // antes de escribir, y la escritura se condiciona con updateMany al mismo
    // status recién leído. Si otra request transicionó la orden en el medio,
    // count === 0 y abortamos en vez de reabrir/limpiar un pago que ya no
    // corresponde.
    const order = await tx.order.findUnique({ where: { id: orderId } })
    if (!order) throw new Error('Orden no encontrada')

    if (
      order.status !== 'REPAIRING' &&
      order.status !== 'READY' &&
      order.status !== 'PAID_PENDING_DELIVERY'
    ) {
      throw new Error('Esta acción solo aplica a órdenes en reparación, listas o pagadas pendientes de entrega')
    }

    if (
      (actor.role === 'TECHNICIAN' || actor.role === 'TECHNICIAN_DELIVERY') &&
      order.technicianId !== actor.id
    ) {
      throw new Error('Solo el técnico asignado a esta orden puede ajustar su presupuesto')
    }

    const reopensBalance = order.status === 'PAID_PENDING_DELIVERY'

    // Finding 1 (re-revisión): el mismo comprobante viejo puede estar cargado
    // sin que la orden haya llegado a PAID_PENDING_DELIVERY — el cliente (o el
    // mostrador) ya subió su pago del monto anterior y la orden sigue en READY
    // esperando la aprobación del admin. Ajustar el presupuesto ahí invalida
    // ese comprobante: si no se limpia, "Aprobar pago final" sigue habilitado
    // y cobraría de menos (el ajuste nunca se recibió). No se toca el status
    // —la orden sigue en READY— ni la carga del técnico (que en READY nunca se
    // liberó), eso es exclusivo del caso reopensBalance.
    const invalidatesPendingProof = order.status === 'READY' && order.finalPaymentDetails != null

    const { count } = await tx.order.updateMany({
      where: { id: orderId, status: order.status },
      data: {
        budget: { increment: amount },
        ...(invalidatesPendingProof
          ? {
              finalPaymentDetails: Prisma.JsonNull,
              finalPaymentRejectionReason: null,
            }
          : {}),
        ...(reopensBalance
          ? {
              status: 'READY' as const,
              finalPaymentConfirmed: false,
              finalPaymentConfirmedAt: null,
              technicianCommission: null,
              // Finding E (revisión final): el comprobante viejo del pago
              // final debe limpiarse igual que en el rechazo de
              // confirmFinalPayment. Si no, quedaba habilitando "Aprobar pago
              // final" de un clic sin haber cobrado nada del ajuste, y el
              // formulario de mostrador (que se oculta si finalPaymentDetails
              // != null) seguía escondido.
              finalPaymentDetails: Prisma.JsonNull,
              finalPaymentRejectionReason: null,
            }
          : {}),
      },
    })

    if (count === 0) {
      throw new Error('La orden cambió de estado mientras se procesaba el ajuste — recarga e intenta de nuevo')
    }

    const statusHistoryEntries: Prisma.OrderStatusHistoryCreateManyInput[] = [
      {
        orderId,
        status: order.status,
        comment: `Ajuste al presupuesto: +$${amount.toFixed(2)} — motivo: ${reason}`,
        userId: actor.id,
      },
    ]
    if (reopensBalance) {
      statusHistoryEntries.push({
        orderId,
        status: 'READY',
        comment: 'El ajuste reabrió un saldo pendiente — vuelve a esperar el pago final.',
      })
    }
    if (invalidatesPendingProof) {
      statusHistoryEntries.push({
        orderId,
        status: 'READY',
        comment:
          'El ajuste al presupuesto invalidó el comprobante de pago final pendiente — el cliente debe reenviarlo.',
      })
    }

    await tx.orderStatusHistory.createMany({ data: statusHistoryEntries })

    const updatedOrder = await tx.order.findUniqueOrThrow({
      where: { id: orderId },
      include: {
        client: true,
        device: true,
        statusHistory: { orderBy: { createdAt: 'desc' } },
        advancePaymentSubmissions: true,
      },
    })

    return {
      updatedOrder,
      // Al llegar a PAID_PENDING_DELIVERY la orden ya había liberado la carga
      // del técnico (decrementTechnicianLoad, en finishRepair o
      // confirmFinalPayment). Al revertir a READY el técnico vuelve a tener
      // trabajo activo sobre ella, así que le devolvemos la carga —
      // simétrico, y sin disparar reasignaciones automáticas de otras órdenes
      // en cola (eso solo lo hace decrementTechnicianLoad).
      technicianToRestore: reopensBalance ? order.technicianId : null,
    }
  })

  if (technicianToRestore) {
    await incrementTechnicianLoad(technicianToRestore)
  }

  return updatedOrder
}

// ─────────────────────────────────────────────
// TECHNICIAN/TECHNICIAN_DELIVERY — Terminar la reparación
// Cierra REPAIRING. Si el cliente ya cubrió el 100% (o más) de la base del
// anticipo de presupuesto vía advancePaymentSubmission (kind BUDGET,
// CONFIRMED), no queda saldo que cobrar al entregar — saltamos directo a
// PAID_PENDING_DELIVERY en una sola actualización, calculando la comisión
// del técnico con la misma fórmula que confirmFinalPayment (deliveryAmount +
// 40% × (budget - revisionAmount)). Si queda saldo, la orden pasa a READY y
// sigue el flujo normal de pago final (confirmFinalPayment).
// Ownership: igual que useProductInOrder/addBudgetAdjustment, solo el
// técnico asignado a la orden puede finalizar su propia reparación.
// ─────────────────────────────────────────────

// Mensaje único para la guarda de concurrencia — el frontend lo muestra tal
// cual (toast) para que el técnico sepa que debe recargar y reintentar.
export const CONCURRENT_FINISH_REPAIR_ERROR =
  'La orden cambió mientras se procesaba (estado o presupuesto) — recarga e intenta de nuevo'

export const finishRepair = async (
  orderId: string,
  technicianId: string,
  observation?: string
) => {
  const readyComment = observation ? `Reparación terminada. ${observation}` : 'Reparación terminada.'

  const { updatedOrder, fullyPaid } = await prisma.$transaction(async (tx) => {
    // Lectura fresca dentro de la transacción — no reutilizamos ningún dato
    // leído antes de entrar acá, para que un addBudgetAdjustment (u otra
    // escritura) concurrente sobre esta misma orden no nos deje calculando
    // sobre budget/deliveryAmount/confirmado obsoletos.
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: {
        advancePaymentSubmissions: { where: { status: 'CONFIRMED', kind: 'BUDGET' } },
      },
    })

    if (!order) {
      throw new Error('Orden no encontrada')
    }

    if (order.status !== 'REPAIRING') {
      throw new Error('Esta acción solo aplica a órdenes en reparación')
    }

    if (order.technicianId !== technicianId) {
      throw new Error('Solo el técnico asignado a esta orden puede finalizar la reparación')
    }

    // Base/confirmado (Caso A vs B) siguen el mismo fallback que el resto del
    // subsistema de anticipo de presupuesto (addBudgetAdjustment,
    // submitBudgetPaymentInstallment, etc.): revisionAmount ?? 15.
    const base = Number(order.budget ?? 0) - Number(order.revisionAmount ?? ADVANCE_REVISION_AMOUNT)
    const confirmado = order.advancePaymentSubmissions.reduce((sum, s) => sum + Number(s.amount), 0)
    const fullyPaid = base - confirmado <= 0.009

    if (fullyPaid) {
      // La comisión replica confirmFinalPayment literalmente, incluido su
      // fallback de revisionAmount (null → 0, no 15) — a propósito distinto
      // del fallback usado arriba para decidir Caso A/B.
      const revisionForCommission = order.revisionAmount ? Number(order.revisionAmount) : 0
      const commission = Number(order.deliveryAmount ?? 0) + 0.4 * (Number(order.budget ?? 0) - revisionForCommission)

      // updateMany condicionado al status Y al budget ya leídos: si otra
      // request transicionó esta orden —o le sumó un ajuste al presupuesto
      // sin tocar el status (addBudgetAdjustment en REPAIRING, Finding C de la
      // revisión final)— entre la lectura de arriba y este punto, el count da
      // 0 y abortamos en vez de escribir una comisión/decisión de fullyPaid
      // calculada sobre datos viejos.
      const { count } = await tx.order.updateMany({
        where: { id: orderId, status: 'REPAIRING', budget: order.budget },
        data: {
          status: 'PAID_PENDING_DELIVERY',
          finalPaymentConfirmed: true,
          finalPaymentConfirmedAt: new Date(),
          technicianCommission: commission,
          deliveryObservations: observation || null,
        },
      })

      if (count === 0) {
        throw new Error(CONCURRENT_FINISH_REPAIR_ERROR)
      }

      await tx.orderStatusHistory.createMany({
        data: [
          { orderId, status: 'READY', comment: readyComment },
          { orderId, status: 'PAID_PENDING_DELIVERY', comment: 'Pagado en su totalidad — sin cobro pendiente.' },
        ],
      })
    } else {
      const { count } = await tx.order.updateMany({
        where: { id: orderId, status: 'REPAIRING', budget: order.budget },
        data: { status: 'READY', deliveryObservations: observation || null },
      })

      if (count === 0) {
        throw new Error(CONCURRENT_FINISH_REPAIR_ERROR)
      }

      await tx.orderStatusHistory.create({
        data: { orderId, status: 'READY', comment: readyComment },
      })
    }

    const updatedOrder = await tx.order.findUniqueOrThrow({
      where: { id: orderId },
      include: {
        client: true,
        device: true,
        statusHistory: { orderBy: { createdAt: 'desc' } },
        advancePaymentSubmissions: true,
      },
    })

    return { updatedOrder, fullyPaid }
  })

  // Igual que confirmFinalPayment/closeZeroBudgetOrder/rejectBudget/
  // confirmZeroBudgetDiagnosis: al llegar a un cierre financiero terminal se
  // libera la carga del técnico para que vuelva a recibir asignaciones
  // automáticas. Se hace fuera de la transacción (mismo patrón que esas
  // funciones, que tampoco la incluyen en su propia escritura).
  if (fullyPaid && updatedOrder.technicianId) {
    await decrementTechnicianLoad(updatedOrder.technicianId)
  }

  return updatedOrder
}
