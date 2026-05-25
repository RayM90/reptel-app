import { WebSocket } from 'ws'

let wssInstance: any = null

export const setWss = (wss: any) => {
  wssInstance = wss
}

export const broadcastOrderUpdate = (data: any) => {
  if (!wssInstance) return
  wssInstance.clients.forEach((client: any) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data))
    }
  })
}