import prisma, { ExtendedTransactionClient } from '../../lib/prisma'
import { INSTALLATION_COST, DELIVERY_COST, DELIVERY_COMMISSION } from '../../config/constants'

// ─────────────────────────────────────────────
// MAPEO DE MÉTODOS DE PAGO (frontend → enum Prisma)
// ─────────────────────────────────────────────

const PAYMENT_METHOD_MAP: Record<string, string> = {
  PAGO_MOVIL: 'MOBILE_PAYMENT',
  TRANSFERENCIA: 'TRANSFER',
  BINANCE: 'BINANCE',
}

export const mapPaymentMethod = (frontendMethod: string): string | null => {
  return PAYMENT_METHOD_MAP[frontendMethod] ?? null
}

// ─────────────────────────────────────────────
// RESOLVER clientId DESDE EL USUARIO AUTENTICADO
// El token JWT de Cognito solo trae sub/email/groups,
// hay que buscar en MySQL el User correspondiente y su Client vinculado.
// ─────────────────────────────────────────────

export const resolveClientIdFromEmail = async (
  email: string
): Promise<string | null> => {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { clientId: true },
  })
  return user?.clientId ?? null
}

// ─────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────

interface CreateProductOrderItemInput {
  productId: string
  quantity: number
}

interface CreateProductOrderInput {
  clientId: string
  items: CreateProductOrderItemInput[]
  paymentMethod: string // ya mapeado al enum de Prisma
  address: string
  notes?: string
  requiresInstallation?: boolean
}

interface CreateLinkedProductOrderInput {
  clientId: string
  items: CreateProductOrderItemInput[]
  paymentMethod: string // ya mapeado al enum de Prisma
  linkedOrderId: string
  address: string
  notes?: string
}

interface ProcessedItem {
  productId: string
  quantity: number
  unitPrice: number
  subtotal: number
  requiresInstallation: boolean
}

// ─────────────────────────────────────────────
// HELPER INTERNO — validar stock, calcular precios y total
// Compartido entre createProductOrder (Tienda / Dirección A) y
// createLinkedProductOrder (Dirección B). No exportado.
// NOTA: el total que retorna es solo la suma de productos (itemsTotal);
// el costo de delivery se suma después, en cada función que lo llama.
// ─────────────────────────────────────────────

const processOrderItems = async (
  tx: ExtendedTransactionClient,
  items: CreateProductOrderItemInput[]
): Promise<{ itemsToCreate: ProcessedItem[]; total: number }> => {
  let total = 0
  const itemsToCreate: ProcessedItem[] = []

  for (const item of items) {
    const product = await tx.product.findUnique({
      where: { id: item.productId },
    })

    if (!product) {
      throw new Error(`Producto no encontrado: ${item.productId}`)
    }

    if (!product.isActive) {
      throw new Error(`El producto "${product.name}" ya no está disponible`)
    }

    if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
      throw new Error(`La cantidad de "${product.name}" debe ser un entero mayor a 0`)
    }

    if (product.stock < item.quantity) {
      throw new Error(
        `Stock insuficiente para "${product.name}". Disponible: ${product.stock}, solicitado: ${item.quantity}`
      )
    }

    const unitPrice = Number(product.price)
    const subtotal = unitPrice * item.quantity
    total += subtotal

    itemsToCreate.push({
      productId: item.productId,
      quantity: item.quantity,
      unitPrice,
      subtotal,
      requiresInstallation: product.requiresInstallation,
    })
  }

  return { itemsToCreate, total }
}

// ─────────────────────────────────────────────
// CREAR PEDIDO — TRANSACCIÓN ATÓMICA
// Verifica stock, calcula totales, crea orden + items,
// y descuenta el stock. Si algo falla, todo se revierte.
// Cubre el flujo normal de Tienda y la Dirección A
// (compra de producto + instalación opcional).
// Todo pedido de tienda incluye el costo fijo de delivery (DELIVERY_COST).
// ─────────────────────────────────────────────

