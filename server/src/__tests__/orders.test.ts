import request from 'supertest'
import app from '../app'
import prisma from '../lib/prisma'

let authToken: string
let createdOrderId: string
let clientId: string
let deviceId: string
let existingOrderNumber: string

beforeAll(async () => {
  // Obtener token de admin
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: 'admin@reptel.com', password: 'RepTel2024*' })
  authToken = res.body.data.token

  // Obtener un cliente real (Client, no User) para crear órdenes de prueba
  const clientsRes = await request(app)
    .get('/api/clients')
    .set('Authorization', `Bearer ${authToken}`)
  const clients = clientsRes.body.data || []
  clientId = clients[0]?.id

  // Obtener dispositivos
  const devicesRes = await request(app)
    .get('/api/devices')
    .set('Authorization', `Bearer ${authToken}`)
  const devices = devicesRes.body.data || []
  deviceId = devices[0]?.id

  // Obtener un número de orden real existente para el test de tracking
  const ordersRes = await request(app)
    .get('/api/orders')
    .set('Authorization', `Bearer ${authToken}`)
  const orders = ordersRes.body.data || []
  existingOrderNumber = orders[0]?.orderNumber

  console.log('clientId:', clientId)
  console.log('deviceId:', deviceId)
  console.log('existingOrderNumber:', existingOrderNumber)
}, 20000)

// ── GET /api/orders ────────────────────────────────────────────────────────
describe('Orders — GET /api/orders', () => {

  it('debe retornar 200 y lista de órdenes', async () => {
    const res = await request(app)
      .get('/api/orders')
      .set('Authorization', `Bearer ${authToken}`)

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(Array.isArray(res.body.data)).toBe(true)
  }, 10000)

})

// ── GET /api/orders/track/:orderNumber ────────────────────────────────────
describe('Orders — GET /api/orders/track/:orderNumber', () => {

  it('debe retornar 200 con número de orden válido', async () => {
    if (!existingOrderNumber) {
      console.warn('Saltando: no hay ninguna orden existente para probar tracking')
      return
    }

    const res = await request(app)
      .get(`/api/orders/track/${existingOrderNumber}`)

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

// ── GET /api/orders/track/:orderNumber — no debe exponer PII/contraseña ──
// Usa fixtures propios (no depende de que ya existan clientes/dispositivos/
// órdenes en la BD de pruebas — el describe de arriba sí depende de eso y
// se salta si está vacía, lo cual dejaría estos dos tests sin probar nada).
describe('Orders — GET /api/orders/track/:orderNumber — no debe exponer PII', () => {
  let piiTestClient: { id: string }
  let piiTestDevice: { id: string }
  let piiTestOrderNumber: string

  beforeAll(async () => {
    const suffix = Date.now()

    piiTestClient = await prisma.client.create({
      data: {
        name: 'Cliente',
        lastName: 'Prueba Tracking',
        idNumber: `TEST-TRACK-${suffix}`,
        phone: '04120000000',
        email: `cliente-track-${suffix}@test.com`,
        password: '',
      },
    })

    piiTestDevice = await prisma.device.create({
      data: {
        type: 'LAPTOP',
        brand: 'TestBrand',
        model: 'X1',
        devicePassword: 'secreto123',
      },
    })

    piiTestOrderNumber = `TEST-TRACK-ORDER-${suffix}`
    await prisma.order.create({
      data: {
        orderNumber: piiTestOrderNumber,
        clientId: piiTestClient.id,
        deviceId: piiTestDevice.id,
        problem: 'Prueba automatizada — exposición de PII en tracking',
      },
    })
  }, 20000)

  afterAll(async () => {
    await prisma.order.deleteMany({ where: { orderNumber: piiTestOrderNumber } })
    await prisma.device.delete({ where: { id: piiTestDevice.id } }).catch(() => {})
    await prisma.client.delete({ where: { id: piiTestClient.id } }).catch(() => {})
  })

  it('no debe exponer teléfono ni apellido del cliente', async () => {
    const res = await request(app)
      .get(`/api/orders/track/${piiTestOrderNumber}`)

    expect(res.status).toBe(200)
    expect(res.body.data.client).not.toHaveProperty('phone')
    expect(res.body.data.client).not.toHaveProperty('lastName')
  }, 10000)

  it('no debe exponer la contraseña del equipo', async () => {
    const res = await request(app)
      .get(`/api/orders/track/${piiTestOrderNumber}`)

    expect(res.status).toBe(200)
    expect(res.body.data.device).not.toHaveProperty('devicePassword')
  }, 10000)

})

// ── GET /api/orders/track/:orderNumber — límite de solicitudes ───────────
describe('Orders — GET /api/orders/track/:orderNumber — rate limiting', () => {

  it('debe retornar 429 tras exceder el límite de solicitudes', async () => {
    const responses = await Promise.all(
      Array.from({ length: 25 }, () =>
        request(app).get('/api/orders/track/REP-000000-0000')
      )
    )

    const tooManyRequests = responses.filter((res) => res.status === 429)
    expect(tooManyRequests.length).toBeGreaterThan(0)
  }, 20000)

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
