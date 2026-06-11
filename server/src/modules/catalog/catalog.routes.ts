import { Router } from 'express'
import { authenticate } from '../../middleware/auth.middleware'
import * as catalogController from './catalog.controller'

const router = Router()

router.get('/', authenticate, catalogController.getAll)
router.get('/:id', authenticate, catalogController.getOne)
router.put('/:id', authenticate, catalogController.update)

export default router