export const createProductOrder = async (data: CreateProductOrderInput) => {
  if (!data.items || data.items.length === 0) {
    throw new Error('El pedido debe contener al menos un producto')
  }

  return await prisma.$transaction(async (tx) => {
    const { itemsToCreate, total: itemsTotal } = await processOrderItems(
      tx,
      data.items
    )

    let installationCost: number | null = null
    let total = itemsTotal

    if (data.requiresInstallation) {
      const hasInstallableProduct = itemsToCreate.some(
        (item) => item.requiresInstallation
      )
      if (!hasInstallableProduct) {
        throw new Error(
          'Ninguno de los productos seleccionados admite instalación'
        )
      }
      installationCost = INSTALLATION_COST
      total += installationCost
    }

    const deliveryCost = DELIVERY_COST
    total += deliveryCost

    const order = await tx.productOrder.create({
      data: {
        clientId: data.clientId,
        deliveryMethod: 'HOME_DELIVERY',
        address: data.address,
        deliveryCost,
        total,
        paymentMethod: data.paymentMethod as any,
        notes: data.notes,
        installationCost,
        items: {
          create: itemsToCreate.map(
            ({ requiresInstallation, ...item }) => item
          ),
        },
        statusHistory: {
          create: { status: 'PENDING', comment: 'Pedido creado por el cliente' },
        },
      },
      include: {
        items: {
          include: { product: true },
        },
        client: true,
      },
    })

    // Descontar el stock de cada producto
    for (const item of itemsToCreate) {
      await tx.product.update({
        where: { id: item.productId },
        data: {
          stock: { decrement: item.quantity },
        },
      })

      await tx.inventoryMovement.create({
        data: {
          productId: item.productId,
          type: 'OUT',
          quantity: item.quantity,
          reason: 'Venta — pedido de tienda',
        },
      })
    }

    return order
  })
}

// ─────────────────────────────────────────────
// CREAR PEDIDO VINCULADO A ORDEN DE SERVICIO TÉCNICO
// (Dirección B) — ahora se comporta como una compra normal de tienda,
// exige dirección de entrega y usa el motorizado (DELIVERY) igual que
// cualquier otro pedido. Solo permitido si la Order ya tiene
// presupuesto (budget != null).
// También incluye el costo fijo de delivery (DELIVERY_COST), igual que
// createProductOrder.
// ─────────────────────────────────────────────

export const createLinkedProductOrder = async (
  data: CreateLinkedProductOrderInput
) => {
  if (!data.items || data.items.length === 0) {
    throw new Error('El pedido debe contener al menos un producto')
  }

  const linkedOrder = await prisma.order.findFirst({
    where: { id: data.linkedOrderId, clientId: data.clientId },
  })

  if (!linkedOrder) {
    throw new Error('Orden de servicio técnico no encontrada')
  }

  if (linkedOrder.budget === null) {
    throw new Error(
      'La orden aún no tiene presupuesto asignado por el técnico'
    )
  }

  return await prisma.$transaction(async (tx) => {
    const { itemsToCreate, total: itemsTotal } = await processOrderItems(
      tx,
      data.items
    )

    const nonInstallable = itemsToCreate.find(
      (item) => !item.requiresInstallation
    )
    if (nonInstallable) {
      throw new Error(
        'Todos los productos deben ser repuestos habilitados para instalación'
      )
    }

    const deliveryCost = DELIVERY_COST
    const total = itemsTotal + deliveryCost

    const order = await tx.productOrder.create({
      data: {
        clientId: data.clientId,
        deliveryMethod: 'HOME_DELIVERY',
        address: data.address,
        deliveryCost,
        total,
        paymentMethod: data.paymentMethod as any,
        notes: data.notes,
        linkedOrderId: data.linkedOrderId,
        items: {
          create: itemsToCreate.map(
            ({ requiresInstallation, ...item }) => item
          ),
        },
        statusHistory: {
          create: {
            status: 'PENDING',
            comment: 'Pedido de repuesto vinculado a orden de servicio, creado por el cliente',
          },
        },
      },
      include: {
        items: {
          include: { product: true },
        },
        client: true,
        linkedOrder: true,
      },
    })

    for (const item of itemsToCreate) {
      await tx.product.update({
        where: { id: item.productId },
        data: { stock: { decrement: item.quantity } },
      })

      await tx.inventoryMovement.create({
        data: {
          productId: item.productId,
          type: 'OUT',
          quantity: item.quantity,
          reason: 'Venta — pedido vinculado a orden de servicio técnico',
        },
      })
    }

    return order
  })
}

// ─────────────────────────────────────────────
// SUBIR DATOS DE PAGO (abono parcial o total)
// Guarda cada envío como un registro independiente en
// ProductOrderPaymentSubmission y notifica a los administradores.
// ─────────────────────────────────────────────

