import request from 'supertest'
import app from '../app'

let adminToken: string
let productId: string

beforeAll(async () => {
  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({ email: 'admin@reptel.com', password: 'RepTel2024*' })
  adminToken = loginRes.body.data.token

  const listRes = await request(app).get('/api/products')
  productId = listRes.body.data?.[0]?.id
}, 20000)

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
