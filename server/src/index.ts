import dotenv from 'dotenv'
dotenv.config()
import http from 'http'
import os from 'os'
import { WebSocketServer } from 'ws'
import app from './app'
import { setWss, broadcastOrderUpdate, authenticateWsConnection } from './websocket'

const PORT = Number(process.env.PORT) || 3000

// La IP de LAN se calcula en vivo (antes estaba hardcodeada y quedaba
// desactualizada cada vez que el DHCP reasignaba la IP de la máquina,
// causando "Network Error" en el móvil por apuntar a una IP muerta).
const getLocalIp = (): string => {
  const nets = os.networkInterfaces()
  const candidates: string[] = []
  for (const name of Object.keys(nets)) {
    // Descarta VPN/túneles (Tailscale, ProTUN, etc.) — el teléfono se
    // conecta por la LAN física (Wi-Fi), no por esas interfaces.
    if (/tailscale|protun|tun|vpn/i.test(name)) continue
    for (const net of nets[name] ?? []) {
      if (net.family === 'IPv4' && !net.internal) candidates.push(net.address)
    }
  }
  // Prioriza el rango típico de LAN doméstica.
  return candidates.find((ip) => ip.startsWith('192.168.')) ?? candidates[0] ?? 'localhost'
}

const server = http.createServer(app)
const wss = new WebSocketServer({ server })

setWss(wss)
export { broadcastOrderUpdate }

wss.on('connection', async (ws, req) => {
  const user = await authenticateWsConnection(req)
  if (!user) {
    ws.close(4001, 'No autorizado')
    return
  }

  console.log(`Cliente conectado a WebSocket (${user.email})`)
  ws.send(JSON.stringify({ type: 'CONNECTED', message: 'Conectado a RepTel en tiempo real' }))
  ws.on('close', () => console.log('Cliente desconectado de WebSocket'))
})

server.listen(PORT, '0.0.0.0', () => {
  const localIp = getLocalIp()
  console.log(`Servidor RepTel corriendo en http://localhost:${PORT}`)
  console.log(`Red local: http://${localIp}:${PORT}`)
  console.log(`WebSocket corriendo en ws://${localIp}:${PORT}`)
})

export default app