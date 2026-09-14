import prisma from '../../lib/prisma'

export const getAllClients = async () => {
  return await prisma.client.findMany({
    orderBy: { createdAt: 'desc' },
  })
}

export const getClientById = async (id: string) => {
  return await prisma.client.findUnique({
    where: { id },
    include: {
      orders: {
        include: {
          device: true,
          statusHistory: { orderBy: { createdAt: 'desc' } },
        },
        orderBy: { receivedAt: 'desc' },
      },
    },
  })
}

export const getClientByIdNumber = async (idNumber: string) => {
  return await prisma.client.findUnique({
    where: { idNumber },
    include: {
      orders: {
        include: {
          device: true,
          statusHistory: { orderBy: { createdAt: 'desc' } },
        },
        orderBy: { receivedAt: 'desc' },
      },
    },
  })
}

export const createClient = async (data: {
  name: string
  lastName: string
  idNumber: string
  phone: string
  email?: string
  contactPerson?: string
  addressState?: string
  addressCity?: string
  addressNeighborhood?: string
  addressStreet?: string
  addressBuilding?: string
}) => {
  return await prisma.client.create({ data })
}

export const updateClient = async (
  id: string,
  data: {
    name?: string
    lastName?: string
    phone?: string
    email?: string
    contactPerson?: string
    addressState?: string
    addressCity?: string
    addressNeighborhood?: string
    addressStreet?: string
    addressBuilding?: string
  }
) => {
  // Envuelve Client.update y User.update en una transacción para evitar
  // desincronización si una de las escrituras falla (e.g., constraint violation).
  const updated = await prisma.$transaction(async (tx) => {
    const clientUpdated = await tx.client.update({ where: { id }, data })

    // El User vinculado (si existe) duplica name/phone/email para no tener
    // que hacer join en cada lectura — hallazgo de auditoría: sin este sync
    // quedaban desincronizados en cuanto se editaba solo uno de los dos.
    // Se usa `!== undefined` (no truthy) porque lastName puede llegar como
    // '' para un cliente empresa/gobierno sin apellido — un check truthy
    // descartaría ese '' silenciosamente y dejaría el User desincronizado.
    const linkedUser = await tx.user.findUnique({ where: { clientId: id }, select: { id: true } })
    const hasUserSyncableChange =
      data.name !== undefined || data.lastName !== undefined || data.phone !== undefined || data.email !== undefined
    if (linkedUser && hasUserSyncableChange) {
      await tx.user.update({
        where: { id: linkedUser.id },
        data: {
          ...(data.name !== undefined && { name: data.name }),
          ...(data.lastName !== undefined && { lastName: data.lastName }),
          ...(data.phone !== undefined && { phone: data.phone }),
          ...(data.email !== undefined && { email: data.email }),
        },
      })
    }

    return clientUpdated
  })

  return updated
}

export const searchClients = async (query: string) => {
  return await prisma.client.findMany({
    where: {
      OR: [
        { name: { contains: query } },
        { lastName: { contains: query } },
        { idNumber: { contains: query } },
        { phone: { contains: query } },
      ],
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
  })
}