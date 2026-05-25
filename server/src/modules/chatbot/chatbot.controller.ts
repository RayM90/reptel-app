import { Request, Response } from 'express'
import { sendMessageToLex } from './chatbot.service'

export const chat = async (req: Request, res: Response): Promise<void> => {
  try {
    const { message, sessionId } = req.body

    if (!message || !sessionId) {
      res.status(400).json({
        success: false,
        message: 'Se requieren los campos message y sessionId'
      })
      return
    }

    const result = await sendMessageToLex(sessionId, message)

    res.json({
      success: true,
      response: result.response,
      intent: result.intent,
    })
  } catch (error) {
    console.error('Error en chatbot:', error)
    res.status(500).json({
      success: false,
      message: 'Error procesando el mensaje'
    })
  }
}