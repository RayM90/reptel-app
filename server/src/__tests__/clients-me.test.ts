import request from 'supertest'
import app from '../app'
import prisma from '../lib/prisma'
import { updateOwnProfile } from '../modules/clients/clients.service'
import { validateOwnProfile } from '../modules/clients/clients.controller'

const full = {
  addressState: 'Lara',
  addressCity: 'Barquisimeto',
  addressNeighborhood: 'Centro',
  addressStreet: 'Calle 1',
  addressBuilding: 'Casa 2',
}

describe('Clients — /api/clients/me', () => {
  let adminToken: string
  let clientId: string
  const email = `me-${Date.now()}@reptel-test.com`

  beforeAll(async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'admin@reptel.com', password: 'RepTel2024*' })
    adminToken = res.body.data.token
    const c = await prisma.client.create({
      data: {
        name: 'Ana',
        lastName: 'Viejo',
        idNumber: `V-${String(Date.now()).slice(-8)}`,
        phone: '04121234567',
        email,
        addresses: { create: [{ label: 'Principal', isPrimary: true, ...full }] },
      },
    })
    clientId = c.id
    await prisma.user.create({
      data: { email, name: 'Ana', lastName: 'Viejo', role: 'CLIENT', phone: '04121234567', password: '', clientId },
    })
  }, 20000)

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { clientId } })
    await prisma.clientAddress.deleteMany({ where: { clientId } })
    await prisma.client.delete({ where: { id: clientId } }).catch(() => {})
  })

  it('GET /me con un usuario que no es CLIENT → 403', async () => {
    const res = await request(app).get('/api/clients/me').set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(403)
  })

  it('updateOwnProfile cambia nombre, apellido, teléfono y dirección, y sincroniza el User', async () => {
    const updated = await updateOwnProfile(clientId, {
      name: 'Ana María',
      lastName: 'Nuevo',
      phone: '04145556677',
      ...full,
      addressCity: 'Cabudare',
    })
    expect(updated?.name).toBe('Ana María')
    expect(updated?.addresses.find((a) => a.isPrimary)?.addressCity).toBe('Cabudare')
    const user = await prisma.user.findUnique({ where: { clientId } })
    expect(user).toMatchObject({ name: 'Ana María', lastName: 'Nuevo', phone: '04145556677', email })
  })

  it('updateOwnProfile crea, actualiza y quita la segunda dirección', async () => {
    const base = { name: 'Ana', lastName: 'X', phone: '04121234567', ...full }
    let c = await updateOwnProfile(clientId, { ...base, secondaryAddress: { label: 'Trabajo', ...full } })
    expect(c?.addresses.filter((a) => !a.isPrimary)).toHaveLength(1)
    c = await updateOwnProfile(clientId, { ...base, secondaryAddress: { label: 'Casa', ...full, addressStreet: 'Calle 9' } })
    expect(c?.addresses.find((a) => !a.isPrimary)).toMatchObject({ label: 'Casa', addressStreet: 'Calle 9' })
    c = await updateOwnProfile(clientId, { ...base, secondaryAddress: null })
    expect(c?.addresses.filter((a) => !a.isPrimary)).toHaveLength(0)
  })
})

describe('validateOwnProfile', () => {
  const ok = { name: 'Ana', lastName: 'B', phone: '04121234567', ...full }
  it('acepta datos completos', () => expect(validateOwnProfile(ok, 'V-12345678')).toBeNull())
  it('exige apellido a V/E', () => expect(validateOwnProfile({ ...ok, lastName: '' }, 'V-12345678')).toMatch(/apellido/i))
  it('no exige apellido a J/G', () => expect(validateOwnProfile({ ...ok, lastName: '' }, 'J-123456789')).toBeNull())
  it('rechaza teléfono inválido', () => expect(validateOwnProfile({ ...ok, phone: '123' }, 'V-12345678')).toMatch(/teléfono/i))
  it('rechaza dirección incompleta', () =>
    expect(validateOwnProfile({ ...ok, addressStreet: '' }, 'V-12345678')).toMatch(/dirección/i))
  it('rechaza segunda dirección incompleta', () =>
    expect(validateOwnProfile({ ...ok, secondaryAddress: { label: 'Casa', ...full, addressBuilding: '' } }, 'V-12345678')).toMatch(/segunda/i))
})
