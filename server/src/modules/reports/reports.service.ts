import prisma from '../../lib/prisma'
import * as clientsService from '../clients/clients.service'

interface ReportFilters {
  from: Date
  to: Date
  technicianId?: string
  clientId?: string
  channel?: 'WEB' | 'APK'
}

// El canal se deriva de deliveryAmount: no-nulo significa que la orden nació
// por self-service (APK, apps/mobile, POST /orders/self-service); nulo
// significa mostrador (Web, admin-web, POST /orders/counter). La ruta legacy
// POST /orders (admin, sin pago) también cae en WEB — caso raro, aproximación
// documentada en el spec.
export const getOrderChannel = (order: { deliveryAmount: unknown }): 'WEB' | 'APK' =>
  order.deliveryAmount != null ? 'APK' : 'WEB'

export const getReportSummary = async ({ from, to, technicianId, clientId, channel }: ReportFilters) => {
  const orders = await prisma.order.findMany({
    where: {
      status: 'DELIVERED',
      deliveredAt: { gte: from, lte: to },
      ...(technicianId ? { technicianId } : {}),
      ...(clientId ? { clientId } : {}),
      ...(channel === 'APK' ? { deliveryAmount: { not: null } } : {}),
      ...(channel === 'WEB' ? { deliveryAmount: null } : {}),
    },
    include: {
      client: { select: { id: true, name: true, lastName: true, idNumber: true } },
      technician: { select: { id: true, name: true } },
    },
    orderBy: { deliveredAt: 'asc' },
  })

  const totalBudget = orders.reduce((sum, o) => sum + Number(o.budget ?? 0), 0)
  const totalTechnicianCommission = orders.reduce(
    (sum, o) => sum + Number(o.technicianCommission ?? 0),
    0
  )

  const byTechnicianMap = new Map<
    string,
    { technicianId: string; technicianName: string; ordersCount: number; totalCommission: number }
  >()
  for (const o of orders) {
    if (!o.technician) continue
    const entry = byTechnicianMap.get(o.technician.id) ?? {
      technicianId: o.technician.id,
      technicianName: o.technician.name,
      ordersCount: 0,
      totalCommission: 0,
    }
    entry.ordersCount += 1
    entry.totalCommission += Number(o.technicianCommission ?? 0)
    byTechnicianMap.set(o.technician.id, entry)
  }

  const servicioByClientMap = new Map<
    string,
    { clientId: string; clientName: string; ordersCount: number; totalBudget: number }
  >()
  for (const o of orders) {
    const entry = servicioByClientMap.get(o.client.id) ?? {
      clientId: o.client.id,
      clientName: `${o.client.name} ${o.client.lastName}`,
      ordersCount: 0,
      totalBudget: 0,
    }
    entry.ordersCount += 1
    entry.totalBudget += Number(o.budget ?? 0)
    servicioByClientMap.set(o.client.id, entry)
  }

  const servicio = {
    totalBudget,
    totalTechnicianCommission,
    ordersCount: orders.length,
    byTechnician: Array.from(byTechnicianMap.values()),
    byClient: Array.from(servicioByClientMap.values()),
    orders: orders.map((o) => ({
      orderId: o.id,
      orderNumber: o.orderNumber,
      clientName: `${o.client.name} ${o.client.lastName}`,
      clientIdNumber: o.client.idNumber,
      technicianName: o.technician?.name ?? 'Sin asignar',
      deliveredAt: o.deliveredAt,
      budget: Number(o.budget ?? 0),
      technicianCommission: Number(o.technicianCommission ?? 0),
      channel: getOrderChannel(o),
    })),
  }

  // Mermas: KPI global independiente de cliente/técnico/canal — solo depende
  // del rango de fechas. Aproximación (Finding de diseño 2026-09-14): no hay
  // modelo de merma dedicado, se estima con InventoryMovement OUT/AJUSTE_MANUAL.
  const mermaMovements = await prisma.inventoryMovement.findMany({
    where: { type: 'OUT', channel: 'AJUSTE_MANUAL', createdAt: { gte: from, lte: to } },
    include: { product: { select: { price: true } } },
  })
  const mermasTotal = mermaMovements.reduce(
    (sum, m) => sum + m.quantity * Number(m.unitPriceAtUse ?? m.product.price),
    0
  )

  return { range: { from, to }, servicio, mermas: { total: mermasTotal, count: mermaMovements.length } }
}

interface AuditFilters {
  from: Date
  to: Date
  status?: string
  channel?: 'WEB' | 'APK'
  technicianId?: string
  clientId?: string
}

