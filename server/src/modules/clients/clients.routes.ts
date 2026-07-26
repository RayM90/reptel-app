import { Router } from 'express'
import { authenticate, authorize } from '../../middleware/auth.middleware'
import * as clientsController from './clients.controller'

const router = Router()

// Buscar clientes por nombre, cédula o teléfono
router.get('/search', authenticate, authorize('ADMIN'), clientsController.searchClients)

// Obtener todos los clientes
router.get('/', authenticate, authorize('ADMIN'), clientsController.getClients)

// Obtener cliente por ID
router.get('/:id', authenticate, authorize('ADMIN'), clientsController.getClient)

// Obtener cliente por número de cédula
router.get('/idnumber/:idNumber', authenticate, authorize('ADMIN'), clientsController.getClientByIdNumber)

// Crear nuevo cliente
router.post('/', authenticate, authorize('ADMIN'), clientsController.createClient)

// Actualizar cliente
router.patch('/:id', authenticate, authorize('ADMIN'), clientsController.updateClient)

export default router