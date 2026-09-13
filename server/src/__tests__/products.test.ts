import request from 'supertest'
import app from '../app'
import prisma from '../lib/prisma'
import { authorize } from '../middleware/auth.middleware'

let adminToken: string
let productId: string
let createdProductId: string

beforeAll(async () => {
  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({ email: 'admin@reptel.com', password: 'RepTel2024*' })
  adminToken = loginRes.body.data.token

  const listRes = await request(app)
    .get('/api/products')
    .set('Authorization', `Bearer ${adminToken}`)
  productId = listRes.body.data?.[0]?.id
}, 20000)

afterAll(async () => {
  if (createdProductId) {
    await prisma.inventoryMovement.deleteMany({ where: { productId: createdProductId } }).catch(() => {})
    await prisma.product.delete({ where: { id: createdProductId } }).catch(() => {})
  }
})

describe('Products — GET / y GET /categories protegidos por rol', () => {
  it('GET /api/products sin token debe retornar 401', async () => {
    const res = await request(app).get('/api/products')
    expect(res.status).toBe(401)
  })

  it('GET /api/products con token ADMIN debe retornar 200 y un arreglo', async () => {
    const res = await request(app)
      .get('/api/products')
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.data)).toBe(true)
  }, 10000)

  it('GET /api/products/categories sin token debe retornar 401', async () => {
    const res = await request(app).get('/api/products/categories')
    expect(res.status).toBe(401)
  })

  it('GET /api/products/categories con token ADMIN debe retornar 200 y un arreglo', async () => {
    const res = await request(app)
      .get('/api/products/categories')
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.data)).toBe(true)
  }, 10000)
})

describe('Products — GET /admin protegido por rol', () => {
  it('GET /api/products/admin sin token debe retornar 401', async () => {
    const res = await request(app).get('/api/products/admin')
    expect(res.status).toBe(401)
  })

  it('GET /api/products/admin con token ADMIN debe retornar 200 y un arreglo', async () => {
    const res = await request(app)
      .get('/api/products/admin')
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.data)).toBe(true)
  }, 10000)
})

describe('Products — GET /:id protegido por rol', () => {
  it('GET /api/products/:id sin token debe retornar 401', async () => {
    if (!productId) return
    const res = await request(app).get(`/api/products/${productId}`)
    expect(res.status).toBe(401)
  })

  it('GET /api/products/:id con token ADMIN debe retornar el producto', async () => {
    if (!productId) return
    const res = await request(app)
      .get(`/api/products/${productId}`)
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
    expect(res.body.data.id).toBe(productId)
  }, 10000)
})

describe('Products — POST / crear producto (admin)', () => {
  it('POST sin token debe retornar 401', async () => {
    const res = await request(app).post('/api/products').send({ name: 'x', price: 1, categoryId: 'x' })
    expect(res.status).toBe(401)
  })

  it('POST con precio negativo debe retornar 400', async () => {
    const categoriesRes = await request(app)
      .get('/api/products/categories')
      .set('Authorization', `Bearer ${adminToken}`)
    const categoryId = categoriesRes.body.data?.[0]?.id
    if (!categoryId) return
    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Producto de prueba', price: -5, categoryId })
    expect(res.status).toBe(400)
  }, 10000)

  it('POST con datos validos debe crear el producto (201)', async () => {
    const categoriesRes = await request(app)
      .get('/api/products/categories')
      .set('Authorization', `Bearer ${adminToken}`)
    const categoryId = categoriesRes.body.data?.[0]?.id
    if (!categoryId) return
    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Producto de prueba SDD', price: 9.99, categoryId, stock: 5 })
    expect(res.status).toBe(201)
    expect(res.body.data.name).toBe('Producto de prueba SDD')
    createdProductId = res.body.data.id
  }, 10000)
})

describe('Products — PUT /:id editar producto (admin)', () => {
  it('PUT sin token debe retornar 401', async () => {
    if (!createdProductId) return
    const res = await request(app).put(`/api/products/${createdProductId}`).send({ price: 15 })
    expect(res.status).toBe(401)
  })

  it('PUT con token ADMIN debe permitir editar y desactivar (200)', async () => {
    if (!createdProductId) return
    const res = await request(app)
      .put(`/api/products/${createdProductId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ price: 15, isActive: false })
    expect(res.status).toBe(200)
    expect(res.body.data.isActive).toBe(false)
  }, 10000)

  it('el producto desactivado no debe aparecer en GET /api/products (staff)', async () => {
    if (!createdProductId) return
    const res = await request(app)
      .get('/api/products')
      .set('Authorization', `Bearer ${adminToken}`)
    const found = res.body.data.find((p: any) => p.id === createdProductId)
    expect(found).toBeUndefined()
  })

  it('el producto desactivado SI debe aparecer en GET /api/products/admin', async () => {
    if (!createdProductId) return
    const res = await request(app)
      .get('/api/products/admin')
      .set('Authorization', `Bearer ${adminToken}`)
    const found = res.body.data.find((p: any) => p.id === createdProductId)
    expect(found).toBeDefined()
  }, 10000)

  // El producto desactivado en las pruebas anteriores conserva su stock inicial (5)
  // — es el caso real de un producto descontinuado que aún tiene stock residual y
  // debe poder seleccionarse para registrar una merma (Task 6 del plan).
  it('el producto desactivado con stock > 0 SI debe aparecer en GET /api/products?includeInactive=true', async () => {
    if (!createdProductId) return
    const res = await request(app)
      .get('/api/products')
      .query({ includeInactive: 'true' })
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
    const found = res.body.data.find((p: any) => p.id === createdProductId)
    expect(found).toBeDefined()
    expect(found.stock).toBeGreaterThan(0)
  }, 10000)
})

describe('Products — authorize() rechaza rol CLIENT (unitario, sin credenciales sembradas de CLIENT/TECHNICIAN)', () => {
  // No existe en este proyecto un usuario TECHNICIAN o CLIENT con credenciales
  // reales de Cognito para hacer login vía supertest (solo admin@reptel.com las
  // tiene) — el mismo patrón se usa en catalog.test.ts y clients.test.ts para
  // probar el rechazo de rol sin depender de un login real.
  it('retorna 403 cuando el usuario autenticado tiene rol CLIENT en GET /api/products y GET /api/products/categories', () => {
    const middleware = authorize('ADMIN', 'TECHNICIAN', 'TECHNICIAN_DELIVERY')
    const req: any = { user: { sub: 'x', email: 'cliente@x.com', groups: ['CLIENT'] } }
    const json = jest.fn()
    const res: any = { status: jest.fn(() => ({ json })) }
    const next = jest.fn()

    middleware(req, res, next)

    expect(res.status).toHaveBeenCalledWith(403)
    expect(next).not.toHaveBeenCalled()
  })
})
