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
      orderId: o.id,
      orderNumber: o.orderNumber,
      clientName: `${o.client.name} ${o.client.lastName}`,
      technicianName: o.technician?.name ?? 'Sin asignar',
      deliveredAt: o.deliveredAt,
      budget: Number(o.budget ?? 0),
      technicianCommission: Number(o.technicianCommission ?? 0),
    })),
  }

  // Tienda física (mostrador) — la venta no tiene clientId ni monto propio
  // (decisión del sub-proyecto 3): se aproxima con cantidad × precio actual
  // del producto, y clientId no aplica como filtro (no hay ese vínculo).
  const sales = await prisma.inventoryMovement.findMany({
    where: {
      type: 'OUT',
      channel: 'MOSTRADOR',
      reason: 'Venta mostrador',
      createdAt: { gte: from, lte: to },
    },
    include: { product: { select: { id: true, name: true, price: true } } },
    orderBy: { createdAt: 'desc' },
  })

  const totalSalesAmount = sales.reduce((sum, m) => sum + m.quantity * Number(m.product.price), 0)

  const byProductMap = new Map<
    string,
    { productId: string; productName: string; quantitySold: number; totalAmount: number }
  >()
  for (const m of sales) {
    const entry = byProductMap.get(m.product.id) ?? {
      productId: m.product.id,
      productName: m.product.name,
      quantitySold: 0,
      totalAmount: 0,
    }
    entry.quantitySold += m.quantity
    entry.totalAmount += m.quantity * Number(m.product.price)
    byProductMap.set(m.product.id, entry)
  }

  const tienda = {
    totalSalesAmount,
    salesCount: sales.length,
    byProduct: Array.from(byProductMap.values()),
    sales: sales.map((m) => ({
      id: m.id,
      productName: m.product.name,
      quantity: m.quantity,
      amount: m.quantity * Number(m.product.price),
      createdAt: m.createdAt,
    })),
  }

  return { range: { from, to }, servicio, tienda }
}
