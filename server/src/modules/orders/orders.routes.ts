import { Router } from 'express'
import * as ordersController from './orders.controller'
import * as receiptsController from '../receipts/receipts.controller'
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

// ─── Recepción — ADMIN o TECHNICIAN ───────────────
// Crea device + order en transacción, ya en RECEIVED (pago verificado en persona)
router.post('/counter', authenticate, authorize('ADMIN', 'TECHNICIAN'), ordersController.createCounterOrder)

// Enviar un abono del anticipo (pago en partes — el cliente decide monto y cuántos)
router.post('/:id/advance-payment-installment', authenticate, authorize('CLIENT'), ordersController.submitAdvancePaymentInstallment)

router.post('/:id/budget-payment-installment', authenticate, authorize('CLIENT'), ordersController.submitBudgetPaymentInstallmentHandler)

// Abono adicional en orden de recepción — lo reporta el staff, no el cliente
// (mismo endpoint de confirmación de arriba sirve para ambos casos)
router.post('/:id/counter-payment-installment', authenticate, authorize('ADMIN', 'TECHNICIAN'), ordersController.submitCounterAdvanceInstallmentHandler)

router.post('/:id/counter-budget-payment-installment', authenticate, authorize('ADMIN', 'TECHNICIAN'), ordersController.submitCounterBudgetInstallmentHandler)

// Rechazar el presupuesto tras el diagnóstico del técnico
router.post('/:id/reject-budget', authenticate, authorize('CLIENT'), ordersController.rejectBudget)

// Confirmar o disputar un diagnóstico sin costo
router.post('/:id/confirm-zero-budget-diagnosis', authenticate, authorize('CLIENT'), ordersController.confirmZeroBudgetDiagnosis)
router.post('/:id/dispute-zero-budget-diagnosis', authenticate, authorize('CLIENT'), ordersController.disputeZeroBudgetDiagnosis)

// Cliente confirma que recibió el equipo (solo órdenes a domicilio) —
// reemplaza el "Marcar como entregado" del admin para self-service+delivery
router.post('/:id/confirm-delivery', authenticate, authorize('CLIENT'), ordersController.confirmDeliveryByClient)

// ─── Rutas estáticas (personal) — deben ir ANTES de /:id ──────────
// Órdenes del día — ADMIN
router.get('/today', authenticate, authorize('ADMIN'), ordersController.getTodayOrders)

// Técnicos disponibles (para asignación al crear orden) — ADMIN
router.get('/technicians', authenticate, authorize('ADMIN'), ordersController.getAvailableTechnicians)

// Órdenes asignadas al técnico autenticado (Fase 4 — panel del técnico)
router.get('/technician/my-orders', authenticate, authorize('TECHNICIAN_DELIVERY', 'TECHNICIAN'), ordersController.getMyTechnicianOrders)

// ─── Rutas con parámetros dinámicos (personal) ────────────────────
// Obtener todas las órdenes — ADMIN
router.get('/', authenticate, authorize('ADMIN'), ordersController.getOrders)

// Obtener una orden por ID — ADMIN
router.get('/:id', authenticate, authorize('ADMIN'), ordersController.getOrder)

// Recibos PDF — el propio cliente dueño de la orden, o ADMIN/técnico
// (la validación fina de "es tu orden" vive dentro del controller)
router.get('/:id/receipt/intake', authenticate, receiptsController.downloadIntakeReceipt)
router.get('/:id/receipt/final', authenticate, receiptsController.downloadFinalReceipt)
router.get('/:id/receipt/payment', authenticate, receiptsController.downloadPaymentReceipt)
router.get('/:id/receipt/closure', authenticate, receiptsController.downloadClosureReceipt)
router.get('/:id/receipt/budget-advance', authenticate, receiptsController.downloadBudgetAdvanceReceipt)

// Crear una nueva orden (uso interno/admin — no cliente) — ADMIN
router.post('/', authenticate, authorize('ADMIN'), ordersController.createOrder)

// Actualizar el estado de una orden (incluye comentarios de progreso del técnico)
router.patch('/:id/status', authenticate, authorize('ADMIN', 'TECHNICIAN_DELIVERY', 'TECHNICIAN'), ordersController.updateStatus)
// Actualizar presupuesto de una orden — ADMIN
router.patch('/:id/budget', authenticate, authorize('ADMIN'), ordersController.updateBudget)

router.patch('/:id/diagnosis', authenticate, authorize('TECHNICIAN_DELIVERY', 'TECHNICIAN'), ordersController.submitDiagnosis)

// Ajuste imprevisto al presupuesto de una orden en reparación/lista/pagada (motivo obligatorio)
router.patch('/:id/budget-adjustment', authenticate, authorize('ADMIN', 'TECHNICIAN', 'TECHNICIAN_DELIVERY'), ordersController.addBudgetAdjustmentHandler)

// Técnico marca la reparación como terminada — salta a pagada si ya no queda saldo, o pasa a lista para entregar
router.post('/:id/finish-repair', authenticate, authorize('TECHNICIAN', 'TECHNICIAN_DELIVERY'), ordersController.finishRepairHandler)

// Confirmar o rechazar un abono específico del anticipo (pago en partes — ADMIN)
router.post('/advance-payment-installment/:submissionId/confirm', authenticate, authorize('ADMIN'), ordersController.confirmAdvancePaymentInstallment)

// Cliente envía los datos del pago final (saldo restante tras la reparación)
router.post('/:id/final-payment', authenticate, authorize('CLIENT'), ordersController.submitFinalPayment)

// Personal de mostrador registra el pago final cuando el cliente paga en persona
router.post('/:id/counter-final-payment', authenticate, authorize('ADMIN', 'TECHNICIAN'), ordersController.submitCounterFinalPaymentHandler)

// ADMIN aprueba o rechaza el pago final (calcula comisión del técnico al aprobar)
router.post('/:id/confirm-final-payment', authenticate, authorize('ADMIN'), ordersController.confirmFinalPayment)

// ADMIN cierra una orden con presupuesto $0 (sin pago final que aprobar)
router.post('/:id/close-zero-budget', authenticate, authorize('ADMIN'), ordersController.closeZeroBudgetOrder)
router.post('/:id/mark-delivered', authenticate, authorize('ADMIN'), ordersController.markDelivered)
router.post('/:id/mark-picked-up-unrepaired', authenticate, authorize('ADMIN'), ordersController.markPickedUpUnrepaired)

// Repuestos de inventario usados en la orden — solo el técnico asignado
// (la validación fina "es tu orden" vive dentro del service)
router.get('/:id/parts', authenticate, authorize('ADMIN', 'TECHNICIAN_DELIVERY', 'TECHNICIAN'), ordersController.getPartsUsedInOrderHandler)
router.post('/:id/parts', authenticate, authorize('TECHNICIAN_DELIVERY', 'TECHNICIAN'), ordersController.useProductInOrderHandler)
router.delete('/:id/parts/:movementId', authenticate, authorize('TECHNICIAN_DELIVERY', 'TECHNICIAN'), ordersController.revertProductUsageHandler)
router.post('/:id/parts/:movementId/report-loss', authenticate, authorize('TECHNICIAN_DELIVERY', 'TECHNICIAN'), ordersController.reportPartLossHandler)

export default router