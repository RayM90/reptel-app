import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth.middleware';
import {
  getProducts,
  getProductsByCategory,
  getAdminProducts,
  getProductByIdAdmin,
  createProductHandler,
  updateProductHandler,
} from './products.controller';

const router = Router();

router.get('/categories', getProductsByCategory);
router.get('/admin', authenticate, authorize('ADMIN'), getAdminProducts);
router.get('/', getProducts);
router.post('/', authenticate, authorize('ADMIN'), createProductHandler);
router.get('/:id', authenticate, authorize('ADMIN'), getProductByIdAdmin);
router.put('/:id', authenticate, authorize('ADMIN'), updateProductHandler);

export default router;
