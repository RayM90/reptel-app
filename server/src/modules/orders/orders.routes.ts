import { Router } from 'express'
import * as ordersController from './orders.controller'

const router = Router()

// Ruta pública — tracking por número de orden (sin autenticación)
router.get('/track/:orderNumber', ordersController.trackOrder)

// Obtener todas las órdenes
router.get('/', ordersController.getOrders)

// Obtener una orden por ID
router.get('/:id', ordersController.getOrder)

// Crear una nueva orden
router.post('/', ordersController.createOrder)

// Actualizar el estado de una orden
router.patch('/:id/status', ordersController.updateStatus)

// Actualizar presupuesto de una orden
router.patch('/:id/budget', ordersController.updateBudget)

export default router