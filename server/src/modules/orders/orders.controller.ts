import { Response } from 'express'
import { AuthRequest } from '../../middleware/auth.middleware'
import * as ordersService from './orders.service'
import { mapPaymentMethod } from '../product-orders/product-orders.service'
import { broadcastOrderUpdate } from '../../websocket'
import prisma from '../../lib/prisma'

export const getOrders = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orders = await ordersService.getAllOrders()
    res.json({ success: true, data: orders })
  } catch (error) {
    console.error('ERROR GET ORDERS:', error)
    res.status(500).json({ success: false, message: 'Error al obtener órdenes', error: String(error) })
  }
}

export const getOrder = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id)
    const order = await ordersService.getOrderById(id)
    if (!order) {
      res.status(404).json({ success: false, message: 'Orden no encontrada' })
      return
    }
    res.json({ success: true, data: order })
  } catch (error) {
    console.error('ERROR GET ORDER:', error)
    res.status(500).json({ success: false, message: 'Error al obtener la orden', error: String(error) })
  }
}

export const trackOrder = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orderNumber = String(req.params.orderNumber)
    const order = await ordersService.getOrderByNumber(orderNumber)
    if (!order) {
      res.status(404).json({ success: false, message: 'Orden no encontrada' })
      return
    }
    res.json({ success: true, data: order })
  } catch (error) {
    console.error('ERROR TRACK ORDER:', error)
    res.status(500).json({ success: false, message: 'Error al rastrear la orden', error: String(error) })
  }
}

export const createOrder = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { clientId, deviceId, problem, observations, technicianId } = req.body
    if (!clientId || !deviceId || !problem) {
      res.status(400).json({
        success: false,
        message: 'clientId, deviceId y problem son requeridos',
      })
      return
    }
    const order = await ordersService.createOrder({
      clientId,
      deviceId,
      problem,
      observations,
      technicianId,
    })

    broadcastOrderUpdate({
      type: 'ORDER_CREATED',
      data: order
    })

    res.status(201).json({ success: true, data: order })
  } catch (error) {
    console.error('ERROR CREAR ORDEN:', error)
    res.status(500).json({ success: false, message: 'Error al crear la orden', error: String(error) })
  }
}

// ─────────────────────────────────────────────
// CLIENTE — Crear orden propia (self-service)
// El clientId NUNCA se toma del body, siempre del token autenticado,
// para que un cliente no pueda crear órdenes a nombre de otro.
//
// PAGO ANTICIPADO: ahora requiere advancePaymentMethod en el body
// (mismos códigos que la tienda: PAGO_MOVIL, TRANSFERENCIA, BINANCE).
// La orden nace en PENDING_PAYMENT con los montos fijos de delivery
// y revisión ya asignados por el service.
// ─────────────────────────────────────────────

export const createMyOrder = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const email = req.user?.email
    if (!email) {
      res.status(401).json({ success: false, message: 'Usuario no autenticado' })
      return
    }

    const { device, problem, observations, advancePaymentMethod } = req.body

    if (!device || !device.type || !device.brand || !device.model || !device.color || !device.accessories) {
      res.status(400).json({
        success: false,
        message: 'Datos del equipo incompletos (type, brand, model, color y accessories son requeridos)',
      })
      return
    }

    if (!problem) {
      res.status(400).json({ success: false, message: 'La falla o servicio reportado es requerido' })
      return
    }

    if (!advancePaymentMethod) {
      res.status(400).json({
        success: false,
        message: 'El método de pago anticipado (delivery + revisión) es requerido',
      })
      return
    }

    const mappedMethod = mapPaymentMethod(advancePaymentMethod)
    if (!mappedMethod) {
      res.status(400).json({
        success: false,
        message: `Método de pago no soportado: ${advancePaymentMethod}`,
      })
      return
    }

    const order = await ordersService.createSelfServiceOrder({
      email,
      device,
      problem,
      observations,
      advancePaymentMethod: mappedMethod,
    })

    broadcastOrderUpdate({
      type: 'ORDER_CREATED',
      data: order,
    })

    res.status(201).json({ success: true, data: order })
  } catch (error: any) {
    console.error('ERROR CREAR ORDEN (CLIENTE):', error)
    res.status(400).json({ success: false, message: error.message || 'Error al crear la orden' })
  }
}

