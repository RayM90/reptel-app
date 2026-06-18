import { Request, Response } from 'express';
import { getProductsWithCategories, getAllProducts } from './products.service';

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