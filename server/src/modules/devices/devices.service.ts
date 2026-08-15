import prisma from '../../lib/prisma'

export const getAllDevices = async () => {
  return prisma.device.findMany({
    include: {
      orders: {
        select: {
          id: true,
          orderNumber: true,
          status: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })
}

export const getDeviceById = async (id: string, requestingClientId?: string) => {
  return prisma.device.findFirst({
    where: {
      id,
      // Si quien pregunta es un CLIENT, solo puede ver el dispositivo si
      // tiene al menos una orden propia asociada — evita que un cliente
      // vea equipos (y su devicePassword) de otro cliente adivinando el id.
      // Si no se pasa requestingClientId (uso de ADMIN/TECHNICIAN_DELIVERY
      // desde el controller), no se filtra.
      ...(requestingClientId ? { orders: { some: { clientId: requestingClientId } } } : {}),
    },
    include: {
      orders: {
        include: {
          client: true,
          statusHistory: { orderBy: { createdAt: 'desc' } },
        },
      },
    },
  })
}

export const createDevice = async (data: {
  type: string
  brand: string
  model: string
  serialNumber?: string
  color?: string
  accessories?: string
  devicePassword?: string
}) => {
  return prisma.device.create({
    data: {
      type: data.type as any,
      brand: data.brand,
      model: data.model,
      serialNumber: data.serialNumber,
      color: data.color,
      accessories: data.accessories,
      devicePassword: data.devicePassword,
    },
  })
}

export const updateDevice = async (
  id: string,
  data: {
    brand?: string
    model?: string
    serialNumber?: string
    color?: string
    accessories?: string
    devicePassword?: string
  }
) => {
  return prisma.device.update({
    where: { id },
    data,
  })
}