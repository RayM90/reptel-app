import request from 'supertest'
import app from '../app'
import prisma from '../lib/prisma'
import * as authService from '../modules/auth/auth.service'

describe('Auth — recuperación de clave por correo', () => {
  const clientEmail = `forgot-${Date.now()}@reptel-test.com`
  let userId: string
  let sendSpy: jest.SpyInstance
  let confirmSpy: jest.SpyInstance

  beforeAll(async () => {
    const u = await prisma.user.create({ data: { email: clientEmail, name: 'Olvido', role: 'CLIENT', password: '' } })
    userId = u.id
  })

  afterAll(async () => {
    await prisma.passwordResetRequest.deleteMany({ where: { email: clientEmail } })
    await prisma.user.delete({ where: { id: userId } }).catch(() => {})
  })

  beforeEach(() => {
    sendSpy = jest.spyOn(authService, 'sendForgotPasswordCode').mockResolvedValue(undefined)
    confirmSpy = jest.spyOn(authService, 'confirmForgotPassword').mockResolvedValue(undefined)
  })

  afterEach(() => jest.restoreAllMocks())

  it('envía el código si el correo es de un cliente', async () => {
    const res = await request(app).post('/api/auth/forgot-password').send({ email: clientEmail })
    expect(res.status).toBe(200)
    expect(sendSpy).toHaveBeenCalledWith(clientEmail)
  })

  it('no envía nada a un trabajador ni a un correo inexistente, con la misma respuesta', async () => {
    const a = await request(app).post('/api/auth/forgot-password').send({ email: 'admin@reptel.com' })
    const b = await request(app).post('/api/auth/forgot-password').send({ email: 'nadie-xyz@reptel-test.com' })
    expect(a.status).toBe(200)
    expect(b.body.message).toBe(a.body.message)
    expect(sendSpy).not.toHaveBeenCalled()
  })

  it('confirma el código y la nueva clave', async () => {
    const res = await request(app)
      .post('/api/auth/confirm-forgot-password')
      .send({ email: clientEmail, code: '123456', newPassword: 'Nueva.1234' })
    expect(res.status).toBe(200)
    expect(confirmSpy).toHaveBeenCalledWith(clientEmail, '123456', 'Nueva.1234')
  })

  it('traduce un código inválido', async () => {
    confirmSpy.mockRejectedValueOnce(Object.assign(new Error('Invalid code'), { name: 'CodeMismatchException' }))
    const res = await request(app)
      .post('/api/auth/confirm-forgot-password')
      .send({ email: clientEmail, code: '000000', newPassword: 'Nueva.1234' })
    expect(res.status).toBe(400)
    expect(res.body.message).toBe('El código ingresado no es válido')
  })

  it('request-password-reset de un cliente no crea solicitud para el administrador', async () => {
    await request(app).post('/api/auth/request-password-reset').send({ email: clientEmail })
    expect(await prisma.passwordResetRequest.count({ where: { email: clientEmail } })).toBe(0)
  })
})
