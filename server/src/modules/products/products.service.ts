import prisma from '../../lib/prisma';

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