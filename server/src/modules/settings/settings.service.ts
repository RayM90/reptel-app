import prisma from '../../lib/prisma'

// Valores iniciales: los mismos que estaban hardcodeados en 4 archivos del
// frontend (advance-payment.tsx, checkout.tsx, final-payment.tsx,
// link-checkout.tsx) — se migran aquí para que el ADMIN los edite en un
// solo lugar sin recompilar la app.
const DEFAULTS = {
  pagoMovilBanco: 'Banesco',
  pagoMovilTelefono: '0414-1234567',
  pagoMovilCedula: 'V-12345678',
  transferenciaBanco: 'Banesco',
  transferenciaCuenta: '0134-0000-00-0000000000',
  transferenciaRif: 'J-12345678-9',
  binanceId: 'reptel@correo.com',
  binanceRed: 'BEP20 (USDT)',
}

export const seedDefaultPaymentSettings = async () => {
  const existing = await prisma.businessSettings.findFirst()
  if (existing) return existing
  return prisma.businessSettings.create({ data: DEFAULTS })
}

export const getPaymentSettings = async () => {
  const existing = await prisma.businessSettings.findFirst()
  if (existing) return existing
  return seedDefaultPaymentSettings()
}

export const updatePaymentSettings = async (data: Partial<typeof DEFAULTS>) => {
  const existing = await getPaymentSettings()
  return prisma.businessSettings.update({ where: { id: existing.id }, data })
}
