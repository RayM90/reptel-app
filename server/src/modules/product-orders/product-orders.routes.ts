import { Router } from 'express'
import * as productOrdersController from './product-orders.controller'
import { authenticate, authorize } from '../../middleware/auth.middleware'

const router = Router()

// ─── Rutas del cliente ─────────────────────────────────────────────
// Crear un nuevo pedido de tienda (flujo normal + Dirección A: instalación)
router.post(
  '/',
  authenticate,
  authorize('CLIENT'),
  productOrdersController.createOrder
)

// Crear pedido de repuesto vinculado a una orden de servicio técnico en curso (Dirección B)
// IMPORTANTE: debe ir ANTES de /:id para que Express no intente matchear
// "link-to-service" como si fuera un id de ProductOrder.
router.post(
  '/link-to-service',
  authenticate,
  authorize('CLIENT'),
  productOrdersController.createLinkedOrder
)

// Historial de pedidos del cliente autenticado
router.get(
  '/my-orders',
  authenticate,
  authorize('CLIENT'),
  productOrdersController.getMyOrders
)

// ─── Rutas del motorizado (DELIVERY) — deben ir ANTES de /:id ─────
// Entregas asignadas al motorizado autenticado (Fase 4 — panel del motorizado)
router.get(
  '/my-deliveries',
  authenticate,
  authorize('DELIVERY'),
  productOrdersController.getMyDeliveries
)

// Detalle de un pedido específico del cliente autenticado
router.get(
  '/:id',
  authenticate,
  authorize('CLIENT'),
  productOrdersController.getOrderDetail
)

// Subir un abono de pago (parcial o total)
router.patch(
  '/:id/receipt',
  authenticate,
  authorize('CLIENT'),
  productOrdersController.uploadReceipt
)

// ─── Rutas del administrador ───────────────────────────────────────
// Confirmar o rechazar un abono específico
// IMPORTANTE: usa submissionId (ID del abono), no el id del pedido.
router.patch(
  '/payment-submissions/:submissionId/confirm',
  authenticate,
  authorize('ADMIN'),
  productOrdersController.confirmPartialPayment
)

// Listar todos los pedidos de tienda (supervisión del ADMIN)
router.get(
  '/',
  authenticate,
  authorize('ADMIN'),
  productOrdersController.getAllOrders
)

// Motorizado marca el pedido como entregado

router.patch('/:id/deliver', authenticate, authorize('DELIVERY'), productOrdersController.markAsDelivered)

// Cliente confirma que recibió el pedido
router.patch(
  '/:id/confirm-received',
  authenticate,
  authorize('CLIENT'),
  productOrdersController.confirmReceived
)

export default router