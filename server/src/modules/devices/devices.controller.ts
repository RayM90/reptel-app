import { Response } from 'express'
import { AuthRequest } from '../../middleware/auth.middleware'
import prisma from '../../lib/prisma'
import {
  getAllDevices,
  getDeviceById,
  createDevice,
  updateDevice,
} from './devices.service'

export const getDevices = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const devices = await getAllDevices()
    res.status(200).json({ success: true, data: devices })
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Error al obtener dispositivos' })
  }
}

export const getDevice = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params
    let requestingClientId: string | undefined

    if (req.user?.groups.includes('CLIENT')) {
      const user = await prisma.user.findUnique({
        where: { email: req.user.email },
        select: { clientId: true },
      })
      requestingClientId = user?.clientId ?? undefined
    }

    const device = await getDeviceById(id as string, requestingClientId)
    if (!device) {
      res.status(404).json({ message: 'Dispositivo no encontrado' })
      return
    }
    res.status(200).json({ success: true, data: device })
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Error al obtener dispositivo' })
  }
}

export const registerDevice = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { type, brand, model, serialNumber, color, accessories, devicePassword } = req.body

    if (!type || !brand || !model) {
      res.status(400).json({ message: 'Tipo, marca y modelo son requeridos' })
      return
    }

    const validTypes = ['LAPTOP', 'PC']
    if (!validTypes.includes(type)) {
      res.status(400).json({ message: 'Tipo de dispositivo inválido. Solo se acepta LAPTOP o PC' })
      return
    }

    const device = await createDevice({
      type,
      brand,
      model,
      serialNumber,
      color,
      accessories,
      devicePassword,
    })
    res.status(201).json({ success: true, data: device })
  } catch (error: any) {
    res.status(400).json({ message: error.message || 'Error al registrar dispositivo' })
  }
}

export const updateDeviceData = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params
    const { brand, model, serialNumber, color, accessories, devicePassword } = req.body
    const device = await updateDevice(id as string, {
      brand,
      model,
      serialNumber,
      color,
      accessories,
      devicePassword,
    })
    res.status(200).json({ success: true, data: device })
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Error al actualizar dispositivo' })
  }
}