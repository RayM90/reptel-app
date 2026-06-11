import prisma from '../../lib/prisma'

export const getAllServices = async () => {
  return prisma.serviceCatalog.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
  })
}

export const getServiceById = async (id: string) => {
  return prisma.serviceCatalog.findUnique({
    where: { id },
  })
}

export const updateService = async (
  id: string,
  data: {
    name?: string
    description?: string
    basePrice?: number
    isActive?: boolean
    estimatedMinutes?: number
  }
) => {
  return prisma.serviceCatalog.update({
    where: { id },
    data,
  })
}