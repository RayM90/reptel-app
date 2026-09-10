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
 * Resumen de actividad de la tienda física para el Dashboard — ventas de
 * mostrador de hoy (conteo + monto aproximado, ya que la venta no guarda un
 * monto propio, se calcula con el precio actual del producto) y productos
 * que necesitan reposición (stock <= minStock).
 */
export const getStoreSummaryToday = async () => {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  const salesToday = await prisma.inventoryMovement.findMany({
    where: {
      type: 'OUT',
      reason: 'Venta mostrador',
      createdAt: { gte: startOfDay, lte: endOfDay },
    },
    include: { product: { select: { price: true } } },
  });

  const salesCount = salesToday.length;
  const salesTotal = salesToday.reduce(
    (sum, m) => sum + m.quantity * Number(m.product.price),
    0
  );

  // Prisma no soporta comparar dos columnas de la misma fila en el `where`
  // (stock <= minStock) — se filtra en memoria, la tabla de productos es chica.
  const activeProducts = await prisma.product.findMany({
    where: { isActive: true },
    select: { id: true, name: true, stock: true, minStock: true },
  });
  const lowStockProducts = activeProducts
    .filter((p) => p.stock <= p.minStock)
    .sort((a, b) => a.stock - b.stock);

  return { salesCount, salesTotal, lowStockProducts };
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

/**
 * Venta de mostrador (tienda física) — descuenta stock y registra el
 * movimiento. Sin monto ni método de pago: el costo se maneja fuera del
 * sistema (caja física), esto solo lleva el inventario al día.
 */
export const sellProduct = async (id: string, quantity: number, userId?: string) => {
  return prisma.$transaction(async (tx) => {
    const product = await tx.product.findUniqueOrThrow({ where: { id } });

    if (product.stock < quantity) {
      throw new InsufficientStockError();
    }

    const updated = await tx.product.update({
      where: { id },
      data: { stock: { decrement: quantity } },
    });

    await tx.inventoryMovement.create({
      data: {
        productId: id,
        type: 'OUT',
        quantity,
        reason: 'Venta mostrador',
        userId,
      },
    });

    return updated;
  });
};