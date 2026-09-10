import prisma from '../../lib/prisma';

export class InsufficientStockError extends Error {
  constructor() {
    super('INSUFFICIENT_STOCK');
  }
}

/**
 * Obtiene todas las categorías con sus productos activos
 */
export const getProductsWithCategories = async () => {
  const categories = await prisma.productCategory.findMany({
    where: { isActive: true },
    include: {
      products: {
        where: { isActive: true },
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          description: true,
          price: true,
          stock: true,
          imageUrl: true,
        },
      },
    },
    orderBy: { name: 'asc' },
  });

  return categories;
};

/**
 * Obtiene todos los productos activos sin filtro de categoría
 */
export const getAllProducts = async () => {
  const products = await prisma.product.findMany({
    where: { isActive: true },
    include: {
      category: {
        select: { id: true, name: true },
      },
    },
    orderBy: { name: 'asc' },
  });

  return products;
};

/**
 * Historial de movimientos de inventario — hoy solo se escribe, nunca se lee
 * fuera de este reporte. Filtros opcionales por producto, canal y rango de fecha.
 */
export const getInventoryMovements = async (filters: {
  productId?: string;
  channel?: string;
  from?: Date;
  to?: Date;
}) => {
  return prisma.inventoryMovement.findMany({
    where: {
      ...(filters.productId ? { productId: filters.productId } : {}),
      ...(filters.channel ? { channel: filters.channel as any } : {}),
      ...(filters.from || filters.to
        ? {
            createdAt: {
              ...(filters.from ? { gte: filters.from } : {}),
              ...(filters.to ? { lte: filters.to } : {}),
            },
          }
        : {}),
    },
    include: {
      product: { select: { id: true, name: true } },
      user: { select: { id: true, name: true, lastName: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
};

export const getAllProductsForAdmin = async () => {
  return prisma.product.findMany({
    include: {
      category: { select: { id: true, name: true } },
    },
    orderBy: { name: 'asc' },
  });
};

export const getProductById = async (id: string) => {
  return prisma.product.findUnique({
    where: { id },
    include: {
      category: { select: { id: true, name: true } },
    },
  });
};

export const createProduct = async (data: {
  name: string;
  description?: string;
  price: number;
  stock?: number;
  minStock?: number;
  imageUrl?: string;
  categoryId: string;
  requiresInstallation?: boolean;
}) => {
  return prisma.$transaction(async (tx) => {
    const product = await tx.product.create({ data });

    if (product.stock > 0) {
      await tx.inventoryMovement.create({
        data: {
          productId: product.id,
          type: 'IN',
          quantity: product.stock,
          reason: 'Stock inicial al crear el producto',
        },
      });
    }

    return product;
  });
};

export const updateProduct = async (
  id: string,
  data: {
    name?: string;
    description?: string;
    price?: number;
    stock?: number;
    minStock?: number;
    imageUrl?: string;
    categoryId?: string;
    requiresInstallation?: boolean;
    isActive?: boolean;
  }
) => {
  return prisma.$transaction(async (tx) => {
    const before = await tx.product.findUniqueOrThrow({ where: { id } });
    const updated = await tx.product.update({ where: { id }, data });

    if (data.stock !== undefined && data.stock !== before.stock) {
      const diff = data.stock - before.stock;
      await tx.inventoryMovement.create({
        data: {
          productId: id,
          type: diff > 0 ? 'IN' : 'OUT',
          quantity: Math.abs(diff),
          reason: 'Ajuste manual de stock desde el panel de administración',
        },
      });
    }

    return updated;
  });
};
