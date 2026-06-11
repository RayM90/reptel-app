import { Response } from 'express'
import { AuthRequest } from '../../middleware/auth.middleware'
import * as catalogService from './catalog.service'

export const getAll = async (req: AuthRequest, res: Response) => {
  try {
    const services = await catalogService.getAllServices()
    res.json({ success: true, data: services })
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al obtener catálogo' })
  }
}

export const getOne = async (req: AuthRequest, res: Response) => {
  try {
    const id = String(req.params.id)
    const service = await catalogService.getServiceById(id)
    if (!service) {
      res.status(404).json({ success: false, message: 'Servicio no encontrado' })
      return
    }
    res.json({ success: true, data: service })
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al obtener servicio' })
  }
}

export const update = async (req: AuthRequest, res: Response) => {
  try {
    const id = String(req.params.id)
    const service = await catalogService.updateService(id, req.body)
    res.json({ success: true, data: service })
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al actualizar servicio' })
  }
}