import { Response } from 'express'
import { AuthRequest } from '../../middleware/auth.middleware'
import * as productOrdersService from './product-orders.service'

// ─────────────────────────────────────────────
// CREAR PEDIDO DE TIENDA (flujo normal + Dirección A)
// ─────────────────────────────────────────────

export const createOrder = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const email = req.user?.email
    if (!email) {
      res.status(401).json({ success: false, message: 'Usuario no autenticado' })
      return
    }

    const clientId = await productOrdersService.resolveClientIdFromEmail(email)
    if (!clientId) {
      res.status(404).json({
        success: false,
        message: 'No se encontró un cliente vinculado a este usuario',
      })
      return
    }

    const { items, paymentMethod, address, notes, requiresInstallation } = req.body

    if (!items || !Array.isArray(items) || items.length === 0) {
      res.status(400).json({ success: false, message: 'El pedido debe contener al menos un producto' })
      return
    }

    if (!paymentMethod) {
      res.status(400).json({ success: false, message: 'El método de pago es requerido' })
      return
    }

    if (!address) {
      res.status(400).json({ success: false, message: 'La dirección de entrega es requerida' })
      return
    }

    const mappedMethod = productOrdersService.mapPaymentMethod(paymentMethod)
    if (!mappedMethod) {
      res.status(400).json({
        success: false,
        message: `Método de pago no soportado: ${paymentMethod}`,
      })
      return
    }

    const order = await productOrdersService.createProductOrder({
      clientId,
      items,
      paymentMethod: mappedMethod,
      address,
      notes,
      requiresInstallation: Boolean(requiresInstallation),
    })

    res.status(201).json({ success: true, data: order })
  } catch (error) {
    console.error('ERROR CREAR PEDIDO DE TIENDA:', error)
    const message = error instanceof Error ? error.message : 'Error al crear el pedido'
    res.status(400).json({ success: false, message })
  }
}

// ─────────────────────────────────────────────
// CREAR PEDIDO VINCULADO A ORDEN DE SERVICIO TÉCNICO (Dirección B)
// ─────────────────────────────────────────────

export const createLinkedOrder = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const email = req.user?.email
    if (!email) {
      res.status(401).json({ success: false, message: 'Usuario no autenticado' })
      return
    }

    const clientId = await productOrdersService.resolveClientIdFromEmail(email)
    if (!clientId) {
      res.status(404).json({
        success: false,
        message: 'No se encontró un cliente vinculado a este usuario',
      })
      return
    }

    const { items, paymentMethod, linkedOrderId, address, notes } = req.body

    if (!items || !Array.isArray(items) || items.length === 0) {
      res.status(400).json({ success: false, message: 'El pedido debe contener al menos un producto' })
      return
    }

    if (!paymentMethod) {
      res.status(400).json({ success: false, message: 'El método de pago es requerido' })
      return
    }

    if (!linkedOrderId) {
      res.status(400).json({ success: false, message: 'linkedOrderId es requerido' })
      return
    }

    if (!address) {
      res.status(400).json({ success: false, message: 'La dirección de entrega es requerida' })
      return
    }

    const mappedMethod = productOrdersService.mapPaymentMethod(paymentMethod)
    if (!mappedMethod) {
      res.status(400).json({
        success: false,
        message: `Método de pago no soportado: ${paymentMethod}`,
      })
      return
    }

    const order = await productOrdersService.createLinkedProductOrder({
      clientId,
      items,
      paymentMethod: mappedMethod,
      linkedOrderId,
      address,
      notes,
    })

    res.status(201).json({ success: true, data: order })
  } catch (error) {
    console.error('ERROR CREAR PEDIDO VINCULADO:', error)
    const message = error instanceof Error ? error.message : 'Error al crear el pedido vinculado'
    res.status(400).json({ success: false, message })
  }
}

// ─────────────────────────────────────────────
// SUBIR DATOS DE PAGO (abono parcial o total)
// ─────────────────────────────────────────────

export const uploadReceipt = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const email = req.user?.email
    if (!email) {
      res.status(401).json({ success: false, message: 'Usuario no autenticado' })
      return
    }

    const clientId = await productOrdersService.resolveClientIdFromEmail(email)
    if (!clientId) {
      res.status(404).json({
        success: false,
        message: 'No se encontró un cliente vinculado a este usuario',
      })
      return
    }

    const id = String(req.params.id)
    const { paymentDetails, amount } = req.body

    if (!paymentDetails || typeof paymentDetails !== 'object') {
      res.status(400).json({ success: false, message: 'paymentDetails es requerido' })
      return
    }

    if (amount === undefined || amount === null || Number.isNaN(Number(amount))) {
      res.status(400).json({ success: false, message: 'amount es requerido y debe ser numérico' })
      return
    }

    const submission = await productOrdersService.uploadReceipt(id, clientId, paymentDetails, Number(amount))
    res.status(201).json({ success: true, data: submission })
  } catch (error) {
    console.error('ERROR SUBIR DATOS DE PAGO:', error)
    const message = error instanceof Error ? error.message : 'Error al registrar los datos de pago'
    res.status(400).json({ success: false, message })
  }
}

// ─────────────────────────────────────────────
// CONFIRMAR O RECHAZAR UN ABONO ESPECÍFICO (solo ADMIN)
// ─────────────────────────────────────────────

