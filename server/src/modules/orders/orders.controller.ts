import { Response } from 'express'
import { AuthRequest } from '../../middleware/auth.middleware'
import * as ordersService from './orders.service'
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
// ─────────────────────────────────────────────

export const createMyOrder = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const email = req.user?.email
    if (!email) {
      res.status(401).json({ success: false, message: 'Usuario no autenticado' })
      return
    }

    const { device, problem, observations } = req.body

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

    const order = await ordersService.createSelfServiceOrder({
      email,
      device,
      problem,
      observations,
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