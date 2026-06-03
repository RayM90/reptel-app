import { Router } from 'express'
import * as clientsController from './clients.controller'

const router = Router()

// Buscar clientes por nombre, cédula o teléfono
router.get('/search', clientsController.searchClients)

// Obtener todos los clientes
router.get('/', clientsController.getClients)

// Obtener cliente por ID
router.get('/:id', clientsController.getClient)

// Obtener cliente por número de cédula
router.get('/idnumber/:idNumber', clientsController.getClientByIdNumber)

// Crear nuevo cliente
router.post('/', clientsController.createClient)

// Actualizar cliente
router.patch('/:id', clientsController.updateClient)

export default router