import { Router } from 'express'
import * as ordersController from './orders.controller'
import { authenticate, authorize } from '../../middleware/auth.middleware'
import { trackOrderLimiter } from '../../middleware/rateLimit.middleware'

const router = Router()

// ─── Rutas públicas (sin autenticación) ───────────────────────────
// Tracking por número de orden
router.get('/track/:orderNumber', trackOrderLimiter, ordersController.trackOrder)

// ─── Rutas del CLIENTE — deben ir ANTES de /:id ───────────────────
// Crear orden propia (self-service: crea device + order en transacción,
// ahora requiere advancePaymentMethod en el body)
router.post('/self-service', authenticate, authorize('CLIENT'), ordersController.createMyOrder)

// Historial de órdenes propias del cliente
router.get('/my-orders', authenticate, authorize('CLIENT'), ordersController.getMyTechOrders)

// Subir comprobante de pago anticipado (delivery + revisión)
router.post('/:id/advance-payment', authenticate, authorize('CLIENT'), ordersController.submitAdvancePayment)

// ─── Rutas estáticas (personal) — deben ir ANTES de /:id ──────────
// Órdenes del día — ADMIN
router.get('/today', authenticate, authorize('ADMIN'), ordersController.getTodayOrders)

// Técnicos disponibles (para asignación al crear orden) — ADMIN
router.get('/technicians', authenticate, authorize('ADMIN'), ordersController.getAvailableTechnicians)

// Órdenes asignadas al técnico autenticado (Fase 4 — panel del técnico)
router.get('/technician/my-orders', authenticate, authorize('TECHNICIAN_DELIVERY'), ordersController.getMyTechnicianOrders)

// ─── Rutas con parámetros dinámicos (personal) ────────────────────
// Obtener todas las órdenes — ADMIN
router.get('/', authenticate, authorize('ADMIN'), ordersController.getOrders)

// Obtener una orden por ID — ADMIN
router.get('/:id', authenticate, authorize('ADMIN'), ordersController.getOrder)

// Crear una nueva orden (uso interno/admin — no cliente) — ADMIN
router.post('/', authenticate, authorize('ADMIN'), ordersController.createOrder)

// Actualizar el estado de una orden (incluye comentarios de progreso del técnico)
router.patch('/:id/status', authenticate, authorize('ADMIN', 'TECHNICIAN_DELIVERY'), ordersController.updateStatus)
// Actualizar presupuesto de una orden — ADMIN
router.patch('/:id/budget', authenticate, authorize('ADMIN'), ordersController.updateBudget)

router.patch('/:id/diagnosis', authenticate, authorize('TECHNICIAN_DELIVERY'), ordersController.submitDiagnosis)

// Confirmar o rechazar el pago anticipado (Fase 4 — ADMIN)
router.post('/:id/confirm-advance-payment', authenticate, authorize('ADMIN'), ordersController.confirmAdvancePayment)

// Cliente envía los datos del pago final (saldo restante tras la reparación)
router.post('/:id/final-payment', authenticate, authorize('CLIENT'), ordersController.submitFinalPayment)

// ADMIN aprueba o rechaza el pago final (calcula comisión del técnico al aprobar)
router.post('/:id/confirm-final-payment', authenticate, authorize('ADMIN'), ordersController.confirmFinalPayment)

export default router