export const uploadReceipt = async (
  productOrderId: string,
  clientId: string,
  paymentDetails: Record<string, string>,
  amount: number
) => {
  // Verificar que la orden exista y pertenezca al cliente autenticado.
  // Se incluyen abonos CONFIRMED y PENDING para calcular lo disponible —
  // así el cliente nunca puede enviar de más aunque haya abonos aún sin
  // revisar por el admin (puede seguir pagando a su ritmo sin esperar).
  const order = await prisma.productOrder.findFirst({
    where: { id: productOrderId, clientId },
    include: {
      client: true,
      paymentSubmissions: { where: { status: { in: ['CONFIRMED', 'PENDING'] } } },
    },
  })

  if (!order) {
    throw new Error('Pedido no encontrado')
  }

  if (amount == null || amount <= 0) {
    throw new Error('El monto del pago debe ser mayor a cero')
  }

  const alreadyAccounted = order.paymentSubmissions.reduce(
    (sum, s) => sum + Number(s.amount),
    0
  )
  const remaining = Number(order.total) - alreadyAccounted

  if (amount > remaining + 0.009) {
    throw new Error(
      `El monto excede lo pendiente por pagar. Restante: $${remaining.toFixed(2)}`
    )
  }

  const submission = await prisma.productOrderPaymentSubmission.create({
    data: {
      productOrderId,
      amount,
      paymentDetails,
    },
  })

  // Notificar a todos los administradores activos
  const admins = await prisma.user.findMany({
    where: { role: 'ADMIN', isActive: true },
    select: { id: true },
  })

  if (admins.length > 0) {
    await prisma.notification.createMany({
      data: admins.map((admin) => ({
        type: 'PAYMENT_CONFIRMED',
        channel: 'PUSH',
        message: `${order.client.name} ${order.client.lastName} envió un abono de $${amount.toFixed(2)} para el pedido #${productOrderId.slice(0, 8)}`,
        userId: admin.id,
        productOrderId,
      })),
    })
  }

  return submission
}

// ─────────────────────────────────────────────
// CONFIRMAR O RECHAZAR UN ABONO ESPECÍFICO (acción del administrador)
// Al aprobar: si la suma de abonos confirmados alcanza el total,
// el pedido pasa a CONFIRMED y se asigna motorizado automáticamente.
// Al rechazar: guarda el motivo, el abono queda REJECTED y no cuenta
// para la suma; el cliente puede reenviar un abono nuevo.
// ─────────────────────────────────────────────

