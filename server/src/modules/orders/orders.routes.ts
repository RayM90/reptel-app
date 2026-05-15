import { Router } from 'express';
import {
  getOrders,
  getOrder,
  createOrder,
  updateStatus,
} from './orders.controller';
import { authenticate, authorize } from '../../middleware/auth.middleware';

const router = Router();

router.get('/', authenticate, authorize('ADMIN', 'MANAGER', 'TECHNICIAN'), getOrders);

router.get('/:id', authenticate, authorize('ADMIN', 'MANAGER', 'TECHNICIAN', 'SELLER', 'CLIENT'), getOrder);

router.post('/', authenticate, authorize('ADMIN', 'MANAGER', 'SELLER'), createOrder);

router.patch('/:id/status', authenticate, authorize('ADMIN', 'MANAGER', 'TECHNICIAN'), updateStatus);

export default router;