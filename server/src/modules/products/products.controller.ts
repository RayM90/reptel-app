import { Request, Response } from 'express';
import { AuthRequest } from '../../middleware/auth.middleware';
import prisma from '../../lib/prisma';
import {
  getProductsWithCategories,
  getAllProducts,
  getAllProductsForAdmin,
  getProductById,
  createProduct,
  updateProduct,
  sellProduct,
  InsufficientStockError,
} from './products.service';

/**
 * GET /api/products
 * Retorna todos los productos activos con su categoría
 */
export const getProducts = async (req: Request, res: Response): Promise<void> => {
  try {
    const products = await getAllProducts();
    res.status(200).json({ success: true, data: products });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Error al obtener productos' });
  }
};


export const getProductsByCategory = async (req: Request, res: Response): Promise<void> => {
  try {
    const categories = await getProductsWithCategories();
    res.status(200).json({ success: true, data: categories });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Error al obtener categorías' });
  }
};

export const getAdminProducts = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const products = await getAllProductsForAdmin();
    res.status(200).json({ success: true, data: products });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Error al obtener el inventario' });
  }
};

export const getProductByIdAdmin = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id);
    const product = await getProductById(id);
    if (!product) {
      res.status(404).json({ success: false, message: 'Producto no encontrado' });
      return;
    }
    res.status(200).json({ success: true, data: product });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Error al obtener el producto' });
  }
};

export const createProductHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, description, price, stock, minStock, imageUrl, categoryId, requiresInstallation } = req.body

    if (!name || typeof name !== 'string') {
      res.status(400).json({ success: false, message: 'El nombre del producto es requerido' })
      return
    }
    if (price === undefined || price === null || Number(price) < 0) {
      res.status(400).json({ success: false, message: 'El precio debe ser un número mayor o igual a 0' })
      return
    }
    if (!categoryId || typeof categoryId !== 'string') {
      res.status(400).json({ success: false, message: 'La categoría es requerida' })
      return
    }
    if (stock !== undefined && Number(stock) < 0) {
      res.status(400).json({ success: false, message: 'El stock debe ser mayor o igual a 0' })
      return
    }
    if (minStock !== undefined && Number(minStock) < 0) {
      res.status(400).json({ success: false, message: 'El stock mínimo debe ser mayor o igual a 0' })
      return
    }

    const product = await createProduct({
      name,
      description,
      price: Number(price),
      stock: stock !== undefined ? Number(stock) : undefined,
      minStock: minStock !== undefined ? Number(minStock) : undefined,
      imageUrl,
      categoryId,
      requiresInstallation: Boolean(requiresInstallation),
    })
    res.status(201).json({ success: true, data: product })
  } catch (error: any) {
    if (error.code === 'P2003') {
      res.status(400).json({ success: false, message: 'Categoría inválida' })
      return
    }
    res.status(500).json({ success: false, message: error.message || 'Error al crear el producto' })
  }
}

/**
 * POST /api/products/:id/sell
 * Venta de mostrador (tienda física) — descuenta stock, sin monto ni método de pago.
 */
export const sellProductHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id);
    const quantity = Number(req.body.quantity);

    if (!Number.isInteger(quantity) || quantity <= 0) {
      res.status(400).json({ success: false, message: 'La cantidad debe ser un número entero mayor a 0' });
      return;
    }

    let userId: string | undefined;
    if (req.user?.email) {
      const dbUser = await prisma.user.findUnique({ where: { email: req.user.email }, select: { id: true } });
      userId = dbUser?.id;
    }

    const product = await sellProduct(id, quantity, userId);
    res.status(200).json({ success: true, data: product });
  } catch (error: any) {
    if (error instanceof InsufficientStockError) {
      res.status(400).json({ success: false, message: 'Stock insuficiente para esta venta' });
      return;
    }
    if (error.code === 'P2025') {
      res.status(404).json({ success: false, message: 'Producto no encontrado' });
      return;
    }
    res.status(500).json({ success: false, message: error.message || 'Error al procesar la venta' });
  }
};

export const updateProductHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id)
    const { name, description, price, stock, minStock, imageUrl, categoryId, requiresInstallation, isActive } = req.body

    if (price !== undefined && Number(price) < 0) {
      res.status(400).json({ success: false, message: 'El precio debe ser un número mayor o igual a 0' })
      return
    }
    if (stock !== undefined && Number(stock) < 0) {
      res.status(400).json({ success: false, message: 'El stock debe ser mayor o igual a 0' })
      return
    }
    if (minStock !== undefined && Number(minStock) < 0) {
      res.status(400).json({ success: false, message: 'El stock mínimo debe ser mayor o igual a 0' })
      return
    }

    const data: Record<string, unknown> = {}
    if (name !== undefined) data.name = name
    if (description !== undefined) data.description = description
    if (price !== undefined) data.price = Number(price)
    if (stock !== undefined) data.stock = Number(stock)
    if (minStock !== undefined) data.minStock = Number(minStock)
    if (imageUrl !== undefined) data.imageUrl = imageUrl
    if (categoryId !== undefined) data.categoryId = categoryId
    if (requiresInstallation !== undefined) data.requiresInstallation = Boolean(requiresInstallation)
    if (isActive !== undefined) data.isActive = Boolean(isActive)

    const product = await updateProduct(id, data)
    res.status(200).json({ success: true, data: product })
  } catch (error: any) {
    if (error.code === 'P2003') {
      res.status(400).json({ success: false, message: 'Categoría inválida' })
      return
    }
    if (error.code === 'P2025') {
      res.status(404).json({ success: false, message: 'Producto no encontrado' })
      return
    }
    res.status(500).json({ success: false, message: error.message || 'Error al actualizar el producto' })
  }
}