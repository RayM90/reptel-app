import { WebSocket } from 'ws'
import type { IncomingMessage } from 'http'
import { verifier } from './middleware/auth.middleware'

let wssInstance: any = null

export const setWss = (wss: any) => {
  wssInstance = wss
}

/**
 * Verifica el token de Cognito enviado como query param (?token=...) en el
 * handshake del WebSocket. Los navegadores y React Native no permiten fijar
 * headers personalizados al abrir un WebSocket, por eso el token viaja en
 * la URL en vez de en un header Authorization — en producción esto exige
 * usar wss:// (TLS) para que el token no viaje en claro.
 * Retorna el usuario decodificado si el token es válido, o null si falta o
 * es inválido — el llamador debe cerrar la conexión en ese caso.
 */
export const authenticateWsConnection = async (
  req: IncomingMessage
): Promise<{ sub: string; email: string; groups: string[] } | null> => {
  try {
    const url = new URL(req.url ?? '', 'http://localhost')
    const token = url.searchParams.get('token')
    if (!token) return null

    const payload = await verifier.verify(token)
    return {
      sub: payload.sub,
      email: payload.email as string,
      groups: (payload['cognito:groups'] as string[]) || [],
    }
  } catch {
    return null
  }
}

/**
 * Reduce los datos del cliente a lo mínimo indispensable para una
 * notificación en vivo (id + nombre) — nunca apellido, teléfono, dirección
 * ni cédula por este canal. Quien necesite el detalle completo lo pide por
 * la API REST autenticada, que sí aplica control de acceso por dueño.
 */
const sanitizeClient = (client: any) => {
  if (!client || typeof client !== 'object') return client
  return { id: client.id, name: client.name }
}

/**
 * Nunca se difunde la contraseña del equipo por este canal — no hay ningún
 * caso de uso legítimo que la necesite en una notificación push; quien
 * abre la orden la consulta por la API REST autenticada.
 */
const sanitizeDevice = (device: any) => {
  if (!device || typeof device !== 'object') return device
  const { devicePassword, ...rest } = device
  return rest
}

const sanitizeOrder = (order: any) => {
  if (!order || typeof order !== 'object') return order
  return {
    ...order,
    client: sanitizeClient(order.client),
    device: sanitizeDevice(order.device),
  }
}

export const sanitizeBroadcastPayload = (payload: any) => {
  if (!payload || typeof payload !== 'object') return payload
  return { ...payload, data: sanitizeOrder(payload.data) }
}

export const broadcastOrderUpdate = (data: any) => {
  if (!wssInstance) return
  const safePayload = sanitizeBroadcastPayload(data)
  wssInstance.clients.forEach((client: any) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(safePayload))
    }
  })
}