// ─────────────────────────────────────────────
// CLIENTE — Subir comprobante de pago anticipado
// Mismo patrón que product-orders: recibe receiptUrl ya resuelto
// (simulado, sin S3 real por ahora) y lo guarda en la orden.
// ─────────────────────────────────────────────

export const submitAdvancePayment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const email = req.user?.email
    if (!email) {
      res.status(401).json({ success: false, message: 'Usuario no autenticado' })
      return
    }

    const id = String(req.params.id)
    const { paymentDetails } = req.body

    if (!paymentDetails || typeof paymentDetails !== 'object') {
      res.status(400).json({ success: false, message: 'paymentDetails es requerido' })
      return
    }

    const order = await ordersService.submitAdvancePayment(id, email, paymentDetails)
    res.json({ success: true, data: order })
  } catch (error: any) {
    console.error('ERROR REGISTRAR DATOS DE PAGO ANTICIPADO:', error)
    res.status(400).json({ success: false, message: error.message || 'Error al registrar los datos de pago' })
  }
}

// ─────────────────────────────────────────────
// CLIENTE — Historial de órdenes de servicio técnico propias
// ─────────────────────────────────────────────

export const getMyTechOrders = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const email = req.user?.email
    if (!email) {
      res.status(401).json({ success: false, message: 'Usuario no autenticado' })
      return
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: { clientId: true },
    })

    if (!user || !user.clientId) {
      res.status(404).json({ success: false, message: 'Cliente no encontrado para este usuario' })
      return
    }

    const orders = await ordersService.getOrdersByClient(user.clientId)
    res.json({ success: true, data: orders })
  } catch (error) {
    console.error('ERROR GET MY TECH ORDERS:', error)
    res.status(500).json({ success: false, message: 'Error al obtener tus órdenes', error: String(error) })
  }
}

export const updateStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id)
    const { status, comment, technicianId } = req.body
    if (!status) {
      res.status(400).json({ success: false, message: 'El status es requerido' })
      return
    }
    const order = await ordersService.updateOrderStatus(id, status, comment, technicianId)

    broadcastOrderUpdate({
      type: 'ORDER_STATUS_UPDATED',
      data: order
    })

    res.json({ success: true, data: order })
  } catch (error) {
    console.error('ERROR UPDATE STATUS:', error)
    res.status(500).json({ success: false, message: 'Error al actualizar el estado', error: String(error) })
  }
}

export const updateBudget = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id)
    const { budget, approved } = req.body
    if (budget === undefined || approved === undefined) {
      res.status(400).json({
        success: false,
        message: 'budget y approved son requeridos',
      })
      return
    }
    const order = await ordersService.updateOrderBudget(id, budget, approved)

    broadcastOrderUpdate({
      type: 'ORDER_BUDGET_UPDATED',
      data: order
    })

    res.json({ success: true, data: order })
  } catch (error) {
    console.error('ERROR UPDATE BUDGET:', error)
    res.status(500).json({ success: false, message: 'Error al actualizar el presupuesto', error: String(error) })
  }
}


export const getTodayOrders = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orders = await ordersService.getTodayOrders()
    res.json({ success: true, data: orders })
  } catch (error) {
    console.error('ERROR GET TODAY ORDERS:', error)
    res.status(500).json({
      success: false,
      message: 'Error al obtener órdenes del día',
      error: String(error),
    })
  }
}

export const getAvailableTechnicians = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const technicians = await ordersService.getAvailableTechnicians()
    res.json({ success: true, data: technicians })
  } catch (error) {
    console.error('ERROR GET TECHNICIANS:', error)
    res.status(500).json({
      success: false,
      message: 'Error al obtener técnicos',
      error: String(error),
    })
  }
}

// ─────────────────────────────────────────────
// TÉCNICO — Confirmar o corregir diagnóstico + presupuesto (Fase 4)
// ─────────────────────────────────────────────

