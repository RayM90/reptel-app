import prisma from '../lib/prisma'
import { getPaymentSettings, updatePaymentSettings, seedDefaultPaymentSettings } from '../modules/settings/settings.service'

beforeAll(async () => {
  await prisma.businessSettings.deleteMany({})
})

afterAll(async () => {
  await prisma.businessSettings.deleteMany({})
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
