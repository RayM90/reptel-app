import { Prisma } from '@prisma/client'
import prisma from '../../lib/prisma'
import { INSTALLATION_COST } from '../../config/constants'

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
  receiptUrl?: string
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
// ─────────────────────────────────────────────

const processOrderItems = async (
  tx: Prisma.TransactionClient,
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

    const order = await tx.productOrder.create({
      data: {
        clientId: data.clientId,
        deliveryMethod: 'HOME_DELIVERY',
        address: data.address,
        total,
        paymentMethod: data.paymentMethod as any,
        notes: data.notes,
        requiresInstallation: !!data.requiresInstallation,
        installationCost,
        items: {
          create: itemsToCreate.map(
            ({ requiresInstallation, ...item }) => item
          ),
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
    }

    return order
  })
}

// ─────────────────────────────────────────────
// CREAR PEDIDO VINCULADO A ORDEN DE SERVICIO TÉCNICO
// (Dirección B) — sin dirección/delivery propio, el técnico ya
// asignado a la Order trae el repuesto en su próxima visita.
// Solo permitido si la Order ya tiene presupuesto (budget != null).
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
    const { itemsToCreate, total } = await processOrderItems(tx, data.items)

    const nonInstallable = itemsToCreate.find(
      (item) => !item.requiresInstallation
    )
    if (nonInstallable) {
      throw new Error(
        'Todos los productos deben ser repuestos habilitados para instalación'
      )
    }

    const order = await tx.productOrder.create({
      data: {
        clientId: data.clientId,
        deliveryMethod: 'TECHNICIAN_DELIVERY',
        total,
        paymentMethod: data.paymentMethod as any,
        notes: data.notes,
        receiptUrl: data.receiptUrl,
        linkedOrderId: data.linkedOrderId,
        items: {
          create: itemsToCreate.map(
            ({ requiresInstallation, ...item }) => item
          ),
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

    // Descontar el stock de cada producto
    for (const item of itemsToCreate) {
      await tx.product.update({
        where: { id: item.productId },
        data: {
          stock: { decrement: item.quantity },
        },
      })
    }

    return order
  })
}

// ─────────────────────────────────────────────
// SUBIR COMPROBANTE DE PAGO
// Guarda la URL de la imagen y notifica a todos los administradores
// ─────────────────────────────────────────────

export const uploadReceipt = async (
  productOrderId: string,
  clientId: string,
  receiptUrl: string
) => {
  // Verificar que la orden exista y pertenezca al cliente autenticado
  const order = await prisma.productOrder.findFirst({
    where: { id: productOrderId, clientId },
    include: { client: true },
  })

  if (!order) {
    throw new Error('Pedido no encontrado')
  }

  // Guardar la URL del comprobante
  const updatedOrder = await prisma.productOrder.update({
    where: { id: productOrderId },
    data: { receiptUrl },
    include: {
      items: { include: { product: true } },
      client: true,
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
        message: `${order.client.name} ${order.client.lastName} subió un comprobante de pago para el pedido #${productOrderId.slice(0, 8)}`,
        userId: admin.id,
        productOrderId,
      })),
    })
  }

  return updatedOrder
}

// ─────────────────────────────────────────────
// CONFIRMAR O RECHAZAR PAGO (acción del administrador)
// Notifica de vuelta al cliente con el resultado
// ─────────────────────────────────────────────

export const confirmPayment = async (
  productOrderId: string,
  approved: boolean
) => {
  const order = await prisma.productOrder.findUnique({
    where: { id: productOrderId },
    include: { client: { include: { user: true } } },
  })

  if (!order) {
    throw new Error('Pedido no encontrado')
  }

  const updatedOrder = await prisma.productOrder.update({
    where: { id: productOrderId },
    data: {
      status: approved ? 'CONFIRMED' : 'PENDING',
      paidAt: approved ? new Date() : null,
      ...(approved ? {} : { receiptUrl: null }),
    },
    include: {
      items: { include: { product: true } },
      client: true,
    },
  })

  // Notificar al cliente del resultado (si tiene cuenta de usuario vinculada)
  if (order.client.user) {
    await prisma.notification.create({
      data: {
        type: 'PAYMENT_CONFIRMED',
        channel: 'PUSH',
        message: approved
          ? `Tu pago para el pedido #${productOrderId.slice(0, 8)} fue confirmado. ¡Gracias por tu compra!`
          : `No pudimos confirmar tu comprobante para el pedido #${productOrderId.slice(0, 8)}. Por favor sube un nuevo comprobante.`,
        userId: order.client.user.id,
        productOrderId,
      },
    })
  }

  return updatedOrder
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
      delivery: true,
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
      delivery: true,
      invoice: true,
    },
  })
}