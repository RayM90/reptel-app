import prisma from '../lib/prisma'
import { getPaymentSettings, updatePaymentSettings, seedDefaultPaymentSettings } from '../modules/settings/settings.service'

// El módulo de settings solo maneja una fila de BusinessSettings (findFirst/create).
// En producción esa fila contiene los datos de pago reales de la tienda, así que
// en vez de `deleteMany({})` (que borraría la única fila real) guardamos un
// snapshot de lo que exista antes de correr los tests y lo restauramos al final.
let originalSettings: Awaited<ReturnType<typeof prisma.businessSettings.findFirst>> = null

beforeAll(async () => {
  originalSettings = await prisma.businessSettings.findFirst()
  if (originalSettings) {
    await prisma.businessSettings.delete({ where: { id: originalSettings.id } })
  }
})

afterAll(async () => {
  // Limpia cualquier fila que hayan dejado los tests.
  await prisma.businessSettings.deleteMany({})

  if (originalSettings) {
    const { id, updatedAt, ...data } = originalSettings
    await prisma.businessSettings.create({ data: { id, ...data } })
  }
})

describe('settings.service — BusinessSettings', () => {
  it('seedDefaultPaymentSettings crea la fila si no existe', async () => {
    const settings = await seedDefaultPaymentSettings()
    expect(settings.pagoMovilBanco).toBe('Banesco')
  })

  it('getPaymentSettings devuelve la fila existente', async () => {
    const settings = await getPaymentSettings()
    expect(settings?.pagoMovilTelefono).toBe('0414-1234567')
  })

  it('updatePaymentSettings actualiza los campos', async () => {
    const updated = await updatePaymentSettings({ pagoMovilBanco: 'Mercantil' })
    expect(updated.pagoMovilBanco).toBe('Mercantil')
  })
})
