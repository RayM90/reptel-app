import prisma from '../lib/prisma'
import { updateClient } from '../modules/clients/clients.service'

let client: { id: string }
let user: { id: string }

beforeAll(async () => {
  const suffix = Date.now()
  client = await prisma.client.create({
    data: { name: 'Nombre Viejo', lastName: 'Sync', idNumber: `TEST-SYNC-${suffix}`, phone: '0000000000', email: `sync-${suffix}@test.com`, password: '' },
  })
  user = await prisma.user.create({
    data: { name: 'Nombre Viejo', email: `sync-${suffix}@test.com`, phone: '0000000000', role: 'CLIENT', password: 'COGNITO_MANAGED', clientId: client.id },
  })
}, 20000)

afterAll(async () => {
  await prisma.user.delete({ where: { id: user.id } }).catch(() => {})
  await prisma.client.delete({ where: { id: client.id } }).catch(() => {})
})

describe('clients.service — sincronización con User vinculado', () => {
  it('actualiza name/phone en el User vinculado cuando se edita el Client', async () => {
    await updateClient(client.id, { name: 'Nombre Nuevo', phone: '04141111111' })

    const updatedUser = await prisma.user.findUnique({ where: { id: user.id } })
    expect(updatedUser?.name).toBe('Nombre Nuevo')
    expect(updatedUser?.phone).toBe('04141111111')
  })
})
