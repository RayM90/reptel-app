import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth.middleware';
import {
  getProducts,
  getProductsByCategory,
  getAdminProducts,
  getProductByIdAdmin,
  createProductHandler,
  updateProductHandler,
  sellProductHandler,
  getStoreSummaryTodayHandler,
  getInventoryMovementsHandler,
} from './products.controller';

const router = Router();

router.get('/categories', authenticate, authorize('ADMIN', 'TECHNICIAN', 'TECHNICIAN_DELIVERY'), getProductsByCategory);
router.get('/admin', authenticate, authorize('ADMIN'), getAdminProducts);
router.get('/summary/today', authenticate, authorize('ADMIN'), getStoreSummaryTodayHandler);
router.get('/movements', authenticate, authorize('ADMIN'), getInventoryMovementsHandler);
router.get('/', authenticate, authorize('ADMIN', 'TECHNICIAN', 'TECHNICIAN_DELIVERY'), getProducts);
router.post('/', authenticate, authorize('ADMIN'), createProductHandler);
router.post('/:id/sell', authenticate, authorize('ADMIN', 'TECHNICIAN'), sellProductHandler);
router.get('/:id', authenticate, authorize('ADMIN'), getProductByIdAdmin);
router.put('/:id', authenticate, authorize('ADMIN'), updateProductHandler);

export default router;
