import prisma from '../../lib/prisma'

export const getAllOrders = async () => {
  return await prisma.order.findMany({
    include: {
      client: true,
      technician: true,
      device: true,
      statusHistory: true,
    },
    orderBy: {
      receivedAt: 'desc',
    },
  })
}

export const getOrderById = async (id: string) => {
  return await prisma.order.findUnique({
    where: { id },
    include: {
      client: true,
      technician: true,
      device: true,
      statusHistory: true,
      notifications: true,
      documents: true,
    },
  })
}

export const createOrder = async (data: {
  clientId: string
  deviceId: string
  problem: string
  orderNumber: string
}) => {
  return await prisma.order.create({
    data: {
      ...data,
      statusHistory: {
        create: {
          status: 'RECEIVED',
          comment: 'Orden creada y equipo recibido',
        },
      },
    },
    include: {
      client: true,
      device: true,
      statusHistory: true,
    },
  })
}

export const updateOrderStatus = async (
  id: string,
  status: string,
  comment?: string
) => {
  return await prisma.order.update({
    where: { id },
    data: {
      status: status as any,
      statusHistory: {
        create: {
          status: status as any,
          comment,
        },
      },
    },
    include: {
      statusHistory: true,
    },
  })
}