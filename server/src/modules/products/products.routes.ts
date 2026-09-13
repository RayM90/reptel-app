import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth.middleware';
import {
  getProducts,
  getProductsByCategory,
  getAdminProducts,
  getProductByIdAdmin,
  createProductHandler,
  updateProductHandler,
  getInventoryMovementsHandler,
  restockProductHandler,
  registerMermaHandler,
} from './products.controller';

const router = Router();

router.get('/categories', authenticate, authorize('ADMIN', 'TECHNICIAN', 'TECHNICIAN_DELIVERY'), getProductsByCategory);
router.get('/admin', authenticate, authorize('ADMIN'), getAdminProducts);
router.get('/movements', authenticate, authorize('ADMIN'), getInventoryMovementsHandler);
router.get('/', authenticate, authorize('ADMIN', 'TECHNICIAN', 'TECHNICIAN_DELIVERY'), getProducts);
router.post('/', authenticate, authorize('ADMIN'), createProductHandler);
router.get('/:id', authenticate, authorize('ADMIN'), getProductByIdAdmin);
router.put('/:id', authenticate, authorize('ADMIN'), updateProductHandler);
router.post('/:id/restock', authenticate, authorize('ADMIN'), restockProductHandler);
router.post('/:id/merma', authenticate, authorize('ADMIN', 'TECHNICIAN', 'TECHNICIAN_DELIVERY'), registerMermaHandler);

export default router;
