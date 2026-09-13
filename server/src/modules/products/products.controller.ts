import { Request, Response } from 'express';
import { AuthRequest } from '../../middleware/auth.middleware';
import {
  getProductsWithCategories,
  getAllProducts,
  getAllProductsForAdmin,
  getProductById,
  createProduct,
  updateProduct,
  getInventoryMovements,
  restockProduct,
  registerMerma,
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

/**
 * GET /api/products/movements
 * Historial de movimientos de inventario (fecha, producto, tipo, cantidad,
 * motivo, canal, quién) con filtros opcionales por producto/canal/fecha.
 */
export const getInventoryMovementsHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { productId, channel, from, to, type, supplierName, destination, technicianRole, lossReason } = req.query;
    const movements = await getInventoryMovements({
      productId: productId ? String(productId) : undefined,
      channel: channel ? String(channel) : undefined,
      from: from ? new Date(String(from)) : undefined,
      to: to ? new Date(String(to)) : undefined,
      type: type ? String(type) : undefined,
      supplierName: supplierName ? String(supplierName) : undefined,
      destination: destination ? String(destination) : undefined,
      technicianRole: technicianRole ? String(technicianRole) : undefined,
      lossReason: lossReason ? String(lossReason) : undefined,
    });
    res.status(200).json({ success: true, data: movements });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Error al obtener el historial de inventario' });
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

export const restockProductHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id)
    const { quantity, supplierName, reason } = req.body

    if (quantity === undefined || Number(quantity) <= 0) {
      res.status(400).json({ success: false, message: 'La cantidad a reabastecer debe ser mayor a 0' })
      return
    }

    const { product, movement } = await restockProduct(
      id,
      Number(quantity),
      req.user!.email,
      supplierName ? String(supplierName) : undefined,
      reason ? String(reason) : undefined,
    )
    res.status(200).json({ success: true, data: { product, movement } })
  } catch (error: any) {
    if (error.code === 'P2025') {
      res.status(404).json({ success: false, message: 'Producto no encontrado' })
      return
    }
    res.status(500).json({ success: false, message: error.message || 'Error al reabastecer el producto' })
  }
}

const VALID_LOSS_REASONS = ['DEFECTUOSO', 'DANIO_INSTALACION', 'PERDIDA', 'GARANTIA', 'OTRO']
const VALID_DESTINATIONS = ['TIENDA', 'DOMICILIO_CLIENTE', 'TALLER', 'OTRO']

export const registerMermaHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id)
    const { quantity, lossReason, reason, destination, orderId } = req.body

    if (quantity === undefined || Number(quantity) <= 0) {
      res.status(400).json({ success: false, message: 'La cantidad debe ser mayor a 0' })
      return
    }
    if (!lossReason || !VALID_LOSS_REASONS.includes(String(lossReason))) {
      res.status(400).json({ success: false, message: 'El motivo de la merma no es válido' })
      return
    }
    if (!reason || typeof reason !== 'string' || !reason.trim()) {
      res.status(400).json({ success: false, message: 'Debes detallar qué pasó con el producto' })
      return
    }
    if (destination !== undefined && !VALID_DESTINATIONS.includes(String(destination))) {
      res.status(400).json({ success: false, message: 'El destino no es válido' })
      return
    }

    const { product, movement } = await registerMerma(
      id,
      Number(quantity),
      req.user!.email,
      String(lossReason),
      reason.trim(),
      destination ? String(destination) : undefined,
      orderId ? String(orderId) : undefined,
    )
    res.status(200).json({ success: true, data: { product, movement } })
  } catch (error: any) {
    if (error.constructor?.name === 'InsufficientStockError') {
      res.status(400).json({ success: false, message: 'No hay suficiente stock disponible para registrar esta merma' })
      return
    }
    if (error.code === 'P2025') {
      res.status(404).json({ success: false, message: 'Producto no encontrado' })
      return
    }
    res.status(500).json({ success: false, message: error.message || 'Error al registrar la merma' })
  }
}