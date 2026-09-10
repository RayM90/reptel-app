import request from 'supertest'
import app from '../app'
import prisma from '../lib/prisma'

describe('Auth — POST /api/auth/login', () => {

  it('debe retornar 200 y token con credenciales válidas', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'admin@reptel.com',
        password: 'RepTel2024*',
      })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data).toHaveProperty('token')
    expect(res.body.data).toHaveProperty('user')
    expect(res.body.data.user.role).toBe('ADMIN')
  }, 15000)

  it('debe retornar 401 con credenciales incorrectas', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'admin@reptel.com',
        password: 'contraseña_incorrecta',
      })

    expect(res.status).toBe(401)
    expect(res.body).toHaveProperty('message')
  }, 15000)

  it('debe retornar 400 si faltan campos', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'admin@reptel.com',
      })

    expect(res.status).toBe(400)
    expect(res.body).toHaveProperty('message')
  })

})

describe('Auth — POST /api/auth/staff', () => {
  let authToken: string
  let existingStaffUserId: string
  const existingIdNumber = `V-${String(Date.now()).slice(-7)}`

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@reptel.com', password: 'RepTel2024*' })
    authToken = res.body.data.token

    const existing = await prisma.user.create({
      data: {
        email: `staff-fixture-${Date.now()}@reptel.com`,
        name: 'Fixture',
        lastName: 'Existente',
        idNumber: existingIdNumber,
        role: 'TECHNICIAN',
        password: 'no-usado-cognito',
      },
    })
    existingStaffUserId = existing.id
  }, 20000)

  afterAll(async () => {
    await prisma.user.delete({ where: { id: existingStaffUserId } }).catch(() => {})
  })

  it('retorna 400 si faltan campos (lastName/idNumber)', async () => {
    const res = await request(app)
      .post('/api/auth/staff')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ email: 'nuevo@reptel.com', password: 'Passw0rd!', name: 'Nuevo', role: 'TECHNICIAN' })

    expect(res.status).toBe(400)
    expect(res.body).toHaveProperty('message')
  })

  it('retorna 400 si la cédula no tiene formato V/E-dígitos', async () => {
    const res = await request(app)
      .post('/api/auth/staff')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        email: 'formato-invalido@reptel.com',
        password: 'Passw0rd!',
        name: 'Test',
        lastName: 'Formato',
        idNumber: '12345678',
        role: 'TECHNICIAN',
      })

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/cédula/i)
  })

  it('retorna 400 si la cédula ya pertenece a otro empleado (sin llegar a Cognito)', async () => {
    const res = await request(app)
      .post('/api/auth/staff')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        email: 'otro-nuevo@reptel.com',
        password: 'Passw0rd!',
        name: 'Otro',
        lastName: 'Nuevo',
        idNumber: existingIdNumber,
        role: 'TECHNICIAN',
      })

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/cédula/i)
  })
})