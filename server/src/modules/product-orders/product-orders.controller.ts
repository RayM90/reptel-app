import { Response } from 'express'
import { AuthRequest } from '../../middleware/auth.middleware'
import * as productOrdersService from './product-orders.service'

// ─────────────────────────────────────────────
// CREAR PEDIDO DE TIENDA
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

    const { items, paymentMethod, address, notes } = req.body

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
    })

    res.status(201).json({ success: true, data: order })
  } catch (error) {
    console.error('ERROR CREAR PEDIDO DE TIENDA:', error)
    const message = error instanceof Error ? error.message : 'Error al crear el pedido'
    res.status(400).json({ success: false, message })
  }
}

// ─────────────────────────────────────────────
// SUBIR COMPROBANTE DE PAGO
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
    const { receiptUrl } = req.body

    if (!receiptUrl) {
      res.status(400).json({ success: false, message: 'receiptUrl es requerido' })
      return
    }

    const order = await productOrdersService.uploadReceipt(id, clientId, receiptUrl)
    res.json({ success: true, data: order })
  } catch (error) {
    console.error('ERROR SUBIR COMPROBANTE:', error)
    const message = error instanceof Error ? error.message : 'Error al subir el comprobante'
    res.status(400).json({ success: false, message })
  }
}

// ─────────────────────────────────────────────
// CONFIRMAR O RECHAZAR PAGO (solo ADMIN)
// ─────────────────────────────────────────────

export const confirmPayment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id)
    const { approved } = req.body

    if (approved === undefined) {
      res.status(400).json({ success: false, message: 'approved es requerido (true o false)' })
      return
    }

    const order = await productOrdersService.confirmPayment(id, Boolean(approved))
    res.json({ success: true, data: order })
  } catch (error) {
    console.error('ERROR CONFIRMAR PAGO:', error)
    const message = error instanceof Error ? error.message : 'Error al confirmar el pago'
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