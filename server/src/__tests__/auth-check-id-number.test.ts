import request from 'supertest'
import app from '../app'
import prisma from '../lib/prisma'

describe('Auth — GET /api/auth/check-id-number', () => {
  const takenIdNumber = `V-${String(Date.now()).slice(-8)}`
  let clientId: string

  beforeAll(async () => {
    const c = await prisma.client.create({
      data: { name: 'Cedula', lastName: 'Tomada', idNumber: takenIdNumber, phone: '04121234567' },
    })
    clientId = c.id
  })

  afterAll(async () => {
    await prisma.client.delete({ where: { id: clientId } }).catch(() => {})
  })

  it('devuelve available: false si la cédula ya tiene cliente', async () => {
    const res = await request(app).get(`/api/auth/check-id-number?idNumber=${takenIdNumber}`)
    expect(res.status).toBe(200)
    expect(res.body.data).toEqual({ available: false })
  })

  it('devuelve available: true si la cédula está libre (sin datos del cliente)', async () => {
    const res = await request(app).get('/api/auth/check-id-number?idNumber=V-99999991')
    expect(res.status).toBe(200)
    expect(res.body.data).toEqual({ available: true })
  })

  it('devuelve 400 si la cédula no tiene formato válido', async () => {
    const res = await request(app).get('/api/auth/check-id-number?idNumber=12345')
    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/cédula/i)
  })
})
