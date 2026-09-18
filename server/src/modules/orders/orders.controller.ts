import { Response } from 'express'
import { AuthRequest } from '../../middleware/auth.middleware'
import * as ordersService from './orders.service'
import { mapPaymentMethod } from '../../lib/paymentMethod'
import { broadcastOrderUpdate } from '../../websocket'
import prisma from '../../lib/prisma'

// Traduce el error crudo de Prisma (unique constraint) a un mensaje que el
// cliente pueda entender, en vez de filtrar el stack trace de la query SQL.
const translateOrderCreationError = (error: any): string | null => {
  if (error?.code === 'P2002' && String(error?.meta?.target ?? '').includes('serialNumber')) {
    return 'Ya existe un equipo registrado con ese número de serie. Verifica el número o deja el campo vacío si no lo tienes a mano.'
  }
  return null
}

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
// (mismos códigos que en recepción: PAGO_MOVIL, TRANSFERENCIA, BINANCE).
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
    res.status(400).json({ success: false, message: translateOrderCreationError(error) || error.message || 'Error al crear la orden' })
  }
}

// ─────────────────────────────────────────────
// CREAR ORDEN EN RECEPCIÓN (personal TECHNICIAN/ADMIN)
// El pago de la revisión ($15) ya fue verificado en persona por quien
// registra, por eso no requiere advancePaymentMethod pendiente de
// confirmación — la orden nace directo en RECEIVED.
// ─────────────────────────────────────────────

export const createCounterOrder = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const actorEmail = req.user?.email
    if (!actorEmail) {
      res.status(401).json({ success: false, message: 'Usuario no autenticado' })
      return
    }

    const { clientId, device, problem, observations, advancePaymentMethod, paymentDetails, amount, serviceCatalogId } = req.body

    if (!clientId) {
      res.status(400).json({ success: false, message: 'El cliente es requerido' })
      return
    }

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
      res.status(400).json({ success: false, message: 'El método de pago de la revisión es requerido' })
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

    if (!paymentDetails || typeof paymentDetails !== 'object') {
      res.status(400).json({ success: false, message: 'Los datos del pago (paymentDetails) son requeridos' })
      return
    }

    if (amount !== undefined && (Number.isNaN(Number(amount)) || Number(amount) <= 0 || Number(amount) > 15)) {
      res.status(400).json({ success: false, message: 'El monto abonado debe ser mayor a 0 y no exceder $15' })
      return
    }

    const order = await ordersService.createCounterOrder({
      actorEmail,
      clientId,
      device,
      problem,
      observations,
      advancePaymentMethod: mappedMethod,
      paymentDetails,
      amount: amount !== undefined ? Number(amount) : undefined,
      serviceCatalogId,
    })

    broadcastOrderUpdate({
      type: 'ORDER_CREATED',
      data: order,
    })

    res.status(201).json({ success: true, data: order })
  } catch (error: any) {
    console.error('ERROR CREAR ORDEN (RECEPCIÓN):', error)
    res.status(400).json({ success: false, message: translateOrderCreationError(error) || error.message || 'Error al crear la orden' })
  }
}

// ─────────────────────────────────────────────
// CLIENTE — Enviar un abono del anticipo (pago en partes)
// El cliente decide libremente cuántos abonos hace y de qué monto, hasta
// completar el total.
// ─────────────────────────────────────────────

export const submitAdvancePaymentInstallment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const email = req.user?.email
    if (!email) {
      res.status(401).json({ success: false, message: 'Usuario no autenticado' })
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

    const submission = await ordersService.submitAdvancePaymentInstallment(
      id,
      email,
      paymentDetails,
      Number(amount)
    )
    res.status(201).json({ success: true, data: submission })
  } catch (error: any) {
    console.error('ERROR SUBIR ABONO DE ANTICIPO:', error)
    res.status(400).json({ success: false, message: error.message || 'Error al registrar el abono' })
  }
}

export const submitBudgetPaymentInstallmentHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const email = req.user?.email
    if (!email) {
      res.status(401).json({ success: false, message: 'Usuario no autenticado' })
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

    const submission = await ordersService.submitBudgetPaymentInstallment(
      id,
      email,
      paymentDetails,
      Number(amount)
    )
    res.status(201).json({ success: true, data: submission })
  } catch (error: any) {
    console.error('ERROR SUBIR ANTICIPO DE PRESUPUESTO:', error)
    res.status(400).json({ success: false, message: error.message || 'Error al registrar el anticipo' })
  }
}

// ─────────────────────────────────────────────
// ADMIN — Confirmar o rechazar un abono específico del anticipo
// ─────────────────────────────────────────────

