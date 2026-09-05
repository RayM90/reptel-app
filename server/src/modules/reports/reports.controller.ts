import { Response } from 'express'
import { AuthRequest } from '../../middleware/auth.middleware'
import * as reportsService from './reports.service'

export const getSummary = async (req: AuthRequest, res: Response) => {
  try {
    const { from, to, technicianId, clientId } = req.query

    if (!from || !to) {
      res.status(400).json({ success: false, message: 'Los parámetros from y to son obligatorios' })
      return
    }

    const fromDate = new Date(String(from))
    const toDate = new Date(String(to))
    toDate.setHours(23, 59, 59, 999)

    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      res.status(400).json({ success: false, message: 'Fechas inválidas' })
      return
    }

    if (fromDate > toDate) {
      res.status(400).json({ success: false, message: 'La fecha "desde" no puede ser posterior a "hasta"' })
      return
    }

    const summary = await reportsService.getReportSummary({
      from: fromDate,
      to: toDate,
      technicianId: technicianId ? String(technicianId) : undefined,
      clientId: clientId ? String(clientId) : undefined,
    })

    res.json({ success: true, data: summary })
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al generar el reporte' })
  }
}
