import { Router } from 'express'
import * as productOrdersController from './product-orders.controller'
import { authenticate, authorize } from '../../middleware/auth.middleware'

const router = Router()

// ─── Rutas del cliente ─────────────────────────────────────────────
// Crear un nuevo pedido de tienda
router.post(
  '/',
  authenticate,
  authorize('CLIENT'),
  productOrdersController.createOrder
)

// Historial de pedidos del cliente autenticado
router.get(
  '/my-orders',
  authenticate,
  authorize('CLIENT'),
  productOrdersController.getMyOrders
)

// Detalle de un pedido específico del cliente autenticado
router.get(
  '/:id',
  authenticate,
  authorize('CLIENT'),
  productOrdersController.getOrderDetail
)

// Subir comprobante de pago
router.patch(
  '/:id/receipt',
  authenticate,
  authorize('CLIENT'),
  productOrdersController.uploadReceipt
)

// ─── Rutas del administrador ───────────────────────────────────────
// Confirmar o rechazar el pago de un pedido
router.patch(
  '/:id/confirm-payment',
  authenticate,
  authorize('ADMIN'),
  productOrdersController.confirmPayment
)

export default router