import { Router } from 'express'
import * as ordersController from './orders.controller'
import { authenticate, authorize } from '../../middleware/auth.middleware'

const router = Router()

// ─── Rutas públicas (sin autenticación) ───────────────────────────
// Tracking por número de orden
router.get('/track/:orderNumber', ordersController.trackOrder)

// ─── Rutas del CLIENTE — deben ir ANTES de /:id ───────────────────
// Crear orden propia (self-service: crea device + order en transacción,
// ahora requiere advancePaymentMethod en el body)
router.post('/self-service', authenticate, authorize('CLIENT'), ordersController.createMyOrder)

// Historial de órdenes propias del cliente
router.get('/my-orders', authenticate, authorize('CLIENT'), ordersController.getMyTechOrders)

// Subir comprobante de pago anticipado (delivery + revisión)
router.post('/:id/advance-payment', authenticate, authorize('CLIENT'), ordersController.submitAdvancePayment)

// ─── Rutas estáticas (personal) — deben ir ANTES de /:id ──────────
// Órdenes del día (para pantalla cajera)
router.get('/today', authenticate, authorize('ADMIN', 'MANAGER', 'TECHNICIAN', 'SELLER'), ordersController.getTodayOrders)

// Técnicos disponibles (para asignación al crear orden)
router.get('/technicians', authenticate, authorize('ADMIN', 'MANAGER', 'TECHNICIAN', 'SELLER'), ordersController.getAvailableTechnicians)

// ─── Rutas con parámetros dinámicos (personal) ────────────────────
// Obtener todas las órdenes
router.get('/', authenticate, authorize('ADMIN', 'MANAGER', 'TECHNICIAN', 'SELLER'), ordersController.getOrders)

// Obtener una orden por ID
router.get('/:id', authenticate, authorize('ADMIN', 'MANAGER', 'TECHNICIAN', 'SELLER'), ordersController.getOrder)

// Crear una nueva orden (uso interno/admin — no cliente)
router.post('/', authenticate, authorize('ADMIN', 'MANAGER', 'SELLER'), ordersController.createOrder)

// Actualizar el estado de una orden
router.patch('/:id/status', authenticate, authorize('ADMIN', 'MANAGER', 'TECHNICIAN'), ordersController.updateStatus)

// Actualizar presupuesto de una orden
router.patch('/:id/budget', authenticate, authorize('ADMIN', 'MANAGER'), ordersController.updateBudget)

// TODO Fase 4: POST /:id/confirm-advance-payment (solo ADMIN)
// Cuando exista el panel admin-web, este endpoint marcará
// advancePaymentConfirmed = true y disparará la notificación al
// técnico-delivery asignado para que salga.

export default router