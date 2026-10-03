import { Router } from 'express'
import { authenticate, authorize } from '../../middleware/auth.middleware'
import * as reportsController from './reports.controller'

const router = Router()

router.get('/audit', authenticate, authorize('ADMIN'), reportsController.getAudit)
router.get('/client-history/:idNumber', authenticate, authorize('ADMIN'), reportsController.getClientHistory)
router.get('/technicians', authenticate, authorize('ADMIN'), reportsController.getTechnicians)
router.get('/period', authenticate, authorize('ADMIN'), reportsController.getPeriod)
router.get('/parts', authenticate, authorize('ADMIN'), reportsController.getParts)
router.get('/parts/detail', authenticate, authorize('ADMIN'), reportsController.getPartsDetailHandler)
router.get('/pending', authenticate, authorize('ADMIN'), reportsController.getPending)

export default router
