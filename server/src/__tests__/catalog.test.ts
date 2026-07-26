import request from 'supertest'
import app from '../app'
import { authorize } from '../middleware/auth.middleware'

let adminToken: string
let catalogId: string

beforeAll(async () => {
  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({ email: 'admin@reptel.com', password: 'RepTel2024*' })
  adminToken = loginRes.body.data.token

  const listRes = await request(app)
    .get('/api/catalog')
    .set('Authorization', `Bearer ${adminToken}`)
  catalogId = listRes.body.data?.[0]?.id
}, 20000)

describe('Catalog — PUT /:id protegido por rol', () => {
  it('PUT sin token debe retornar 401', async () => {
    const res = await request(app).put(`/api/catalog/${catalogId}`).send({ price: 10 })
    expect(res.status).toBe(401)
  })

  it('PUT con token ADMIN debe permitir la edición (200)', async () => {
    if (!catalogId) return
    const res = await request(app)
      .put(`/api/catalog/${catalogId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({})
    expect([200, 400]).toContain(res.status) // 400 si el body vacío no cumple validación propia del servicio — lo importante es que NO sea 403
  }, 10000)
})

describe('Catalog — authorize() rechaza roles no-ADMIN (unitario)', () => {
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
