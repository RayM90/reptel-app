import { Router } from 'express'
import { authenticate, authorize } from '../../middleware/auth.middleware'
import * as reportsController from './reports.controller'

const router = Router()

router.get('/summary', authenticate, authorize('ADMIN'), reportsController.getSummary)
router.get('/audit', authenticate, authorize('ADMIN'), reportsController.getAudit)
router.get('/client-history/:idNumber', authenticate, authorize('ADMIN'), reportsController.getClientHistory)
router.get('/technicians', authenticate, authorize('ADMIN'), reportsController.getTechnicians)

export default router
