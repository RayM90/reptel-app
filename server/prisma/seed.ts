import * as dotenv from 'dotenv'
import { resolve } from 'path'
dotenv.config({ path: resolve(__dirname, '../.env') })
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Poblando catálogo de servicios...')

  await prisma.serviceCatalog.createMany({
    skipDuplicates: true,
    data: [
      {
        name: 'Diagnóstico general',
        description: 'Revisión completa del equipo para identificar la falla. Se descuenta del total si el cliente aprueba la reparación.',
        basePrice: 10.00,
        isOnSiteResolvable: false,
        estimatedMinutes: 30,
      },
      {
        name: 'Lento / se congela',
        description: 'Revisión de rendimiento, limpieza de inicio, optimización del sistema operativo.',
        basePrice: 15.00,
        isOnSiteResolvable: true,
        estimatedMinutes: 60,
      },
      {
        name: 'Sobrecalentamiento',
        description: 'Limpieza interna, cambio de pasta térmica, revisión del ventilador.',
        basePrice: 20.00,
        isOnSiteResolvable: false,
        estimatedMinutes: 90,
      },
      {
        name: 'Pantallazo azul (BSOD)',
        description: 'Diagnóstico de errores críticos de Windows, revisión de drivers y memoria RAM.',
        basePrice: 20.00,
        isOnSiteResolvable: false,
        estimatedMinutes: 60,
      },
      {
        name: 'No conecta a WiFi',
        description: 'Revisión de adaptador de red, drivers y configuración del sistema.',
        basePrice: 15.00,
        isOnSiteResolvable: true,
        estimatedMinutes: 45,
      },
      {
        name: 'Puerto USB / HDMI no funciona',
        description: 'Diagnóstico de puertos. Puede requerir soldadura — evaluación en taller.',
        basePrice: 20.00,
        isOnSiteResolvable: false,
        estimatedMinutes: 60,
      },
      {
        name: 'Batería no carga',
        description: 'Revisión de batería y sistema de carga. Repuesto no incluido.',
        basePrice: 15.00,
        isOnSiteResolvable: false,
        estimatedMinutes: 45,
      },
      {
        name: 'Ruido en el ventilador',
        description: 'Limpieza y lubricación del ventilador. Reemplazo no incluido.',
        basePrice: 15.00,
        isOnSiteResolvable: false,
        estimatedMinutes: 45,
      },
      {
        name: 'Pantalla dañada',
        description: 'Diagnóstico de pantalla. Reemplazo no incluido — se cotiza aparte.',
        basePrice: 10.00,
        isOnSiteResolvable: false,
        estimatedMinutes: 30,
      },
      {
        name: 'Bisagras rotas / carcasa dañada',
        description: 'Reparación con resinas o soldadura plástica. Requiere evaluación en taller.',
        basePrice: 35.00,
        isOnSiteResolvable: false,
        estimatedMinutes: 120,
      },
      {
        name: 'Mantenimiento preventivo',
        description: 'Limpieza interna, cambio de pasta térmica básica, revisión general del equipo.',
        basePrice: 20.00,
        isOnSiteResolvable: false,
        estimatedMinutes: 90,
      },
      {
        name: 'Mantenimiento equipo gaming / diseño',
        description: 'Desarmado completo, limpieza profunda, pasta térmica premium (Noctua / Thermal Grizzly).',
        basePrice: 40.00,
        isOnSiteResolvable: false,
        estimatedMinutes: 150,
      },
      {
        name: 'Formateo / reinstalación de Windows',
        description: 'Formateo completo, instalación limpia de Windows y drivers básicos.',
        basePrice: 20.00,
        isOnSiteResolvable: false,
        estimatedMinutes: 120,
      },
      {
        name: 'Instalación de software / APK',
        description: 'Instalación de programas específicos, emuladores o configuración de sistemas.',
        basePrice: 10.00,
        isOnSiteResolvable: true,
        estimatedMinutes: 30,
      },
      {
        name: 'Licenciamiento / activación',
        description: 'Activación de Windows u Office con licencia original o genérica según preferencia del cliente.',
        basePrice: 10.00,
        isOnSiteResolvable: true,
        estimatedMinutes: 20,
      },
      {
        name: 'Respaldo de datos',
        description: 'Copia de seguridad de archivos. Precio base hasta 100GB — se cotiza extra por volumen adicional.',
        basePrice: 15.00,
        isOnSiteResolvable: false,
        estimatedMinutes: 60,
      },
      {
        name: 'Cambio de componente (teclado, batería, ventilador)',
        description: 'Mano de obra de reemplazo. Repuesto no incluido — se cotiza aparte.',
        basePrice: 15.00,
        isOnSiteResolvable: false,
        estimatedMinutes: 60,
      },
      {
        name: 'Reparación de puertos (USB, HDMI, carga)',
        description: 'Requiere soldadura en placa madre. Solo se realiza en taller.',
        basePrice: 25.00,
        isOnSiteResolvable: false,
        estimatedMinutes: 90,
      },
      {
        name: 'Reballing / reparación de placa madre',
        description: 'Microsoldadura y reparación electrónica a nivel de componentes. Trabajo especializado.',
        basePrice: 60.00,
        isOnSiteResolvable: false,
        estimatedMinutes: 240,
      },
      {
        name: 'Reemplazo de pasta térmica premium',
        description: 'Cambio de pasta térmica de alta gama para equipos gaming o diseño.',
        basePrice: 20.00,
        isOnSiteResolvable: false,
        estimatedMinutes: 60,
      },
      {
        name: 'Otros',
        description: 'Servicio o falla no listada. El técnico evaluará y confirmará el diagnóstico.',
        basePrice: 0.00,
        isOnSiteResolvable: false,
        estimatedMinutes: null,
      },
    ],
  })

  console.log('Catalogo poblado exitosamente.')
}

main()
  .catch((e) => {
    console.error('Error en seed:', e)
    throw e
  })
  .finally(async () => {
    await prisma.$disconnect()
  })