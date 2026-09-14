import prisma from '../../lib/prisma'
import { formatFullName } from '../../lib/format'

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
      clientName: formatFullName(o.client.name, o.client.lastName),
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
      clientName: formatFullName(o.client.name, o.client.lastName),
      technicianName: o.technician?.name ?? 'Sin asignar',
      deliveredAt: o.deliveredAt,
      budget: Number(o.budget ?? 0),
      technicianCommission: Number(o.technicianCommission ?? 0),
    })),
  }

  return { range: { from, to }, servicio }
}
