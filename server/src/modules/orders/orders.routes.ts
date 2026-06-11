import { Router } from 'express'
import * as ordersController from './orders.controller'

const router = Router()

// ─── Rutas públicas (sin autenticación) ───────────────────────────
// Tracking por número de orden
router.get('/track/:orderNumber', ordersController.trackOrder)

// ─── Rutas estáticas — deben ir ANTES de /:id ─────────────────────
// Órdenes del día (para pantalla cajera)
router.get('/today', ordersController.getTodayOrders)

// Técnicos disponibles (para asignación al crear orden)
router.get('/technicians', ordersController.getAvailableTechnicians)

// ─── Rutas con parámetros dinámicos ───────────────────────────────
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