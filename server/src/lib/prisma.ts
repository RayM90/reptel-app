import { PrismaClient } from '@prisma/client'
import { encryptDevicePassword, decryptDevicePassword } from './devicePasswordCrypto'

const prisma = new PrismaClient()

// Device.devicePassword (la contraseña real del equipo del cliente) se
// guardaba en texto plano en MySQL — hallazgo de auditoría. Esta extensión
// de Prisma Client cifra el valor antes de escribirlo (create/update) y lo
// descifra de forma transparente al leerlo, para que devices.service.ts y
// orders.service.ts no tengan que cambiar una sola línea.
const extendedPrisma = prisma.$extends({
  query: {
    device: {
      async create({ args, query }) {
        if (args.data && typeof (args.data as any).devicePassword === 'string' && (args.data as any).devicePassword) {
          ;(args.data as any).devicePassword = encryptDevicePassword((args.data as any).devicePassword)
        }
        return query(args)
      },
      async update({ args, query }) {
        if (args.data && typeof (args.data as any).devicePassword === 'string' && (args.data as any).devicePassword) {
          ;(args.data as any).devicePassword = encryptDevicePassword((args.data as any).devicePassword)
        }
        return query(args)
      },
    },
  },
  result: {
    device: {
      devicePassword: {
        needs: { devicePassword: true },
        compute(device) {
          if (!device.devicePassword) return device.devicePassword
          try {
            return decryptDevicePassword(device.devicePassword)
          } catch {
            // Filas anteriores a esta migración quedan en texto plano —
            // se devuelven tal cual en vez de fallar toda la consulta.
            return device.devicePassword
          }
        },
      },
    },
  },
})

// Tipo del cliente de transacción (`prisma.$transaction(async (tx) => ...)`)
// derivado del cliente YA extendido. `$extends` cambia la forma del tipo de
// PrismaClient, así que un `tx: Prisma.TransactionClient` (tipo base, sin
// extender) deja de ser asignable — cualquier función auxiliar que reciba
// `tx` debe tiparse con esto en vez de `Prisma.TransactionClient`.
export type ExtendedTransactionClient = Parameters<
  Parameters<typeof extendedPrisma.$transaction>[0]
>[0]

export default extendedPrisma