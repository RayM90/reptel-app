import request from 'supertest'
import app from '../app'
import prisma from '../lib/prisma'

let adminToken: string
let productId: string
let createdProductId: string

beforeAll(async () => {
  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({ email: 'admin@reptel.com', password: 'RepTel2024*' })
  adminToken = loginRes.body.data.token

  const listRes = await request(app).get('/api/products')
  productId = listRes.body.data?.[0]?.id
}, 20000)

afterAll(async () => {
  if (createdProductId) {
    await prisma.product.delete({ where: { id: createdProductId } }).catch(() => {})
  }
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
    const categoriesRes = await request(app).get('/api/products/categories')
    const categoryId = categoriesRes.body.data?.[0]?.id
    if (!categoryId) return
    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Producto de prueba', price: -5, categoryId })
    expect(res.status).toBe(400)
  }, 10000)

  it('POST con datos validos debe crear el producto (201)', async () => {
    const categoriesRes = await request(app).get('/api/products/categories')
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

  it('el producto desactivado no debe aparecer en GET /api/products (publico)', async () => {
    if (!createdProductId) return
    const res = await request(app).get('/api/products')
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
})