export const getAuditReport = async ({ from, to, status, channel, technicianId, clientId }: AuditFilters) => {
  const orders = await prisma.order.findMany({
    where: {
      receivedAt: { gte: from, lte: to },
      ...(status ? { status: status as any } : {}),
      ...(technicianId ? { technicianId } : {}),
      ...(clientId ? { clientId } : {}),
      ...(channel === 'APK' ? { deliveryAmount: { not: null } } : {}),
      ...(channel === 'WEB' ? { deliveryAmount: null } : {}),
    },
    include: {
      client: { select: { id: true, name: true, lastName: true, idNumber: true } },
      technician: { select: { id: true, name: true } },
      inventoryMovements: {
        where: { channel: 'SERVICIO_TECNICO', reversedAt: null },
        include: { product: { select: { name: true } } },
      },
    },
    orderBy: { receivedAt: 'desc' },
  })

  return orders.map((o) => ({
    orderId: o.id,
    orderNumber: o.orderNumber,
    receivedAt: o.receivedAt,
    deliveredAt: o.deliveredAt,
    status: o.status,
    channel: getOrderChannel(o),
    clientName: `${o.client.name} ${o.client.lastName}`,
    clientIdNumber: o.client.idNumber,
    technicianName: o.technician?.name ?? 'Sin asignar',
    technicianCommission: Number(o.technicianCommission ?? 0),
    diagnosis: o.diagnosis,
    totalAmount: o.budget != null
      ? Number(o.budget)
      : Number(o.revisionAmount ?? 0) + Number(o.deliveryAmount ?? 0),
    partsUsed: o.inventoryMovements.map((m) => ({
      productName: m.product.name,
      quantity: m.quantity,
    })),
  }))
}

const ACTIVE_ORDER_STATUSES = new Set([
  'PENDING_PAYMENT', 'RECEIVED', 'DIAGNOSING', 'WAITING_APPROVAL',
  'APPROVED', 'REPAIRING', 'WAITING_PART', 'READY', 'PAID_PENDING_DELIVERY',
])

const orderTotalAmount = (o: { budget: unknown; revisionAmount: unknown; deliveryAmount: unknown }) =>
  o.budget != null
    ? Number(o.budget)
    : Number(o.revisionAmount ?? 0) + Number(o.deliveryAmount ?? 0)

// Expediente de cliente por cédula/RIF. Reusa clientsService.getClientByIdNumber
// (ya trae client.orders con device + statusHistory) en vez de duplicar la
// consulta. "Casos de garantía" es una aproximación (Finding de diseño
// 2026-09-14, sin modelo dedicado): 2ª orden sobre el mismo deviceId cuyo
// receivedAt cae dentro de 30 días desde el deliveredAt de una orden previa
// DELIVERED del mismo equipo.
export const getClientHistoryReport = async (idNumber: string) => {
  const client = await clientsService.getClientByIdNumber(idNumber)
  if (!client) return null

  const totalPaid = client.orders
    .filter((o) => o.status === 'DELIVERED')
    .reduce((sum, o) => sum + orderTotalAmount(o), 0)

  const devicesIngresados = new Set(client.orders.map((o) => o.deviceId)).size

  const activeOrders = client.orders
    .filter((o) => ACTIVE_ORDER_STATUSES.has(o.status))
    .map((o) => ({ orderId: o.id, orderNumber: o.orderNumber, status: o.status, deviceId: o.deviceId }))

  const WARRANTY_WINDOW_MS = 30 * 24 * 60 * 60 * 1000
  const byDevice = new Map<string, typeof client.orders>()
  for (const o of client.orders) {
    const list = byDevice.get(o.deviceId) ?? []
    list.push(o)
    byDevice.set(o.deviceId, list)
  }
  const possibleWarrantyCases: { orderId: string; orderNumber: string }[] = []
  for (const list of byDevice.values()) {
    const sorted = [...list].sort((a, b) => a.receivedAt.getTime() - b.receivedAt.getTime())
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1]
      const curr = sorted[i]
      if (
        prev.status === 'DELIVERED' &&
        prev.deliveredAt &&
        curr.receivedAt.getTime() - prev.deliveredAt.getTime() <= WARRANTY_WINDOW_MS
      ) {
        possibleWarrantyCases.push({ orderId: curr.id, orderNumber: curr.orderNumber })
      }
    }
  }

  return {
    client: {
      id: client.id,
      name: client.name,
      lastName: client.lastName,
      idNumber: client.idNumber,
      phone: client.phone,
      email: client.email,
    },
    devicesIngresados,
    totalPaid,
    activeOrders,
    possibleWarrantyCases,
    history: client.orders.map((o) => ({
      orderId: o.id,
      orderNumber: o.orderNumber,
      receivedAt: o.receivedAt,
      deliveredAt: o.deliveredAt,
      status: o.status,
      deviceLabel: `${o.device.brand} ${o.device.model}`,
      totalAmount: orderTotalAmount(o),
    })),
  }
}

// A diferencia de orders.service.getAvailableTechnicians (que filtra
// isActive/technicianStatus para asignación operativa), este endpoint es
// para reportes históricos: un técnico inactivo o de baja sigue teniendo
// órdenes pasadas que buscar.
export const getReportTechnicians = async () => {
  return await prisma.user.findMany({
    where: { role: { in: ['TECHNICIAN_DELIVERY', 'TECHNICIAN'] } },
    select: { id: true, name: true, idNumber: true },
    orderBy: { name: 'asc' },
  })
}
