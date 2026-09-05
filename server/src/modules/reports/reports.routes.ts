import { Router } from 'express'
import { authenticate, authorize } from '../../middleware/auth.middleware'
import * as reportsController from './reports.controller'

const router = Router()

router.get('/summary', authenticate, authorize('ADMIN'), reportsController.getSummary)

export default router
