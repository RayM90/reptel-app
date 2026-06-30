import dotenv from 'dotenv'
dotenv.config()
import http from 'http'
import { WebSocketServer } from 'ws'
import app from './app'
import { setWss, broadcastOrderUpdate } from './websocket'

const PORT = Number(process.env.PORT) || 3000

const server = http.createServer(app)
const wss = new WebSocketServer({ server })

setWss(wss)
export { broadcastOrderUpdate }

wss.on('connection', (ws) => {
  console.log('Cliente conectado a WebSocket')
  ws.send(JSON.stringify({ type: 'CONNECTED', message: 'Conectado a RepTel en tiempo real' }))
  ws.on('close', () => console.log('Cliente desconectado de WebSocket'))
})

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor RepTel corriendo en http://localhost:${PORT}`)
  console.log(`Red local: http://192.168.0.116:${PORT}`)
  console.log(`WebSocket corriendo en ws://192.168.0.116:${PORT}`)
})

export default app