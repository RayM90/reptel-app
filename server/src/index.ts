import express from 'express'
import dotenv from 'dotenv'
import path from 'path'
import http from 'http'
import { WebSocketServer, WebSocket } from 'ws'
import ordersRouter from './modules/orders/orders.routes'
import authRouter from './modules/auth/auth.routes'
import usersRouter from './modules/users/users.routes'
import devicesRouter from './modules/devices/devices.routes'
import chatbotRouter from './modules/chatbot/chatbot.routes'

dotenv.config()

const app = express()
const PORT = Number(process.env.PORT) || 3000

app.use(express.json())
app.use(express.static(path.join(__dirname, 'public')))

// ─── Rutas ────────────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({ 
    message: 'RepTel API funcionando correctamente',
    version: '1.0.0'
  })
})

app.use('/api/auth', authRouter)
app.use('/api/users', usersRouter)
app.use('/api/devices', devicesRouter)
app.use('/api/orders', ordersRouter)
app.use('/api/chatbot', chatbotRouter)

// ─── WebSocket Server ─────────────────────────────────────────────────────────
const server = http.createServer(app)
const wss = new WebSocketServer({ server })

export const broadcastOrderUpdate = (data: any) => {
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data))
    }
  })
}

wss.on('connection', (ws) => {
  console.log('Cliente conectado a WebSocket')
  ws.send(JSON.stringify({ type: 'CONNECTED', message: 'Conectado a RepTel en tiempo real' }))
  ws.on('close', () => console.log('Cliente desconectado de WebSocket'))
})

// ─── Servidor ─────────────────────────────────────────────────────────────────
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor RepTel corriendo en http://localhost:${PORT}`)
  console.log(`Red local: http://192.168.0.107:${PORT}`)
  console.log(`WebSocket corriendo en ws://192.168.0.107:${PORT}`)
})

export default app