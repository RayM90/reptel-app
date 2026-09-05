// Este archivo importa `../websocket` directamente (no pasa por `../app`),
// y `websocket.ts` -> `auth.middleware.ts` crea el CognitoJwtVerifier al
// cargarse, leyendo COGNITO_USER_POOL_ID/COGNITO_CLIENT_ID de process.env.
// Hay que cargar el .env explícitamente antes del import, igual que hace
// `prisma/seed.ts`, porque nada más en este archivo dispara dotenv.config().
import dotenv from 'dotenv'
dotenv.config()

import { authenticateWsConnection, sanitizeBroadcastPayload } from '../websocket'

describe('websocket — authenticateWsConnection', () => {

  it('retorna null cuando la URL no trae token', async () => {
    const req: any = { url: '/' }
    const result = await authenticateWsConnection(req)
    expect(result).toBeNull()
  })

  it('retorna null cuando el token no es un JWT válido', async () => {
    const req: any = { url: '/?token=esto-no-es-un-jwt-valido' }
    const result = await authenticateWsConnection(req)
    expect(result).toBeNull()
  })

})

describe('websocket — sanitizeBroadcastPayload', () => {

  it('quita devicePassword y reduce los datos del cliente a id + name', () => {
    const payload = {
      type: 'ORDER_CREATED',
      data: {
        id: 'order-1',
        client: {
          id: 'client-1',
          name: 'Juan',
          lastName: 'Pérez',
          phone: '04120000000',
          address: 'Calle 1',
        },
        device: {
          id: 'device-1',
          brand: 'HP',
          devicePassword: 'secreto123',
        },
      },
    }

    const result = sanitizeBroadcastPayload(payload)

    expect(result.data.client).toEqual({ id: 'client-1', name: 'Juan' })
    expect(result.data.device).not.toHaveProperty('devicePassword')
    expect(result.data.device.brand).toBe('HP')
  })

  it('no revienta si data no trae client ni device', () => {
    const payload = { type: 'ORDER_STATUS_UPDATED', data: { id: 'order-2' } }
    const result = sanitizeBroadcastPayload(payload)
    expect(result.data.id).toBe('order-2')
  })

})
