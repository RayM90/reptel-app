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

// Enviar un abono del anticipo (pago en partes — el cliente decide monto y cuántos)
router.post('/:id/advance-payment-installment', authenticate, authorize('CLIENT'), ordersController.submitAdvancePaymentInstallment)

// Aprobar o rechazar el presupuesto tras el diagnóstico del técnico
router.post('/:id/approve-budget', authenticate, authorize('CLIENT'), ordersController.approveBudget)
router.post('/:id/reject-budget', authenticate, authorize('CLIENT'), ordersController.rejectBudget)

// Confirmar o disputar un diagnóstico sin costo
router.post('/:id/confirm-zero-budget-diagnosis', authenticate, authorize('CLIENT'), ordersController.confirmZeroBudgetDiagnosis)
router.post('/:id/dispute-zero-budget-diagnosis', authenticate, authorize('CLIENT'), ordersController.disputeZeroBudgetDiagnosis)

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

// Confirmar o rechazar un abono específico del anticipo (pago en partes — ADMIN)
router.post('/advance-payment-installment/:submissionId/confirm', authenticate, authorize('ADMIN'), ordersController.confirmAdvancePaymentInstallment)

// Cliente envía los datos del pago final (saldo restante tras la reparación)
router.post('/:id/final-payment', authenticate, authorize('CLIENT'), ordersController.submitFinalPayment)

// ADMIN aprueba o rechaza el pago final (calcula comisión del técnico al aprobar)
router.post('/:id/confirm-final-payment', authenticate, authorize('ADMIN'), ordersController.confirmFinalPayment)

// ADMIN cierra una orden con presupuesto $0 (sin pago final que aprobar)
router.post('/:id/close-zero-budget', authenticate, authorize('ADMIN'), ordersController.closeZeroBudgetOrder)

export default router