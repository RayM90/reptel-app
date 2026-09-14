import { Response } from 'express'
import { AuthRequest } from '../../middleware/auth.middleware'
import prisma from '../../lib/prisma'
import { getOrderById, getPartsUsedInOrder } from '../orders/orders.service'
import { generateIntakeReceipt, generateFinalReceipt, generatePaymentReceipt, generateClosureReceipt, generateBudgetAdvanceReceipt, getIntakeReceiptLabels } from './receipts.service'

// Cliente dueño de la orden, o ADMIN/técnico asignado — nunca otro cliente.
const canAccessOrder = async (
  req: AuthRequest,
  order: { clientId: string }
): Promise<boolean> => {
  const groups = req.user?.groups ?? []
  if (groups.includes('ADMIN') || groups.includes('TECHNICIAN_DELIVERY') || groups.includes('TECHNICIAN')) return true
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

    const movements = await getPartsUsedInOrder(id)
    const partsUsed = movements
      .filter((m) => !m.reversedAt)
      .map((m) => ({ productName: m.product.name, quantity: m.quantity, unitPriceAtUse: m.unitPriceAtUse }))

    const confirmedSubmissions = ((order as any).advancePaymentSubmissions ?? []).filter(
      (s: any) => s.status === 'CONFIRMED'
    )

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="recibo-entrega-${order.orderNumber}.pdf"`)
    const doc = generateFinalReceipt({ ...order, partsUsed, advancePaymentSubmissions: confirmedSubmissions } as any)
    doc.pipe(res)
  } catch (error: any) {
    console.error('ERROR GENERAR RECIBO DE ENTREGA:', error)
    res.status(500).json({ success: false, message: error.message || 'Error al generar el recibo' })
  }
}

export const downloadPaymentReceipt = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id)
    const order = await getOrderById(id)
    if (!order) {
      res.status(404).json({ success: false, message: 'Orden no encontrada' })
      return
    }
    if (!order.finalPaymentConfirmed || order.budget == null || Number(order.budget) === 0) {
      res.status(400).json({ success: false, message: 'El recibo de pago no está disponible: el presupuesto aún no ha sido pagado y confirmado' })
      return
    }
    if (!(await canAccessOrder(req, order))) {
      res.status(403).json({ success: false, message: 'No tienes permisos para esta acción' })
      return
    }

    const movements = await getPartsUsedInOrder(id)
    const partsUsed = movements
      .filter((m) => !m.reversedAt)
      .map((m) => ({ productName: m.product.name, quantity: m.quantity, unitPriceAtUse: m.unitPriceAtUse }))

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="recibo-pago-${order.orderNumber}.pdf"`)
    const doc = generatePaymentReceipt({ ...order, partsUsed } as any)
    doc.pipe(res)
  } catch (error: any) {
    console.error('ERROR GENERAR RECIBO DE PAGO:', error)
    res.status(500).json({ success: false, message: error.message || 'Error al generar el recibo' })
  }
}

export const downloadClosureReceipt = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id)
    const order = await getOrderById(id)
    if (!order) {
      res.status(404).json({ success: false, message: 'Orden no encontrada' })
      return
    }
    if (order.status !== 'CANCELLED') {
      res.status(400).json({ success: false, message: 'El recibo de cierre solo está disponible para órdenes canceladas' })
      return
    }
    if (!(await canAccessOrder(req, order))) {
      res.status(403).json({ success: false, message: 'No tienes permisos para esta acción' })
      return
    }

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="recibo-cierre-${order.orderNumber}.pdf"`)
    const doc = generateClosureReceipt(order as any)
    doc.pipe(res)
  } catch (error: any) {
    console.error('ERROR GENERAR RECIBO DE CIERRE:', error)
    res.status(500).json({ success: false, message: error.message || 'Error al generar el recibo' })
  }
}

export const downloadBudgetAdvanceReceipt = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id)
    const order = await getOrderById(id)
    if (!order) {
      res.status(404).json({ success: false, message: 'Orden no encontrada' })
      return
    }
    const hasBudgetAdvance = (order as any).advancePaymentSubmissions?.some(
      (s: any) => s.kind === 'BUDGET' && s.status === 'CONFIRMED'
    )
    if (!hasBudgetAdvance) {
      res.status(400).json({ success: false, message: 'El recibo de anticipo de presupuesto no está disponible: aún no se ha confirmado ese pago' })
      return
    }
    if (!(await canAccessOrder(req, order))) {
      res.status(403).json({ success: false, message: 'No tienes permisos para esta acción' })
      return
    }

    const confirmedBudgetSubmissions = (order as any).advancePaymentSubmissions
      .filter((s: any) => s.kind === 'BUDGET' && s.status === 'CONFIRMED')

    // El cliente puede pagar el anticipo en partes — el recibo muestra la
    // suma de todo lo confirmado, no solo el último abono.
    const budgetAdvanceAmount = confirmedBudgetSubmissions.reduce(
      (sum: number, s: any) => sum + Number(s.amount),
      0
    )
    const mostRecentBudgetSubmission = [...confirmedBudgetSubmissions].sort(
      (a: any, b: any) => new Date(b.confirmedAt).getTime() - new Date(a.confirmedAt).getTime()
    )[0]
    const budgetAdvanceConfirmedAt = mostRecentBudgetSubmission?.confirmedAt ?? null

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="recibo-pago-presupuesto-${order.orderNumber}.pdf"`)
    const doc = generateBudgetAdvanceReceipt({
      ...order,
      budgetAdvanceConfirmedAt,
      budgetAdvanceAmount,
      finalPaymentDetails: mostRecentBudgetSubmission?.paymentDetails as Record<string, string>,
    } as any)
    doc.pipe(res)
  } catch (error: any) {
    console.error('ERROR GENERAR RECIBO DE ANTICIPO DE PRESUPUESTO:', error)
    res.status(500).json({ success: false, message: error.message || 'Error al generar el recibo' })
  }
}
