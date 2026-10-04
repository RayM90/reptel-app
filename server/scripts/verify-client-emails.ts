// Marca como verificado el correo de todos los clientes de la app en Cognito,
// para que puedan recuperar su clave con un código por correo. Se corre una
// sola vez:
//   npx ts-node scripts/verify-client-emails.ts
import 'dotenv/config'
import prisma from '../src/lib/prisma'
import { markEmailVerified } from '../src/modules/auth/auth.service'

;(async () => {
  const clients = await prisma.user.findMany({ where: { role: 'CLIENT' }, select: { email: true } })
  let ok = 0
  for (const { email } of clients) {
    try {
      await markEmailVerified(email)
      ok++
    } catch (e: any) {
      console.log('omitido', email, e?.name)
    }
  }
  console.log(`Verificados ${ok} de ${clients.length}`)
  await prisma.$disconnect()
})()
