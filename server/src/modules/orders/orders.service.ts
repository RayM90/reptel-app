import prisma from '../../lib/prisma'
import QRCode from 'qrcode'

const generateOrderNumber = (): string => {
  const date = new Date()
  const year = date.getFullYear().toString().slice(-2)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const random = Math.floor(Math.random() * 9000) + 1000
  return `REP-${year}${month}${day}-${random}`
}

export const getAllOrders = async () => {
  return await prisma.order.findMany({
    include: {
      client: { select: { id: true, name: true, email: true, phone: true } },
      technician: { select: { id: true, name: true, email: true } },
      device: true,
      statusHistory: { orderBy: { createdAt: 'desc' } },
    },
    orderBy: { receivedAt: 'desc' },
  })
}

export const getOrderById = async (id: string) => {
  return await prisma.order.findUnique({
    where: { id },
    include: {
      client: { select: { id: true, name: true, email: true, phone: true } },
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
      client: { select: { id: true, name: true, phone: true } },
      device: true,
      statusHistory: { orderBy: { createdAt: 'desc' } },
    },
  })
}

export const createOrder = async (data: {
  clientId: string
  deviceId: string
  problem: string
  observations?: string
  technicianId?: string
}) => {
  const orderNumber = generateOrderNumber()
  const trackingUrl = `http://localhost:3000/api/orders/track/${orderNumber}`
  const qrCode = await QRCode.toDataURL(trackingUrl)

  return await prisma.order.create({
    data: {
      orderNumber,
      qrCode,
      clientId: data.clientId,
      deviceId: data.deviceId,
      problem: data.problem,
      observations: data.observations,
      technicianId: data.technicianId,
      statusHistory: {
        create: {
          status: 'RECEIVED',
          comment: 'Orden creada y equipo recibido en el taller',
        },
      },
    },
    include: {
      client: { select: { id: true, name: true, email: true, phone: true } },
      device: true,
      statusHistory: true,
    },
  })
}

export const updateOrderStatus = async (
  id: string,
  status: string,
  comment?: string,
  technicianId?: string
) => {
  return await prisma.order.update({
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
      client: { select: { id: true, name: true, email: true, phone: true } },
      technician: { select: { id: true, name: true } },
      device: true,
      statusHistory: { orderBy: { createdAt: 'desc' } },
    },
  })
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
      client: { select: { id: true, name: true, email: true, phone: true } },
      device: true,
      statusHistory: { orderBy: { createdAt: 'desc' } },
    },
  })
}