export const confirmPartialPayment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const submissionId = String(req.params.submissionId)
    const { approved, rejectionReason } = req.body

    if (approved === undefined) {
      res.status(400).json({ success: false, message: 'approved es requerido (true o false)' })
      return
    }

    if (approved === false && !rejectionReason) {
      res.status(400).json({
        success: false,
        message: 'rejectionReason es requerido cuando se rechaza el abono',
      })
      return
    }

    const order = await productOrdersService.confirmPartialPayment(submissionId, Boolean(approved), rejectionReason)
    res.json({ success: true, data: order })
  } catch (error) {
    console.error('ERROR CONFIRMAR ABONO:', error)
    const message = error instanceof Error ? error.message : 'Error al confirmar el abono'
    res.status(400).json({ success: false, message })
  }
}

// ─────────────────────────────────────────────
// HISTORIAL DE PEDIDOS DEL CLIENTE AUTENTICADO
// ─────────────────────────────────────────────

export const getMyOrders = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const email = req.user?.email
    if (!email) {
      res.status(401).json({ success: false, message: 'Usuario no autenticado' })
      return
    }

    const clientId = await productOrdersService.resolveClientIdFromEmail(email)
    if (!clientId) {
      res.status(404).json({
        success: false,
        message: 'No se encontró un cliente vinculado a este usuario',
      })
      return
    }

    const orders = await productOrdersService.getOrdersByClient(clientId)
    res.json({ success: true, data: orders })
  } catch (error) {
    console.error('ERROR OBTENER PEDIDOS:', error)
    res.status(500).json({ success: false, message: 'Error al obtener los pedidos' })
  }
}

// ─────────────────────────────────────────────
// DETALLE DE UN PEDIDO ESPECÍFICO DEL CLIENTE
// ─────────────────────────────────────────────

export const getOrderDetail = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const email = req.user?.email
    if (!email) {
      res.status(401).json({ success: false, message: 'Usuario no autenticado' })
      return
    }

    const clientId = await productOrdersService.resolveClientIdFromEmail(email)
    if (!clientId) {
      res.status(404).json({
        success: false,
        message: 'No se encontró un cliente vinculado a este usuario',
      })
      return
    }

    const id = String(req.params.id)
    const order = await productOrdersService.getProductOrderById(id, clientId)

    if (!order) {
      res.status(404).json({ success: false, message: 'Pedido no encontrado' })
      return
    }

    res.json({ success: true, data: order })
  } catch (error) {
    console.error('ERROR OBTENER DETALLE DE PEDIDO:', error)
    res.status(500).json({ success: false, message: 'Error al obtener el pedido' })
  }
}

// ─────────────────────────────────────────────
// MOTORIZADO — Marcar pedido como entregado (Fase 4)
// ─────────────────────────────────────────────

export const markAsDelivered = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const email = req.user?.email
    if (!email) {
      res.status(401).json({ success: false, message: 'Usuario no autenticado' })
      return
    }

    const id = String(req.params.id)
    const order = await productOrdersService.markAsDelivered(id, email)
    res.json({ success: true, data: order })
  } catch (error) {
    console.error('ERROR MARCAR ENTREGADO:', error)
    const message = error instanceof Error ? error.message : 'Error al marcar como entregado'
    res.status(400).json({ success: false, message })
  }
}

// ─────────────────────────────────────────────
// CLIENTE — Confirmar recepción del pedido (Fase 4)
// ─────────────────────────────────────────────

export const confirmReceived = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const email = req.user?.email
    if (!email) {
      res.status(401).json({ success: false, message: 'Usuario no autenticado' })
      return
    }

    const clientId = await productOrdersService.resolveClientIdFromEmail(email)
    if (!clientId) {
      res.status(404).json({
        success: false,
        message: 'No se encontró un cliente vinculado a este usuario',
      })
      return
    }

    const id = String(req.params.id)
    const order = await productOrdersService.confirmReceived(id, clientId)
    res.json({ success: true, data: order })
  } catch (error) {
    console.error('ERROR CONFIRMAR RECEPCIÓN:', error)
    const message = error instanceof Error ? error.message : 'Error al confirmar la recepción'
    res.status(400).json({ success: false, message })
  }
}

// ─────────────────────────────────────────────
// ADMIN — Cancelar un pedido y devolver el stock reservado
// ─────────────────────────────────────────────

export const cancelOrder = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id)
    const order = await productOrdersService.cancelProductOrder(id)
    res.json({ success: true, data: order })
  } catch (error) {
    console.error('ERROR CANCELAR PEDIDO:', error)
    const message = error instanceof Error ? error.message : 'Error al cancelar el pedido'
    res.status(400).json({ success: false, message })
  }
}

// ─────────────────────────────────────────────
// ADMIN — Listar todos los pedidos de tienda (Fase 4)
// ─────────────────────────────────────────────

export const getAllOrders = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orders = await productOrdersService.getAllOrders()
    res.json({ success: true, data: orders })
  } catch (error) {
    console.error('ERROR OBTENER TODOS LOS PEDIDOS:', error)
    res.status(500).json({ success: false, message: 'Error al obtener los pedidos' })
  }
}

// ─────────────────────────────────────────────
// MOTORIZADO — Listar mis entregas asignadas (Fase 4)
// ─────────────────────────────────────────────

export const getMyDeliveries = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const email = req.user?.email
    if (!email) {
      res.status(401).json({ success: false, message: 'Usuario no autenticado' })
      return
    }

    const agentId = await productOrdersService.resolveAgentIdFromEmail(email)
    if (!agentId) {
      res.status(404).json({
        success: false,
        message: 'No se encontró un motorizado vinculado a este usuario',
      })
      return
    }

    const deliveries = await productOrdersService.getDeliveriesByAgent(agentId)
    res.json({ success: true, data: deliveries })
  } catch (error) {
    console.error('ERROR OBTENER MIS ENTREGAS:', error)
    res.status(500).json({ success: false, message: 'Error al obtener las entregas' })
  }
}