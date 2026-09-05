import { Router } from 'express'
import { authenticate, authorize } from '../../middleware/auth.middleware'
import { getPaymentMethods, updatePaymentMethods } from './settings.controller'

const router = Router()

router.get('/payment-methods', getPaymentMethods)
router.patch('/payment-methods', authenticate, authorize('ADMIN'), updatePaymentMethods)

export default router
