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

  it('hace rollback de ambas escrituras si falla el update del User (e.g., email @unique conflict)', async () => {
    // Arrange: crea un User independiente con un email específico
    const suffix = Date.now()
    const conflictEmail = `conflict-${suffix}@test.com`
    const userB = await prisma.user.create({
      data: {
        name: 'User B',
        email: conflictEmail,
        phone: '0000000000',
        role: 'CLIENT',
        password: 'COGNITO_MANAGED',
      },
    })

    const originalClientEmail = client.id // lo obtenemos después para comparar
    const clientBefore = await prisma.client.findUnique({ where: { id: client.id } })
    const originalEmail = clientBefore?.email

    // Act: intenta actualizar el Client con el email del User B (debe fallar por @unique)
    let updateFailed = false
    try {
      await updateClient(client.id, { email: conflictEmail })
    } catch (error) {
      updateFailed = true
      // Esperamos que Prisma lance un error P2002 (unique constraint violation)
      expect((error as any)?.code || (error as any)?.message).toBeDefined()
    }

    // Assert: verifica que la transacción hizo rollback completo
    expect(updateFailed).toBe(true)
    const clientAfter = await prisma.client.findUnique({ where: { id: client.id } })
    expect(clientAfter?.email).toBe(originalEmail) // email debe ser el original, no conflictEmail

    // Cleanup
    await prisma.user.delete({ where: { id: userB.id } }).catch(() => {})
  })
})
