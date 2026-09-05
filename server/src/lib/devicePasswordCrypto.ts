import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

// AES-256-GCM: la contraseña del equipo del cliente (Device.devicePassword)
// se guardaba en texto plano — hallazgo de auditoría. Se cifra aquí antes
// de tocar la base de datos; el IV va al frente del texto cifrado porque
// debe ser distinto en cada llamada (nunca reusar IV con la misma clave).
const ALGORITHM = 'aes-256-gcm'

function getKey(): Buffer {
  const hex = process.env.DEVICE_PASSWORD_ENC_KEY
  if (!hex || hex.length !== 64) {
    throw new Error('DEVICE_PASSWORD_ENC_KEY debe estar definida (32 bytes en hex, 64 caracteres)')
  }
  return Buffer.from(hex, 'hex')
}

export function encryptDevicePassword(plain: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv(ALGORITHM, getKey(), iv)
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return [iv.toString('hex'), authTag.toString('hex'), encrypted.toString('hex')].join(':')
}

export function decryptDevicePassword(payload: string): string {
  const [ivHex, authTagHex, dataHex] = payload.split(':')
  if (!ivHex || !authTagHex || !dataHex) {
    throw new Error('Formato de devicePassword cifrado inválido')
  }
  const decipher = createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivHex, 'hex'))
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'))
  const decrypted = Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()])
  return decrypted.toString('utf8')
}
