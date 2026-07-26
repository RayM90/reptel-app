import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth.middleware';
import {
  getProducts,
  getProductsByCategory,
  getAdminProducts,
  getProductByIdAdmin,
} from './products.controller';

const router = Router();

router.get('/categories', getProductsByCategory);
router.get('/admin', authenticate, authorize('ADMIN'), getAdminProducts);
router.get('/', getProducts);
router.get('/:id', authenticate, authorize('ADMIN'), getProductByIdAdmin);

export default router;
