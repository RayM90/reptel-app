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

  console.log('Poblando categorías e inventario de repuestos...')

  const productCategories = [
    'Pantallas',
    'Baterías',
    'Almacenamiento',
    'Memoria RAM',
    'Componentes de placa',
    'Cámaras y micrófonos',
    'Teclados/touchpads internos',
  ]
  await prisma.productCategory.createMany({
    data: productCategories.map((name) => ({ name })),
    skipDuplicates: true,
  })
  const categories = await prisma.productCategory.findMany({
    where: { name: { in: productCategories } },
  })
  const categoryIdByName = new Map(categories.map((c) => [c.name, c.id]))

  const products: Array<{
    name: string
    description: string
    price: number
    stock: number
    minStock: number
    requiresInstallation: boolean
    categoryName: string
  }> = [
    {
      name: 'Pantalla LCD 15.6" (laptop)',
      description:
        'Panel LCD genérico 15.6 pulgadas, conector 30/40 pines, para reemplazo en laptops',
      price: 45,
      stock: 6,
      minStock: 2,
      requiresInstallation: true,
      categoryName: 'Pantallas',
    },
    {
      name: 'Pantalla táctil de celular 5.5"-6.5" (genérica)',
      description:
        'Módulo táctil + LCD genérico compatible con gama media, sin marco',
      price: 28,
      stock: 5,
      minStock: 2,
      requiresInstallation: true,
      categoryName: 'Pantallas',
    },
    {
      name: 'Batería de laptop (universal)',
      description: 'Batería genérica multi-modelo para laptop, ión-litio',
      price: 35,
      stock: 4,
      minStock: 3,
      requiresInstallation: true,
      categoryName: 'Baterías',
    },
    {
      name: 'Pila CMOS (batería de tarjeta madre)',
      description:
        'Pila botón CR2032 para respaldo de BIOS/reloj de la placa madre',
      price: 3,
      stock: 20,
      minStock: 5,
      requiresInstallation: true,
      categoryName: 'Baterías',
    },
    {
      name: 'Disco sólido SSD 500GB SATA III',
      description:
        'Unidad de estado sólido 2.5 pulgadas, interfaz SATA III, reemplazo de disco mecánico',
      price: 38,
      stock: 8,
      minStock: 3,
      requiresInstallation: true,
      categoryName: 'Almacenamiento',
    },
    {
      name: 'Disco duro HDD 1TB SATA',
      description: 'Disco mecánico 2.5 pulgadas para laptop, 5400rpm',
      price: 30,
      stock: 5,
      minStock: 2,
      requiresInstallation: true,
      categoryName: 'Almacenamiento',
    },
    {
      name: 'Memoria RAM DDR4 8GB SODIMM',
      description:
        'Módulo de memoria para laptop, DDR4 2666MHz, formato SODIMM',
      price: 22,
      stock: 10,
      minStock: 3,
      requiresInstallation: true,
      categoryName: 'Memoria RAM',
    },
    {
      name: 'Memoria RAM DDR4 4GB SODIMM',
      description:
        'Módulo de memoria para laptop, DDR4 2666MHz, formato SODIMM',
      price: 14,
      stock: 10,
      minStock: 3,
      requiresInstallation: true,
      categoryName: 'Memoria RAM',
    },
    {
      name: 'Conector de carga (jack de alimentación)',
      description: 'Puerto de carga DC genérico para laptop, requiere soldadura',
      price: 6,
      stock: 12,
      minStock: 4,
      requiresInstallation: true,
      categoryName: 'Componentes de placa',
    },
    {
      name: 'Flex de video/pantalla para laptop',
      description: 'Cable flex que conecta la placa con el panel de pantalla',
      price: 9,
      stock: 8,
      minStock: 3,
      requiresInstallation: true,
      categoryName: 'Componentes de placa',
    },
    {
      name: 'Módulo de cámara web integrada',
      description: 'Cámara interna genérica para laptop, conector estándar',
      price: 7,
      stock: 10,
      minStock: 3,
      requiresInstallation: true,
      categoryName: 'Cámaras y micrófonos',
    },
    {
      name: 'Micrófono interno para laptop',
      description: 'Micrófono integrado genérico, conector estándar',
      price: 5,
      stock: 10,
      minStock: 3,
      requiresInstallation: true,
      categoryName: 'Cámaras y micrófonos',
    },
    {
      name: 'Teclado interno de laptop (español)',
      description:
        'Teclado de reemplazo genérico, distribución español, sin retroiluminación',
      price: 18,
      stock: 8,
      minStock: 3,
      requiresInstallation: true,
      categoryName: 'Teclados/touchpads internos',
    },
    {
      name: 'Touchpad interno de laptop',
      description: 'Panel táctil genérico de reemplazo para laptop',
      price: 12,
      stock: 8,
      minStock: 3,
      requiresInstallation: true,
      categoryName: 'Teclados/touchpads internos',
    },
  ]

  for (const p of products) {
    const categoryId = categoryIdByName.get(p.categoryName)
    if (!categoryId) throw new Error(`Categoría no encontrada: ${p.categoryName}`)
    const existing = await prisma.product.findFirst({ where: { name: p.name } })
    if (existing) continue
    await prisma.product.create({
      data: {
        name: p.name,
        description: p.description,
        price: p.price,
        stock: p.stock,
        minStock: p.minStock,
        requiresInstallation: p.requiresInstallation,
        categoryId,
      },
    })
  }

  console.log('Inventario de repuestos poblado exitosamente.')
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