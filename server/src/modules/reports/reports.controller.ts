import { Response } from 'express'
import { AuthRequest } from '../../middleware/auth.middleware'
import * as reportsService from './reports.service'

// Parsea y valida from/to, compartido por getSummary y getAudit. Devuelve
// null y ya envió la respuesta de error si algo es inválido.
function parseDateRange(req: AuthRequest, res: Response): { from: Date; to: Date } | null {
  const { from, to } = req.query

  if (!from || !to) {
    res.status(400).json({ success: false, message: 'Los parámetros from y to son obligatorios' })
    return null
  }

  const fromDate = new Date(String(from))
  const toDate = new Date(String(to))
  toDate.setHours(23, 59, 59, 999)

  if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
    res.status(400).json({ success: false, message: 'Fechas inválidas' })
    return null
  }

  if (fromDate > toDate) {
    res.status(400).json({ success: false, message: 'La fecha "desde" no puede ser posterior a "hasta"' })
    return null
  }

  return { from: fromDate, to: toDate }
}

function parseChannel(req: AuthRequest, res: Response): 'WEB' | 'APK' | undefined | null {
  const { channel } = req.query
  if (!channel) return undefined
  if (channel !== 'WEB' && channel !== 'APK') {
    res.status(400).json({ success: false, message: 'channel debe ser WEB o APK' })
    return null
  }
  return channel
}

export const getSummary = async (req: AuthRequest, res: Response) => {
  try {
    const range = parseDateRange(req, res)
    if (!range) return

    const channel = parseChannel(req, res)
    if (channel === null) return

    const { technicianId, clientId } = req.query

    const summary = await reportsService.getReportSummary({
      from: range.from,
      to: range.to,
      technicianId: technicianId ? String(technicianId) : undefined,
      clientId: clientId ? String(clientId) : undefined,
      channel,
    })

    res.json({ success: true, data: summary })
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al generar el reporte' })
  }
}

export const getAudit = async (req: AuthRequest, res: Response) => {
  try {
    const range = parseDateRange(req, res)
    if (!range) return

    const channel = parseChannel(req, res)
    if (channel === null) return

    const { status, technicianId, clientId } = req.query

    const audit = await reportsService.getAuditReport({
      from: range.from,
      to: range.to,
      status: status ? String(status) : undefined,
      technicianId: technicianId ? String(technicianId) : undefined,
      clientId: clientId ? String(clientId) : undefined,
      channel,
    })

    res.json({ success: true, data: audit })
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al generar la auditoría' })
  }
}

export const getClientHistory = async (req: AuthRequest, res: Response) => {
  try {
    const idNumber = String(req.params.idNumber)
    const result = await reportsService.getClientHistoryReport(idNumber)
    if (!result) {
      res.status(404).json({ success: false, message: 'Cliente no encontrado' })
      return
    }
    res.json({ success: true, data: result })
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al generar el expediente del cliente' })
  }
}

export const getTechnicians = async (req: AuthRequest, res: Response) => {
  try {
    const technicians = await reportsService.getReportTechnicians()
    res.json({ success: true, data: technicians })
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al obtener los técnicos' })
  }
}
