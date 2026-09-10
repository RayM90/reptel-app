// server/prisma/clean-inventory-repuestos.ts
//
// Script de un solo uso: reemplaza el catálogo de "tienda" (Cargadores,
// Accesorios, productos de prueba) por el catálogo real de repuestos de
// reparación. Ver docs/superpowers/specs/2026-09-10-catalogo-real-repuestos-design.md
import * as dotenv from 'dotenv'
import { resolve } from 'path'
dotenv.config({ path: resolve(__dirname, '../.env') })
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const OLD_TEST_PRODUCT_NAME = 'Producto de prueba SDD'
const OLD_STORE_PRODUCT_NAMES = [
  'Cargador USB-C 65W',
  'Cargador USB-A 20W',
  'Funda protectora universal',
  'Teclado inalambrico',
]

const NEW_CATEGORIES = [
  'Pantallas',
  'Baterías',
  'Almacenamiento',
  'Memoria RAM',
  'Componentes de placa',
  'Cámaras y micrófonos',
  'Teclados/touchpads internos',
]

async function main() {
  console.log('Borrando productos de prueba y sus movimientos...')
  const testProducts = await prisma.product.findMany({
    where: { name: OLD_TEST_PRODUCT_NAME },
    select: { id: true },
  })
  const testProductIds = testProducts.map((p) => p.id)
  if (testProductIds.length > 0) {
    await prisma.inventoryMovement.deleteMany({
      where: { productId: { in: testProductIds } },
    })
    await prisma.product.deleteMany({
      where: { id: { in: testProductIds } },
    })
  }
  console.log(`  -> ${testProductIds.length} productos de prueba borrados`)

  console.log('Borrando productos de tienda (sin movimientos)...')
  const deletedStore = await prisma.product.deleteMany({
    where: { name: { in: OLD_STORE_PRODUCT_NAMES } },
  })
  console.log(`  -> ${deletedStore.count} productos de tienda borrados`)

  // Delete any existing new products (for idempotence)
  const newProductNames = [
    'Pantalla táctil de celular 5.5"-6.5" (genérica)',
    'Pila CMOS (batería de tarjeta madre)',
    'Disco sólido SSD 500GB SATA III',
    'Disco duro HDD 1TB SATA',
    'Memoria RAM DDR4 8GB SODIMM',
    'Memoria RAM DDR4 4GB SODIMM',
    'Conector de carga (jack de alimentación)',
    'Flex de video/pantalla para laptop',
    'Módulo de cámara web integrada',
    'Micrófono interno para laptop',
    'Teclado interno de laptop (español)',
    'Touchpad interno de laptop',
  ]
  console.log('Limpiando productos del catálogo que ya existan...')
  const existingNewProducts = await prisma.product.findMany({
    where: { name: { in: newProductNames } },
    select: { id: true },
  })
  const existingNewProductIds = existingNewProducts.map((p) => p.id)
  if (existingNewProductIds.length > 0) {
    await prisma.inventoryMovement.deleteMany({
      where: { productId: { in: existingNewProductIds } },
    })
    await prisma.product.deleteMany({
      where: { id: { in: existingNewProductIds } },
    })
  }
  console.log(`  -> ${existingNewProductIds.length} productos duplicados borrados`)

  console.log('Creando categorías nuevas...')
  await prisma.productCategory.createMany({
    data: NEW_CATEGORIES.map((name) => ({ name })),
    skipDuplicates: true,
  })
  const categories = await prisma.productCategory.findMany({
    where: { name: { in: NEW_CATEGORIES } },
  })
  const categoryIdByName = new Map(categories.map((c) => [c.name, c.id]))

  console.log('Corrigiendo los 2 productos válidos existentes...')
  await prisma.product.update({
    where: { id: 'fe4178bb-6a9b-11f1-a51a-489ebddc276b' },
    data: {
      name: 'Pantalla LCD 15.6" (laptop)',
      description:
        'Panel LCD genérico 15.6 pulgadas, conector 30/40 pines, para reemplazo en laptops',
      categoryId: categoryIdByName.get('Pantallas')!,
      requiresInstallation: true,
    },
  })
  await prisma.product.update({
    where: { id: 'fe417a95-6a9b-11f1-a51a-489ebddc276b' },
    data: {
      name: 'Batería de laptop (universal)',
      description: 'Batería genérica multi-modelo para laptop, ión-litio',
      categoryId: categoryIdByName.get('Baterías')!,
      requiresInstallation: true,
    },
  })

  console.log('Creando los 12 productos nuevos...')
  const newProducts: Array<{
    name: string
    description: string
    price: number
    stock: number
    minStock: number
    categoryName: string
  }> = [
    {
      name: 'Pantalla táctil de celular 5.5"-6.5" (genérica)',
      description:
        'Módulo táctil + LCD genérico compatible con gama media, sin marco',
      price: 28,
      stock: 5,
      minStock: 2,
      categoryName: 'Pantallas',
    },
    {
      name: 'Pila CMOS (batería de tarjeta madre)',
      description:
        'Pila botón CR2032 para respaldo de BIOS/reloj de la placa madre',
      price: 3,
      stock: 20,
      minStock: 5,
      categoryName: 'Baterías',
    },
    {
      name: 'Disco sólido SSD 500GB SATA III',
      description:
        'Unidad de estado sólido 2.5 pulgadas, interfaz SATA III, reemplazo de disco mecánico',
      price: 38,
      stock: 8,
      minStock: 3,
      categoryName: 'Almacenamiento',
    },
    {
      name: 'Disco duro HDD 1TB SATA',
      description: 'Disco mecánico 2.5 pulgadas para laptop, 5400rpm',
      price: 30,
      stock: 5,
      minStock: 2,
      categoryName: 'Almacenamiento',
    },
    {
      name: 'Memoria RAM DDR4 8GB SODIMM',
      description:
        'Módulo de memoria para laptop, DDR4 2666MHz, formato SODIMM',
      price: 22,
      stock: 10,
      minStock: 3,
      categoryName: 'Memoria RAM',
    },
    {
      name: 'Memoria RAM DDR4 4GB SODIMM',
      description:
        'Módulo de memoria para laptop, DDR4 2666MHz, formato SODIMM',
      price: 14,
      stock: 10,
      minStock: 3,
      categoryName: 'Memoria RAM',
    },
    {
      name: 'Conector de carga (jack de alimentación)',
      description: 'Puerto de carga DC genérico para laptop, requiere soldadura',
      price: 6,
      stock: 12,
      minStock: 4,
      categoryName: 'Componentes de placa',
    },
    {
      name: 'Flex de video/pantalla para laptop',
      description: 'Cable flex que conecta la placa con el panel de pantalla',
      price: 9,
      stock: 8,
      minStock: 3,
      categoryName: 'Componentes de placa',
    },
    {
      name: 'Módulo de cámara web integrada',
      description: 'Cámara interna genérica para laptop, conector estándar',
      price: 7,
      stock: 10,
      minStock: 3,
      categoryName: 'Cámaras y micrófonos',
    },
    {
      name: 'Micrófono interno para laptop',
      description: 'Micrófono integrado genérico, conector estándar',
      price: 5,
      stock: 10,
      minStock: 3,
      categoryName: 'Cámaras y micrófonos',
    },
    {
      name: 'Teclado interno de laptop (español)',
      description:
        'Teclado de reemplazo genérico, distribución español, sin retroiluminación',
      price: 18,
      stock: 8,
      minStock: 3,
      categoryName: 'Teclados/touchpads internos',
    },
    {
      name: 'Touchpad interno de laptop',
      description: 'Panel táctil genérico de reemplazo para laptop',
      price: 12,
      stock: 8,
      minStock: 3,
      categoryName: 'Teclados/touchpads internos',
    },
  ]

  for (const p of newProducts) {
    const categoryId = categoryIdByName.get(p.categoryName)
    if (!categoryId) throw new Error(`Categoría no encontrada: ${p.categoryName}`)
    const created = await prisma.product.create({
      data: {
        name: p.name,
        description: p.description,
        price: p.price,
        stock: p.stock,
        minStock: p.minStock,
        categoryId,
        requiresInstallation: true,
      },
    })
    await prisma.inventoryMovement.create({
      data: {
        productId: created.id,
        type: 'IN',
        quantity: p.stock,
        reason: 'Stock inicial — catálogo real de repuestos',
      },
    })
  }
  console.log(`  -> ${newProducts.length} productos nuevos creados`)

  // Cleanup: delete any ProductCategory that is NOT one of the 7 approved
  console.log('Limpiando categorías no autorizadas (con sus productos e inventario)...')
  const allCategories = await prisma.productCategory.findMany({
    select: { id: true, name: true },
  })
  const unapprovedCategories = allCategories.filter(
    (c) => !NEW_CATEGORIES.includes(c.name)
  )

  let deletedStrayCount = 0
  for (const category of unapprovedCategories) {
    // Get all product IDs in this category
    const products = await prisma.product.findMany({
      where: { categoryId: category.id },
      select: { id: true },
    })
    const productIds = products.map((p) => p.id)

    // Delete InventoryMovement for those products
    if (productIds.length > 0) {
      await prisma.inventoryMovement.deleteMany({
        where: { productId: { in: productIds } },
      })
      // Delete the products
      await prisma.product.deleteMany({
        where: { id: { in: productIds } },
      })
    }

    // Delete the category itself
    await prisma.productCategory.delete({
      where: { id: category.id },
    })
    deletedStrayCount++
    console.log(`  -> Categoría no autorizada "${category.name}" borrada`)
  }
  console.log(`  -> ${deletedStrayCount} categorías no autorizadas eliminadas`)

  console.log('Listo.')
}

main()
  .catch((e) => {
    console.error('Error en la limpieza de inventario:', e)
    throw e
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
