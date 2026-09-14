import prisma from '../../lib/prisma'

export const getAllClients = async () => {
  return await prisma.client.findMany({
    orderBy: { createdAt: 'desc' },
    include: { addresses: true },
  })
}

export const getClientById = async (id: string) => {
  return await prisma.client.findUnique({
    where: { id },
    include: {
      addresses: true,
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
      addresses: true,
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
  const { addressState, addressCity, addressNeighborhood, addressStreet, addressBuilding, ...clientFields } = data
  return await prisma.client.create({
    data: {
      ...clientFields,
      addresses: {
        create: [{ label: 'Principal', isPrimary: true, addressState, addressCity, addressNeighborhood, addressStreet, addressBuilding }],
      },
    },
    include: { addresses: true },
  })
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
  const { addressState, addressCity, addressNeighborhood, addressStreet, addressBuilding, ...clientFields } = data
  const hasAddressChange = [addressState, addressCity, addressNeighborhood, addressStreet, addressBuilding].some(
    (v) => v !== undefined
  )

  // Envuelve Client.update y User.update en una transacción para evitar
  // desincronización si una de las escrituras falla (e.g., constraint violation).
  await prisma.$transaction(async (tx) => {
    await tx.client.update({ where: { id }, data: clientFields })

    if (hasAddressChange) {
      const primary = await tx.clientAddress.findFirst({ where: { clientId: id, isPrimary: true } })
      if (primary) {
        await tx.clientAddress.update({
          where: { id: primary.id },
          data: { addressState, addressCity, addressNeighborhood, addressStreet, addressBuilding },
        })
      } else {
        await tx.clientAddress.create({
          data: { clientId: id, label: 'Principal', isPrimary: true, addressState, addressCity, addressNeighborhood, addressStreet, addressBuilding },
        })
      }
    }

    // El User vinculado (si existe) duplica name/phone/email para no tener
    // que hacer join en cada lectura — hallazgo de auditoría: sin este sync
    // quedaban desincronizados en cuanto se editaba solo uno de los dos.
    // Se usa `!== undefined` (no truthy) porque lastName puede llegar como
    // '' para un cliente empresa/gobierno sin apellido — un check truthy
    // descartaría ese '' silenciosamente y dejaría el User desincronizado.
    const linkedUser = await tx.user.findUnique({ where: { clientId: id }, select: { id: true } })
    const hasUserSyncableChange =
      clientFields.name !== undefined || clientFields.lastName !== undefined || clientFields.phone !== undefined || clientFields.email !== undefined
    if (linkedUser && hasUserSyncableChange) {
      await tx.user.update({
        where: { id: linkedUser.id },
        data: {
          ...(clientFields.name !== undefined && { name: clientFields.name }),
          ...(clientFields.lastName !== undefined && { lastName: clientFields.lastName }),
          ...(clientFields.phone !== undefined && { phone: clientFields.phone }),
          ...(clientFields.email !== undefined && { email: clientFields.email }),
        },
      })
    }
  })

  return await prisma.client.findUnique({ where: { id }, include: { addresses: true } })
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
    include: { addresses: true },
  })
}