export const confirmAdvancePaymentInstallment = async (req: AuthRequest, res: Response): Promise<void> => {
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

    const order = await ordersService.confirmAdvancePaymentInstallment(
      submissionId,
      Boolean(approved),
      rejectionReason,
      req.user?.email
    )

    broadcastOrderUpdate({
      type: 'ORDER_STATUS_UPDATED',
      data: order,
    })

    res.json({ success: true, data: order })
  } catch (error: any) {
    console.error('ERROR CONFIRMAR ABONO DE ANTICIPO:', error)
    res.status(400).json({ success: false, message: error.message || 'Error al confirmar el abono' })
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
    const { status, comment, technicianId, expectedVersion } = req.body
    if (!status) {
      res.status(400).json({ success: false, message: 'El status es requerido' })
      return
    }
    const order = await ordersService.updateOrderStatus(id, status, comment, technicianId, req.user?.email, expectedVersion)

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
    const { budget } = req.body
    if (budget === undefined) {
      res.status(400).json({
        success: false,
        message: 'budget es requerido',
      })
      return
    }
    const order = await ordersService.updateOrderBudget(id, budget)

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
// ADMIN/TECHNICIAN — Registrar el pago final desde el mostrador
// ─────────────────────────────────────────────

export const submitCounterFinalPaymentHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id)
    const { paymentDetails } = req.body

    if (!paymentDetails || typeof paymentDetails !== 'object') {
      res.status(400).json({ success: false, message: 'paymentDetails es requerido' })
      return
    }

    const order = await ordersService.submitCounterFinalPayment(id, paymentDetails)

    broadcastOrderUpdate({ type: 'ORDER_STATUS_UPDATED', data: order })

    res.json({ success: true, data: order })
  } catch (error: any) {
    console.error('ERROR REGISTRAR PAGO FINAL EN MOSTRADOR:', error)
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
// ADMIN — Cerrar una orden con presupuesto $0 (sin pago final que aprobar)
// ─────────────────────────────────────────────

export const closeZeroBudgetOrder = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id)
    const order = await ordersService.closeZeroBudgetOrder(id)

    broadcastOrderUpdate({
      type: 'ORDER_STATUS_UPDATED',
      data: order,
    })

    res.json({ success: true, data: order })
  } catch (error: any) {
    console.error('ERROR CERRAR ORDEN SIN COSTO:', error)
    res.status(400).json({ success: false, message: error.message || 'Error al cerrar la orden' })
  }
}

// ─────────────────────────────────────────────
// ADMIN — Marcar la entrega física (equipo pagado y reparado)
// ─────────────────────────────────────────────

export const markDelivered = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id)
    const order = await ordersService.markOrderDelivered(id)

    broadcastOrderUpdate({
      type: 'ORDER_STATUS_UPDATED',
      data: order,
    })

    res.json({ success: true, data: order })
  } catch (error: any) {
    console.error('ERROR MARCAR ENTREGADO:', error)
    res.status(400).json({ success: false, message: error.message || 'Error al marcar la orden como entregada' })
  }
}

// ─────────────────────────────────────────────
// ADMIN — Marcar retiro sin reparar (presupuesto rechazado)
// ─────────────────────────────────────────────

export const markPickedUpUnrepaired = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id)
    const order = await ordersService.markOrderPickedUpUnrepaired(id)

    broadcastOrderUpdate({
      type: 'ORDER_STATUS_UPDATED',
      data: order,
    })

    res.json({ success: true, data: order })
  } catch (error: any) {
    console.error('ERROR MARCAR RETIRADO SIN REPARAR:', error)
    res.status(400).json({ success: false, message: error.message || 'Error al cerrar la orden' })
  }
}

// ─────────────────────────────────────────────
// CLIENTE — Rechazar el presupuesto (Fase 5)
// ─────────────────────────────────────────────

export const rejectBudget = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const email = req.user?.email
    if (!email) {
      res.status(401).json({ success: false, message: 'Usuario no autenticado' })
      return
    }
    const id = String(req.params.id)
    const { reason } = req.body

    if (!reason || typeof reason !== 'string' || !reason.trim()) {
      res.status(400).json({ success: false, message: 'reason es requerido' })
      return
    }

    const order = await ordersService.rejectBudget(id, email, reason.trim())

    broadcastOrderUpdate({ type: 'ORDER_STATUS_UPDATED', data: order })

    res.json({ success: true, data: order })
  } catch (error: any) {
    console.error('ERROR RECHAZAR PRESUPUESTO:', error)
    res.status(400).json({ success: false, message: error.message || 'Error al rechazar el presupuesto' })
  }
}