export const confirmPartialPayment = async (
  submissionId: string,
  approved: boolean,
  rejectionReason?: string,
  actorEmail?: string
) => {
  const actor = actorEmail
    ? await prisma.user.findUnique({ where: { email: actorEmail }, select: { id: true } })
    : null

  const submission = await prisma.productOrderPaymentSubmission.findUnique({
    where: { id: submissionId },
    include: {
      productOrder: {
        include: {
          client: { include: { user: true } },
          paymentSubmissions: { where: { status: 'CONFIRMED' } },
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

  const productOrderId = submission.productOrderId
  const order = submission.productOrder

  if (!approved && !rejectionReason) {
    throw new Error('rejectionReason es requerido cuando se rechaza el abono')
  }

  let assignedAgentId: string | null = null
  let orderNowComplete = false

  const updated = await prisma.$transaction(async (tx) => {
    await tx.productOrderPaymentSubmission.update({
      where: { id: submissionId },
      data: {
        status: approved ? 'CONFIRMED' : 'REJECTED',
        rejectionReason: approved ? null : rejectionReason,
        confirmedAt: approved ? new Date() : null,
        confirmedByUserId: actor?.id,
      },
    })

    if (approved) {
      const alreadyConfirmed = order.paymentSubmissions.reduce(
        (sum, s) => sum + Number(s.amount),
        0
      )
      const newTotalConfirmed = alreadyConfirmed + Number(submission.amount)
      orderNowComplete = newTotalConfirmed + 0.009 >= Number(order.total)

      if (orderNowComplete) {
        assignedAgentId = await assignDeliveryAgent()

        await tx.productOrder.update({
          where: { id: productOrderId },
          data: {
            status: 'CONFIRMED',
            paidAt: new Date(),
            version: { increment: 1 },
            statusHistory: {
              create: { status: 'CONFIRMED', comment: 'Pago completado, pedido confirmado', userId: actor?.id },
            },
          },
        })

        if (assignedAgentId) {
          await tx.productDelivery.create({
            data: {
              productOrderId,
              agentId: assignedAgentId,
            },
          })
        }
      }
    }

    return tx.productOrder.findUnique({
      where: { id: productOrderId },
      include: {
        items: { include: { product: true } },
        client: true,
        paymentSubmissions: true,
      },
    })
  })

  if (assignedAgentId) {
    await incrementDeliveryLoad(assignedAgentId)
  }

  if (order.client.user) {
    let message: string
    if (!approved) {
      message = `Tu abono de $${Number(submission.amount).toFixed(2)} para el pedido #${productOrderId.slice(0, 8)} fue rechazado: ${rejectionReason}. Por favor envía los datos nuevamente.`
    } else if (orderNowComplete) {
      message = `Tu pago para el pedido #${productOrderId.slice(0, 8)} fue confirmado por completo. Un motorizado fue asignado para tu entrega.`
    } else {
      message = `Tu abono de $${Number(submission.amount).toFixed(2)} para el pedido #${productOrderId.slice(0, 8)} fue confirmado. Aún queda un saldo pendiente.`
    }

    await prisma.notification.create({
      data: {
        type: 'PAYMENT_CONFIRMED',
        channel: 'PUSH',
        message,
        userId: order.client.user.id,
        productOrderId,
      },
    })
  }

  return updated
}

// ─────────────────────────────────────────────
// ADMIN — Cancelar un pedido y devolver el stock reservado
// Solo permite cancelar pedidos en PENDING. Una vez CONFIRMED (pago
// completo, motorizado ya asignado) o DELIVERED, cancelar implicaría
// revertir pagos/asignaciones ya hechas — eso queda fuera de este alcance.
// ─────────────────────────────────────────────

export const cancelProductOrder = async (productOrderId: string, actorEmail?: string) => {
  const actor = actorEmail
    ? await prisma.user.findUnique({ where: { email: actorEmail }, select: { id: true } })
    : null

  const order = await prisma.productOrder.findUnique({
    where: { id: productOrderId },
    include: { items: true, client: { include: { user: true } } },
  })

  if (!order) {
    throw new Error('Pedido no encontrado')
  }

  if (order.status !== 'PENDING') {
    throw new Error(
      `Solo se pueden cancelar pedidos en estado PENDING. Este pedido está en ${order.status}.`
    )
  }

  const updated = await prisma.$transaction(async (tx) => {
    for (const item of order.items) {
      await tx.product.update({
        where: { id: item.productId },
        data: { stock: { increment: item.quantity } },
      })

      await tx.inventoryMovement.create({
        data: {
          productId: item.productId,
          type: 'IN',
          quantity: item.quantity,
          reason: 'Pedido cancelado, stock liberado',
          userId: actor?.id,
        },
      })
    }

    return tx.productOrder.update({
      where: { id: productOrderId },
      data: {
        status: 'CANCELLED',
        statusHistory: {
          create: { status: 'CANCELLED', comment: 'Pedido cancelado, stock liberado', userId: actor?.id },
        },
      },
      include: {
        items: { include: { product: true } },
        client: true,
      },
    })
  })

  if (order.client.user) {
    await prisma.notification.create({
      data: {
        type: 'STATUS_CHANGE',
        channel: 'PUSH',
        message: `Tu pedido #${productOrderId.slice(0, 8)} fue cancelado. El stock reservado fue liberado.`,
        userId: order.client.user.id,
        productOrderId,
      },
    })
  }

  return updated
}

// ─────────────────────────────────────────────
// CONSULTAS
// ─────────────────────────────────────────────

export const getOrdersByClient = async (clientId: string) => {
  return await prisma.productOrder.findMany({
    where: { clientId },
    include: {
      items: {
        include: { product: true },
      },
      delivery: {
        include: { agent: { select: { id: true, name: true, phone: true } } },
      },
      paymentSubmissions: {
        orderBy: { createdAt: 'asc' },
      },
    },
    orderBy: { createdAt: 'desc' },
  })
}

export const getProductOrderById = async (id: string, clientId: string) => {
  return await prisma.productOrder.findFirst({
    where: { id, clientId },
    include: {
      items: {
        include: { product: true },
      },
      delivery: {
        include: { agent: { select: { id: true, name: true, phone: true } } },
      },
      paymentSubmissions: {
        orderBy: { createdAt: 'asc' },
      },
    },
  })
}

// ─────────────────────────────────────────────
// ADMIN — Listar todos los pedidos de tienda, sin filtrar por cliente (Fase 4)
// ─────────────────────────────────────────────

export const getAllOrders = async () => {
  return await prisma.productOrder.findMany({
    include: {
      items: { include: { product: true } },
      client: true,
      delivery: { include: { agent: { select: { id: true, name: true } } } },
      linkedOrder: { select: { id: true, orderNumber: true } },
      paymentSubmissions: {
        orderBy: { createdAt: 'asc' },
      },
    },
    orderBy: { createdAt: 'desc' },
  })
}

// ─────────────────────────────────────────────
// ASIGNACIÓN AUTOMÁTICA DE MOTORIZADO (DELIVERY)
// Mismo criterio que assignTechnician() en orders.service.ts:
// menos carga activa primero. Reutiliza los campos genéricos de
// User (activeOrderCount, maxOrderCapacity, technicianStatus).
// ─────────────────────────────────────────────

const assignDeliveryAgent = async (): Promise<string | null> => {
  const available = await prisma.user.findMany({
    where: {
      role: 'DELIVERY',
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
      role: 'DELIVERY',
      isActive: true,
      technicianStatus: 'BUSY',
    },
    orderBy: { activeOrderCount: 'asc' },
  })

  const underCapacity = busy.filter(
    (agent) => agent.activeOrderCount < agent.maxOrderCapacity
  )

  return underCapacity.length > 0 ? underCapacity[0].id : null
}

const incrementDeliveryLoad = async (agentId: string) => {
  const agent = await prisma.user.findUnique({ where: { id: agentId } })
  if (!agent) return

  const newCount = agent.activeOrderCount + 1
  const newStatus = newCount >= agent.maxOrderCapacity ? 'SATURATED' : 'BUSY'

  await prisma.user.update({
    where: { id: agentId },
    data: { activeOrderCount: newCount, technicianStatus: newStatus },
  })
}

export const decrementDeliveryLoad = async (agentId: string) => {
  const agent = await prisma.user.findUnique({ where: { id: agentId } })
  if (!agent) return

  const newCount = Math.max(0, agent.activeOrderCount - 1)
  const newStatus = newCount === 0 ? 'AVAILABLE' : 'BUSY'

  await prisma.user.update({
    where: { id: agentId },
    data: { activeOrderCount: newCount, technicianStatus: newStatus },
  })
}

// ─────────────────────────────────────────────
// MOTORIZADO — Marcar pedido como entregado (Fase 4)
// Verifica que el motorizado autenticado sea el agente asignado a
// ese ProductDelivery antes de marcarlo. Libera su carga de trabajo.
// ─────────────────────────────────────────────

export const markAsDelivered = async (productOrderId: string, email: string) => {
  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) {
    throw new Error('Usuario no encontrado')
  }

  const delivery = await prisma.productDelivery.findUnique({
    where: { productOrderId },
  })

  if (!delivery) {
    throw new Error('Este pedido no tiene un motorizado asignado')
  }

  if (delivery.agentId !== user.id) {
    throw new Error('No estás asignado a este pedido')
  }

  const updated = await prisma.$transaction(async (tx) => {
    const updatedDelivery = await tx.productDelivery.update({
      where: { productOrderId },
      data: {
        status: 'DELIVERED',
        deliveredAt: new Date(),
        deliveryCommission: DELIVERY_COMMISSION,
      },
      include: { productOrder: true },
    })

    await tx.productOrder.update({
      where: { id: productOrderId },
      data: {
        status: 'DELIVERED',
        statusHistory: {
          create: { status: 'DELIVERED', comment: 'Entregado por el motorizado', userId: user.id },
        },
      },
    })

    return updatedDelivery
  })

  await decrementDeliveryLoad(user.id)

  return updated
}

// ─────────────────────────────────────────────
// CLIENTE — Confirmar recepción del pedido (Fase 4)
// ─────────────────────────────────────────────

export const confirmReceived = async (productOrderId: string, clientId: string) => {
  const order = await prisma.productOrder.findFirst({
    where: { id: productOrderId, clientId },
  })

  if (!order) {
    throw new Error('Pedido no encontrado')
  }

  const delivery = await prisma.productDelivery.findUnique({
    where: { productOrderId },
  })

  if (!delivery) {
    throw new Error('Este pedido aún no tiene registro de entrega')
  }

  if (!delivery.deliveredAt) {
    throw new Error('El motorizado aún no ha marcado este pedido como entregado')
  }

  return await prisma.productDelivery.update({
    where: { productOrderId },
    data: { clientConfirmedAt: new Date() },
    include: { productOrder: true },
  })
}

// ─────────────────────────────────────────────
// RESOLVER agentId (User.id) DESDE EL USUARIO AUTENTICADO
// A diferencia del cliente, el motorizado NO tiene un modelo
// intermedio (Client) — el agentId de ProductDelivery ES el User.id.
// ─────────────────────────────────────────────

export const resolveAgentIdFromEmail = async (
  email: string
): Promise<string | null> => {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, role: true },
  })
  if (!user || user.role !== 'DELIVERY') return null
  return user.id
}

// ─────────────────────────────────────────────
// MOTORIZADO — Listar entregas asignadas (Fase 4)
// ─────────────────────────────────────────────

export const getDeliveriesByAgent = async (agentId: string) => {
  return await prisma.productDelivery.findMany({
    where: { agentId },
    include: {
      productOrder: {
        include: {
          items: { include: { product: true } },
          client: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })
}