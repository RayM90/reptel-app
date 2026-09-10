import { Response } from 'express'
import { AuthRequest } from '../../middleware/auth.middleware'
import prisma from '../../lib/prisma'
import { getOrderById } from '../orders/orders.service'
import { generateIntakeReceipt, generateFinalReceipt, getIntakeReceiptLabels } from './receipts.service'

// Cliente dueño de la orden, o ADMIN/técnico asignado — nunca otro cliente.
const canAccessOrder = async (
  req: AuthRequest,
  order: { clientId: string }
): Promise<boolean> => {
  const groups = req.user?.groups ?? []
  if (groups.includes('ADMIN') || groups.includes('TECHNICIAN_DELIVERY')) return true
  if (groups.includes('CLIENT') && req.user?.email) {
    const user = await prisma.user.findUnique({ where: { email: req.user.email }, select: { clientId: true } })
    return user?.clientId === order.clientId
  }
  return false
}

export const downloadIntakeReceipt = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id)
    const order = await getOrderById(id)
    if (!order) {
      res.status(404).json({ success: false, message: 'Orden no encontrada' })
      return
    }
    if (order.status === 'PENDING_PAYMENT') {
      res.status(400).json({ success: false, message: 'El recibo de recepción no está disponible: el anticipo aún no está confirmado' })
      return
    }
    if (!(await canAccessOrder(req, order))) {
      res.status(403).json({ success: false, message: 'No tienes permisos para esta acción' })
      return
    }

    const { pendingPickup } = getIntakeReceiptLabels(order as any)
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="recibo-${pendingPickup ? 'anticipo' : 'recepcion'}-${order.orderNumber}.pdf"`)
    const doc = generateIntakeReceipt(order as any)
    doc.pipe(res)
  } catch (error: any) {
    console.error('ERROR GENERAR RECIBO DE RECEPCIÓN:', error)
    res.status(500).json({ success: false, message: error.message || 'Error al generar el recibo' })
  }
}

export const downloadFinalReceipt = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id)
    const order = await getOrderById(id)
    if (!order) {
      res.status(404).json({ success: false, message: 'Orden no encontrada' })
      return
    }
    if (order.status !== 'DELIVERED') {
      res.status(400).json({ success: false, message: 'El recibo final solo está disponible para órdenes entregadas' })
      return
    }
    if (!(await canAccessOrder(req, order))) {
      res.status(403).json({ success: false, message: 'No tienes permisos para esta acción' })
      return
    }

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="recibo-entrega-${order.orderNumber}.pdf"`)
    const doc = generateFinalReceipt(order as any)
    doc.pipe(res)
  } catch (error: any) {
    console.error('ERROR GENERAR RECIBO DE ENTREGA:', error)
    res.status(500).json({ success: false, message: error.message || 'Error al generar el recibo' })
  }
}