export const confirmZeroBudgetDiagnosis = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const email = req.user?.email
    if (!email) {
      res.status(401).json({ success: false, message: 'Usuario no autenticado' })
      return
    }
    const id = String(req.params.id)
    const order = await ordersService.confirmZeroBudgetDiagnosis(id, email)

    broadcastOrderUpdate({ type: 'ORDER_STATUS_UPDATED', data: order })

    res.json({ success: true, data: order })
  } catch (error: any) {
    console.error('ERROR CONFIRMAR DIAGNOSTICO SIN COSTO:', error)
    res.status(400).json({ success: false, message: error.message || 'Error al confirmar el diagnóstico' })
  }
}

export const confirmDeliveryByClient = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const email = req.user?.email
    if (!email) {
      res.status(401).json({ success: false, message: 'Usuario no autenticado' })
      return
    }
    const id = String(req.params.id)
    const order = await ordersService.confirmDeliveryByClient(id, email)

    broadcastOrderUpdate({ type: 'ORDER_STATUS_UPDATED', data: order })

    res.json({ success: true, data: order })
  } catch (error: any) {
    console.error('ERROR CONFIRMAR ENTREGA (CLIENTE):', error)
    res.status(400).json({ success: false, message: error.message || 'Error al confirmar la entrega' })
  }
}

export const disputeZeroBudgetDiagnosis = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const email = req.user?.email
    if (!email) {
      res.status(401).json({ success: false, message: 'Usuario no autenticado' })
      return
    }
    const id = String(req.params.id)
    const { note } = req.body
    const order = await ordersService.disputeZeroBudgetDiagnosis(id, email, typeof note === 'string' ? note.trim() : undefined)

    broadcastOrderUpdate({ type: 'ORDER_STATUS_UPDATED', data: order })

    res.json({ success: true, data: order })
  } catch (error: any) {
    console.error('ERROR DISPUTAR DIAGNOSTICO SIN COSTO:', error)
    res.status(400).json({ success: false, message: error.message || 'Error al enviar la disputa' })
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
// ─────────────────────────────────────────────
// REPUESTOS DE INVENTARIO USADOS EN LA ORDEN — solo el técnico asignado
// ─────────────────────────────────────────────

export const useProductInOrderHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const email = req.user?.email
    if (!email) {
      res.status(401).json({ success: false, message: 'Usuario no autenticado' })
      return
    }

    const orderId = String(req.params.id)
    const { productId, quantity } = req.body

    if (!productId || !Number.isInteger(quantity) || quantity <= 0) {
      res.status(400).json({ success: false, message: 'productId y quantity (entero > 0) son requeridos' })
      return
    }

    const result = await ordersService.useProductInOrder(orderId, productId, quantity, email)
    res.status(201).json({ success: true, data: result })
  } catch (error: any) {
    if (error.message?.includes('Solo el técnico asignado')) {
      res.status(403).json({ success: false, message: error.message })
      return
    }
    if (error.constructor?.name === 'InsufficientStockError') {
      res.status(400).json({ success: false, message: 'Stock insuficiente para este repuesto' })
      return
    }
    console.error('ERROR USAR REPUESTO EN ORDEN:', error)
    res.status(400).json({ success: false, message: error.message || 'Error al registrar el repuesto' })
  }
}

export const revertProductUsageHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const email = req.user?.email
    if (!email) {
      res.status(401).json({ success: false, message: 'Usuario no autenticado' })
      return
    }

    const movementId = String(req.params.movementId)
    const result = await ordersService.revertProductUsage(movementId, email)
    res.status(200).json({ success: true, data: result })
  } catch (error: any) {
    if (error.message?.includes('Solo el técnico asignado')) {
      res.status(403).json({ success: false, message: error.message })
      return
    }
    console.error('ERROR REVERTIR REPUESTO:', error)
    res.status(400).json({ success: false, message: error.message || 'Error al revertir el repuesto' })
  }
}

export const getPartsUsedInOrderHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orderId = String(req.params.id)
    const parts = await ordersService.getPartsUsedInOrder(orderId)
    res.status(200).json({ success: true, data: parts })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Error al obtener los repuestos usados' })
  }
}

// ─────────────────────────────────────────────
// ABONO ADICIONAL EN ORDEN DE RECEPCIÓN — staff (ADMIN/TECHNICIAN)
// ─────────────────────────────────────────────

export const submitCounterAdvanceInstallmentHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const actorEmail = req.user?.email
    if (!actorEmail) {
      res.status(401).json({ success: false, message: 'Usuario no autenticado' })
      return
    }

    const orderId = String(req.params.id)
    const { paymentDetails, amount } = req.body

    if (!paymentDetails || typeof paymentDetails !== 'object') {
      res.status(400).json({ success: false, message: 'paymentDetails es requerido' })
      return
    }
    if (amount === undefined || amount === null || Number.isNaN(Number(amount))) {
      res.status(400).json({ success: false, message: 'amount es requerido y debe ser numérico' })
      return
    }

    const submission = await ordersService.submitCounterAdvanceInstallment(orderId, actorEmail, paymentDetails, Number(amount))
    res.status(201).json({ success: true, data: submission })
  } catch (error: any) {
    console.error('ERROR ABONO RECEPCIÓN:', error)
    res.status(400).json({ success: false, message: error.message || 'Error al registrar el abono' })
  }
}

export const submitCounterBudgetInstallmentHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const actorEmail = req.user?.email
    if (!actorEmail) {
      res.status(401).json({ success: false, message: 'Usuario no autenticado' })
      return
    }

    const orderId = String(req.params.id)
    const { paymentDetails, amount } = req.body

    if (!paymentDetails || typeof paymentDetails !== 'object') {
      res.status(400).json({ success: false, message: 'paymentDetails es requerido' })
      return
    }
    if (amount === undefined || amount === null || Number.isNaN(Number(amount))) {
      res.status(400).json({ success: false, message: 'amount es requerido y debe ser numérico' })
      return
    }

    const submission = await ordersService.submitCounterBudgetInstallment(orderId, actorEmail, paymentDetails, Number(amount))
    res.status(201).json({ success: true, data: submission })
  } catch (error: any) {
    console.error('ERROR ANTICIPO PRESUPUESTO MOSTRADOR:', error)
    res.status(400).json({ success: false, message: error.message || 'Error al registrar el anticipo' })
  }
}

// ─────────────────────────────────────────────
// ADMIN/TECHNICIAN/TECHNICIAN_DELIVERY — Ajuste imprevisto al presupuesto
// ─────────────────────────────────────────────

export const addBudgetAdjustmentHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const actorEmail = req.user?.email
    if (!actorEmail) {
      res.status(401).json({ success: false, message: 'Usuario no autenticado' })
      return
    }

    const orderId = String(req.params.id)
    const { amount, reason } = req.body

    if (amount === undefined || amount === null || Number.isNaN(Number(amount))) {
      res.status(400).json({ success: false, message: 'amount es requerido y debe ser numérico' })
      return
    }
    if (!reason || typeof reason !== 'string' || !reason.trim()) {
      res.status(400).json({ success: false, message: 'reason es requerido' })
      return
    }

    const order = await ordersService.addBudgetAdjustment(orderId, actorEmail, Number(amount), reason.trim())

    broadcastOrderUpdate({
      type: 'ORDER_STATUS_UPDATED',
      data: order,
    })

    res.json({ success: true, data: order })
  } catch (error: any) {
    console.error('ERROR AJUSTE DE PRESUPUESTO:', error)
    res.status(400).json({ success: false, message: error.message || 'Error al ajustar el presupuesto' })
  }
}

// ─────────────────────────────────────────────
// TECHNICIAN/TECHNICIAN_DELIVERY — Terminar la reparación
// ─────────────────────────────────────────────

export const finishRepairHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const email = req.user?.email
    if (!email) {
      res.status(401).json({ success: false, message: 'Usuario no autenticado' })
      return
    }

    const actor = await prisma.user.findUnique({ where: { email }, select: { id: true } })
    if (!actor) {
      res.status(401).json({ success: false, message: 'Usuario no encontrado' })
      return
    }

    const orderId = String(req.params.id)
    const { observation } = req.body

    // `observation` es opcional, pero si viene con un tipo que no es string
    // (número, objeto, array) se ignora en vez de interpolarse crudo en el
    // comentario del historial — mismo criterio que addBudgetAdjustmentHandler
    // aplica a `reason`.
    const safeObservation = typeof observation === 'string' ? observation : undefined

    const order = await ordersService.finishRepair(orderId, actor.id, safeObservation)

    broadcastOrderUpdate({
      type: 'ORDER_STATUS_UPDATED',
      data: order,
    })

    res.json({ success: true, data: order })
  } catch (error: any) {
    console.error('ERROR TERMINAR REPARACIÓN:', error)
    res.status(400).json({ success: false, message: error.message || 'Error al terminar la reparación' })
  }
}
