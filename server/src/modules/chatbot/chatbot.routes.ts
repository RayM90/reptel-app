import { Router } from 'express'
import { chat } from './chatbot.controller'

const router = Router()

// Ruta pública — clientes pueden chatear sin autenticarse
router.post('/message', chat)

export default router