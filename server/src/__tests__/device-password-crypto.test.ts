// Este archivo importa `../lib/devicePasswordCrypto` directamente (no pasa
// por `../app`), así que hay que cargar el .env explícitamente antes del
// import para que DEVICE_PASSWORD_ENC_KEY esté en process.env — igual que
// hace `websocket.test.ts` y `prisma/seed.ts`.
import dotenv from 'dotenv'
dotenv.config()

import { encryptDevicePassword, decryptDevicePassword } from '../lib/devicePasswordCrypto'
import prisma from '../lib/prisma'

describe('devicePasswordCrypto', () => {
  it('cifra y descifra de vuelta al valor original', () => {
    const plain = 'MiClaveSecreta123'
    const cipher = encryptDevicePassword(plain)
    expect(cipher).not.toBe(plain)
    expect(decryptDevicePassword(cipher)).toBe(plain)
  })

  it('genera un cifrado distinto cada vez (IV aleatorio)', () => {
    const plain = 'MiClaveSecreta123'
    const cipherA = encryptDevicePassword(plain)
    const cipherB = encryptDevicePassword(plain)
    expect(cipherA).not.toBe(cipherB)
  })
})

describe('cifrado transparente en Device.devicePassword (integración)', () => {
  it('guarda cifrado en la BD y lo devuelve descifrado al leer', async () => {
    const device = await prisma.device.create({
      data: { type: 'LAPTOP', brand: 'TestBrand', model: 'X1', devicePassword: 'clave-real-123' },
    })

    try {
      // Verificación funcional: la extensión $extends descifra de forma
      // transparente al leer con el cliente extendido.
      const readBack = await prisma.device.findUnique({ where: { id: device.id } })
      expect(readBack?.devicePassword).toBe('clave-real-123')

      // Verificación de que NO queda en texto plano en la BD: $queryRaw
      // no pasa por la parte `result` de la extensión (esa solo aplica a
      // los métodos tipados del modelo), así que aquí vemos la fila cruda.
      const rows = await prisma.$queryRaw<Array<{ devicePassword: string | null }>>`
        SELECT devicePassword FROM Device WHERE id = ${device.id}
      `
      const rawValue = rows[0]?.devicePassword
      expect(rawValue).not.toBe('clave-real-123')
      expect(rawValue).toMatch(/^[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$/)
      expect(decryptDevicePassword(rawValue as string)).toBe('clave-real-123')
    } finally {
      await prisma.device.delete({ where: { id: device.id } })
    }
  })

  it('no falla al leer una fila vieja con devicePassword en texto plano (sin separador)', async () => {
    const device = await prisma.device.create({
      data: { type: 'LAPTOP', brand: 'TestBrand', model: 'X1' },
    })

    try {
      // Simula una fila anterior a esta migración, escrita directamente
      // en texto plano sin pasar por la extensión de cifrado.
      await prisma.$executeRaw`
        UPDATE Device SET devicePassword = ${'password-viejo-en-texto-plano'} WHERE id = ${device.id}
      `

      const readBack = await prisma.device.findUnique({ where: { id: device.id } })
      expect(readBack?.devicePassword).toBe('password-viejo-en-texto-plano')
    } finally {
      await prisma.device.delete({ where: { id: device.id } })
    }
  })
})
