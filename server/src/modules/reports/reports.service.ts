import prisma from '../../lib/prisma'

interface ReportFilters {
  from: Date
  to: Date
  technicianId?: string
  clientId?: string
}

export const getReportSummary = async ({ from, to, technicianId, clientId }: ReportFilters) => {
  const orders = await prisma.order.findMany({
    where: {
      status: 'DELIVERED',
      deliveredAt: { gte: from, lte: to },
      ...(technicianId ? { technicianId } : {}),
      ...(clientId ? { clientId } : {}),
    },
    include: {
      client: { select: { id: true, name: true, lastName: true } },
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
      orderNumber: o.orderNumber,
      clientName: `${o.client.name} ${o.client.lastName}`,
      technicianName: o.technician?.name ?? 'Sin asignar',
      deliveredAt: o.deliveredAt,
      budget: Number(o.budget ?? 0),
      technicianCommission: Number(o.technicianCommission ?? 0),
    })),
  }

  const productOrders = await prisma.productOrder.findMany({
    where: {
      status: 'DELIVERED',
      delivery: { deliveredAt: { gte: from, lte: to } },
      ...(clientId ? { clientId } : {}),
    },
    include: {
      client: { select: { id: true, name: true, lastName: true } },
      delivery: { include: { agent: { select: { id: true, name: true } } } },
    },
    orderBy: { createdAt: 'asc' },
  })

  const totalSales = productOrders.reduce((sum, po) => sum + Number(po.total), 0)
  const totalDeliveryCommission = productOrders.reduce(
    (sum, po) => sum + Number(po.delivery?.deliveryCommission ?? 0),
    0
  )

  const byMotorizadoMap = new Map<
    string,
    { agentId: string; agentName: string; deliveriesCount: number; totalCommission: number }
  >()
  for (const po of productOrders) {
    const agent = po.delivery?.agent
    if (!agent) continue
    const entry = byMotorizadoMap.get(agent.id) ?? {
      agentId: agent.id,
      agentName: agent.name,
      deliveriesCount: 0,
      totalCommission: 0,
    }
    entry.deliveriesCount += 1
    entry.totalCommission += Number(po.delivery?.deliveryCommission ?? 0)
    byMotorizadoMap.set(agent.id, entry)
  }

  const tiendaByClientMap = new Map<
    string,
    { clientId: string; clientName: string; ordersCount: number; totalSales: number }
  >()
  for (const po of productOrders) {
    const entry = tiendaByClientMap.get(po.client.id) ?? {
      clientId: po.client.id,
      clientName: `${po.client.name} ${po.client.lastName}`,
      ordersCount: 0,
      totalSales: 0,
    }
    entry.ordersCount += 1
    entry.totalSales += Number(po.total)
    tiendaByClientMap.set(po.client.id, entry)
  }

  const tienda = {
    totalSales,
    totalDeliveryCommission,
    ordersCount: productOrders.length,
    byMotorizado: Array.from(byMotorizadoMap.values()),
    byClient: Array.from(tiendaByClientMap.values()),
    orders: productOrders.map((po) => ({
      id: po.id,
      clientName: `${po.client.name} ${po.client.lastName}`,
      agentName: po.delivery?.agent.name ?? 'Sin asignar',
      deliveredAt: po.delivery?.deliveredAt ?? null,
      total: Number(po.total),
      deliveryCommission: Number(po.delivery?.deliveryCommission ?? 0),
    })),
  }

  return { range: { from, to }, servicio, tienda }
}
