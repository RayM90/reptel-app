import request from 'supertest'
import app from '../app'

let authToken: string
let createdOrderId: string
let clientId: string
let deviceId: string

beforeAll(async () => {
  // Obtener token de admin
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: 'admin@reptel.com', password: 'RepTel2024*' })
  authToken = res.body.data.token

  // Obtener usuarios — usar el admin como cliente para el test
  const usersRes = await request(app)
    .get('/api/users')
    .set('Authorization', `Bearer ${authToken}`)
  const users = usersRes.body.data || []
  clientId = users[0]?.id  // usar el primer usuario disponible

  // Obtener dispositivos
  const devicesRes = await request(app)
    .get('/api/devices')
    .set('Authorization', `Bearer ${authToken}`)
  const devices = devicesRes.body.data || []
  deviceId = devices[0]?.id

  console.log('clientId:', clientId)
  console.log('deviceId:', deviceId)
}, 20000)

// ── GET /api/orders ────────────────────────────────────────────────────────
describe('Orders — GET /api/orders', () => {

  it('debe retornar 200 y lista de órdenes', async () => {
    const res = await request(app)
      .get('/api/orders')

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(Array.isArray(res.body.data)).toBe(true)
  }, 10000)

})

// ── GET /api/orders/track/:orderNumber ────────────────────────────────────
describe('Orders — GET /api/orders/track/:orderNumber', () => {

  it('debe retornar 200 con número de orden válido', async () => {
    const res = await request(app)
      .get('/api/orders/track/REP-260518-9027')

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data).toHaveProperty('orderNumber')
    expect(res.body.data).toHaveProperty('status')
  }, 10000)

  it('debe retornar 404 con número de orden inexistente', async () => {
    const res = await request(app)
      .get('/api/orders/track/REP-000000-0000')

    expect(res.status).toBe(404)
    expect(res.body.success).toBe(false)
  })

})

// ── POST /api/orders ───────────────────────────────────────────────────────
describe('Orders — POST /api/orders', () => {

  it('debe crear una orden con datos válidos', async () => {
    if (!clientId || !deviceId) {
      console.warn('Saltando: no hay cliente o dispositivo disponible')
      return
    }

    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        clientId,
        deviceId,
        problem: 'Pantalla rota - test automatizado',
        observations: 'Creado por Jest',
      })

    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)
    expect(res.body.data).toHaveProperty('orderNumber')
    expect(res.body.data.status).toBe('RECEIVED')
    createdOrderId = res.body.data.id
  }, 10000)

  it('debe retornar 400 si faltan campos requeridos', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ clientId })

    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
  })

})

// ── PATCH /api/orders/:id/status ──────────────────────────────────────────
describe('Orders — PATCH /api/orders/:id/status', () => {

  it('debe actualizar el estado de la orden', async () => {
    if (!createdOrderId) {
      console.warn('Saltando: no hay orden creada')
      return
    }

    const res = await request(app)
      .patch(`/api/orders/${createdOrderId}/status`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        status: 'DIAGNOSING',
        comment: 'Iniciando diagnóstico - test',
      })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.status).toBe('DIAGNOSING')
  }, 10000)

})