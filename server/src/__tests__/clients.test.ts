import request from 'supertest'
import app from '../app'
import { authorize } from '../middleware/auth.middleware'

let adminToken: string

beforeAll(async () => {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: 'admin@reptel.com', password: 'RepTel2024*' })
  adminToken = res.body.data.token
}, 20000)

describe('Clients — protección de rutas', () => {
  it('GET /api/clients sin token debe retornar 401', async () => {
    const res = await request(app).get('/api/clients')
    expect(res.status).toBe(401)
  })

  it('GET /api/clients/search sin token debe retornar 401', async () => {
    const res = await request(app).get('/api/clients/search?q=test')
    expect(res.status).toBe(401)
  })

  it('POST /api/clients sin token debe retornar 401', async () => {
    const res = await request(app).post('/api/clients').send({})
    expect(res.status).toBe(401)
  })

  it('GET /api/clients con token ADMIN debe retornar 200', async () => {
    const res = await request(app)
      .get('/api/clients')
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
  }, 10000)
})

describe('Clients — authorize() rechaza roles no-ADMIN (unitario, sin depender de un usuario CLIENT sembrado)', () => {
  it('retorna 403 cuando el usuario no tiene el rol ADMIN', () => {
    const middleware = authorize('ADMIN')
    const req: any = { user: { sub: 'x', email: 'x@x.com', groups: ['CLIENT'] } }
    const json = jest.fn()
    const res: any = { status: jest.fn(() => ({ json })) }
    const next = jest.fn()

    middleware(req, res, next)

    expect(res.status).toHaveBeenCalledWith(403)
    expect(next).not.toHaveBeenCalled()
  })
})
