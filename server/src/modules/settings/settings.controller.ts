import { Request, Response } from 'express'
import * as settingsService from './settings.service'

export const getPaymentMethods = async (req: Request, res: Response): Promise<void> => {
  try {
    const settings = await settingsService.getPaymentSettings()
    res.json({ success: true, data: settings })
  } catch (error) {
    console.error('ERROR GET PAYMENT SETTINGS:', error)
    res.status(500).json({ success: false, message: 'Error al obtener los métodos de pago' })
  }
}

export const updatePaymentMethods = async (req: Request, res: Response): Promise<void> => {
  try {
    const settings = await settingsService.updatePaymentSettings(req.body)
    res.json({ success: true, data: settings })
  } catch (error) {
    console.error('ERROR UPDATE PAYMENT SETTINGS:', error)
    res.status(500).json({ success: false, message: 'Error al actualizar los métodos de pago' })
  }
}
