import prisma from '../../lib/prisma';

export class InsufficientStockError extends Error {
  constructor() {
    super('INSUFFICIENT_STOCK');
  }
}

// Deriva el destino de un movimiento de salida a partir del rol de quien lo genera.
// TECHNICIAN_DELIVERY (motorizado) sale a domicilio del cliente; TECHNICIAN (mostrador)
// trabaja en el taller/tienda; cualquier otro rol (ADMIN registrando una merma encontrada
// en el almacén, por ejemplo) cae en TIENDA como default seguro.
export const deriveDestination = (role: string): 'TIENDA' | 'DOMICILIO_CLIENTE' | 'TALLER' => {
  if (role === 'TECHNICIAN_DELIVERY') return 'DOMICILIO_CLIENTE';
  if (role === 'TECHNICIAN') return 'TALLER';
  return 'TIENDA';
};

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
  type?: string;
  supplierName?: string;
  destination?: string;
  technicianRole?: string;
  lossReason?: string;
}) => {
  return prisma.inventoryMovement.findMany({
    where: {
      ...(filters.productId ? { productId: filters.productId } : {}),
      ...(filters.channel ? { channel: filters.channel as any } : {}),
      ...(filters.type ? { type: filters.type as any } : {}),
      ...(filters.destination ? { destination: filters.destination as any } : {}),
      ...(filters.lossReason ? { lossReason: filters.lossReason as any } : {}),
      ...(filters.supplierName ? { supplierName: { contains: filters.supplierName } } : {}),
      ...(filters.technicianRole ? { user: { role: filters.technicianRole as any } } : {}),
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
      user: { select: { id: true, name: true, lastName: true, role: true } },
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

export const restockProduct = async (
  productId: string,
  quantity: number,
  actorEmail: string,
  supplierName?: string,
  reason?: string,
) => {
  const actor = await prisma.user.findUnique({ where: { email: actorEmail } });
  if (!actor) throw new Error('Usuario no encontrado');

  return prisma.$transaction(async (tx) => {
    const product = await tx.product.update({
      where: { id: productId },
      data: { stock: { increment: quantity } },
    });

    const movement = await tx.inventoryMovement.create({
      data: {
        productId,
        type: 'IN',
        channel: 'AJUSTE_MANUAL',
        quantity,
        reason: reason?.trim() || 'Reabastecimiento de stock',
        supplierName: supplierName?.trim() || null,
        userId: actor.id,
      },
    });

    return { product, movement };
  });
};

export const registerMerma = async (
  productId: string,
  quantity: number,
  actorEmail: string,
  lossReason: string,
  reason: string,
  destination?: string,
  orderId?: string,
) => {
  const actor = await prisma.user.findUnique({ where: { email: actorEmail } });
  if (!actor) throw new Error('Usuario no encontrado');

  return prisma.$transaction(async (tx) => {
    const product = await tx.product.findUniqueOrThrow({ where: { id: productId } });
    if (product.stock < quantity) {
      throw new InsufficientStockError();
    }

    const updated = await tx.product.update({
      where: { id: productId },
      data: { stock: { decrement: quantity } },
    });

    const movement = await tx.inventoryMovement.create({
      data: {
        productId,
        type: 'OUT',
        channel: 'MERMA',
        quantity,
        reason,
        lossReason: lossReason as any,
        destination: (destination as any) ?? deriveDestination(actor.role),
        userId: actor.id,
        orderId: orderId ?? null,
      },
    });

    return { product: updated, movement };
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