export const submitDiagnosis = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id)
    const { diagnosis, serviceCatalogId, budget } = req.body

    if (!diagnosis) {
      res.status(400).json({ success: false, message: 'El diagnóstico es requerido' })
      return
    }

    if (budget === undefined) {
      res.status(400).json({ success: false, message: 'El presupuesto (budget) es requerido' })
      return
    }

    const order = await ordersService.submitDiagnosis(id, diagnosis, budget, serviceCatalogId)

    broadcastOrderUpdate({
      type: 'ORDER_BUDGET_UPDATED',
      data: order,
    })

    res.json({ success: true, data: order })
  } catch (error: any) {
    console.error('ERROR SUBMIT DIAGNOSIS:', error)
    res.status(400).json({ success: false, message: error.message || 'Error al registrar el diagnóstico' })
  }
}

// ─────────────────────────────────────────────
// ADMIN — Confirmar o rechazar el pago anticipado (Fase 4)
// ─────────────────────────────────────────────

export const confirmAdvancePayment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id)
    const { approved, rejectionReason } = req.body

    if (approved === undefined) {
      res.status(400).json({ success: false, message: 'approved es requerido (true o false)' })
      return
    }

    if (approved === false && !rejectionReason) {
      res.status(400).json({
        success: false,
        message: 'rejectionReason es requerido cuando se rechaza el pago',
      })
      return
    }

    const order = await ordersService.confirmAdvancePayment(id, Boolean(approved), rejectionReason)

    broadcastOrderUpdate({
      type: 'ORDER_STATUS_UPDATED',
      data: order,
    })

    res.json({ success: true, data: order })
  } catch (error: any) {
    console.error('ERROR CONFIRM ADVANCE PAYMENT:', error)
    res.status(400).json({ success: false, message: error.message || 'Error al confirmar el pago anticipado' })
  }
}

// ─────────────────────────────────────────────
// CLIENTE — Enviar datos del pago final (saldo restante)
// ─────────────────────────────────────────────

export const submitFinalPayment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const email = req.user?.email
    if (!email) {
      res.status(401).json({ success: false, message: 'Usuario no autenticado' })
      return
    }

    const id = String(req.params.id)
    const { paymentDetails } = req.body

    if (!paymentDetails || typeof paymentDetails !== 'object') {
      res.status(400).json({ success: false, message: 'paymentDetails es requerido' })
      return
    }

    const order = await ordersService.submitFinalPayment(id, email, paymentDetails)
    res.json({ success: true, data: order })
  } catch (error: any) {
    console.error('ERROR ENVIAR PAGO FINAL:', error)
    res.status(400).json({ success: false, message: error.message || 'Error al registrar el pago final' })
  }
}

// ─────────────────────────────────────────────
// ADMIN — Confirmar o rechazar el pago final (calcula comisión al aprobar)
// ─────────────────────────────────────────────

export const confirmFinalPayment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id)
    const { approved, rejectionReason } = req.body

    if (approved === undefined) {
      res.status(400).json({ success: false, message: 'approved es requerido (true o false)' })
      return
    }

    if (approved === false && !rejectionReason) {
      res.status(400).json({
        success: false,
        message: 'rejectionReason es requerido cuando se rechaza el pago',
      })
      return
    }

    const order = await ordersService.confirmFinalPayment(id, Boolean(approved), rejectionReason)

    broadcastOrderUpdate({
      type: 'ORDER_STATUS_UPDATED',
      data: order,
    })

    res.json({ success: true, data: order })
  } catch (error: any) {
    console.error('ERROR CONFIRMAR PAGO FINAL:', error)
    res.status(400).json({ success: false, message: error.message || 'Error al confirmar el pago final' })
  }
}

// ─────────────────────────────────────────────
// TÉCNICO — Historial de sus órdenes asignadas (Fase 4)
// ─────────────────────────────────────────────

export const getMyTechnicianOrders = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const email = req.user?.email
    if (!email) {
      res.status(401).json({ success: false, message: 'Usuario no autenticado' })
      return
    }

    const technician = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    })

    if (!technician) {
      res.status(404).json({ success: false, message: 'Técnico no encontrado' })
      return
    }

    const orders = await ordersService.getOrdersByTechnician(technician.id)
    res.json({ success: true, data: orders })
  } catch (error) {
    console.error('ERROR GET MY TECHNICIAN ORDERS:', error)
    res.status(500).json({ success: false, message: 'Error al obtener tus órdenes', error: String(error) })
  }
}