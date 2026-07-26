import { Request, Response } from 'express';
import { AuthRequest } from '../../middleware/auth.middleware';
import { getProductsWithCategories, getAllProducts, getAllProductsForAdmin, getProductById } from './products.service';

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