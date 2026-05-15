import { Request, Response } from 'express'
import * as ordersService from './orders.service'

export const getOrders = async (req: Request, res: Response): Promise<void> => {
  try {
    const orders = await ordersService.getAllOrders()
    res.json({ success: true, data: orders })
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al obtener órdenes' })
  }
}

export const getOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id)
    const order = await ordersService.getOrderById(id)
    if (!order) {
      res.status(404).json({ success: false, message: 'Orden no encontrada' })
      return
    }
    res.json({ success: true, data: order })
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al obtener la orden' })
  }
}

export const createOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const { clientId, deviceId, problem } = req.body
    if (!clientId || !deviceId || !problem) {
      res.status(400).json({ 
        success: false, 
        message: 'clientId, deviceId y problem son requeridos' 
      })
      return
    }
    const orderNumber = `REP-${Date.now()}`
    const order = await ordersService.createOrder({
      clientId,
      deviceId,
      problem,
      orderNumber,
    })
    res.status(201).json({ success: true, data: order })
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al crear la orden' })
  }
}

export const updateStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id)
    const { status, comment } = req.body
    if (!status) {
      res.status(400).json({ success: false, message: 'El status es requerido' })
      return
    }
    const order = await ordersService.updateOrderStatus(id, status, comment)
    res.json({ success: true, data: order })
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al actualizar el estado' })
  }
}