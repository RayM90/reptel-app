import prisma from '../lib/prisma'
import { createProduct, updateProduct, sellProduct, getStoreSummaryToday, getInventoryMovements, InsufficientStockError } from '../modules/products/products.service'

let category: { id: string }

beforeAll(async () => {
  category = await prisma.productCategory.create({ data: { name: `Categoria Inv ${Date.now()}` } })
})

afterAll(async () => {
  await prisma.productCategory.delete({ where: { id: category.id } }).catch(() => {})
})

describe('InventoryMovement', () => {
  it('createProduct con stock inicial > 0 registra un movimiento IN', async () => {
    const product = await createProduct({ name: 'Producto Inv', price: 10, stock: 20, categoryId: category.id })

    const movement = await prisma.inventoryMovement.findFirst({ where: { productId: product.id } })
    expect(movement?.type).toBe('IN')
    expect(movement?.quantity).toBe(20)

    await prisma.inventoryMovement.deleteMany({ where: { productId: product.id } })
    await prisma.product.delete({ where: { id: product.id } })
  })

  it('updateProduct que sube el stock registra un movimiento IN con la diferencia', async () => {
    const product = await createProduct({ name: 'Producto Inv 2', price: 10, stock: 5, categoryId: category.id })
    await prisma.inventoryMovement.deleteMany({ where: { productId: product.id } }) // limpiar el IN inicial

    await updateProduct(product.id, { stock: 15 })

    const movement = await prisma.inventoryMovement.findFirst({
      where: { productId: product.id }, orderBy: { createdAt: 'desc' },
    })
    expect(movement?.type).toBe('IN')
    expect(movement?.quantity).toBe(10)

    await prisma.inventoryMovement.deleteMany({ where: { productId: product.id } })
    await prisma.product.delete({ where: { id: product.id } })
  })

  it('sellProduct con stock suficiente descuenta stock y registra un movimiento OUT con channel MOSTRADOR', async () => {
    const product = await createProduct({ name: 'Producto Venta', price: 10, stock: 10, categoryId: category.id })
    await prisma.inventoryMovement.deleteMany({ where: { productId: product.id } }) // limpiar el IN inicial

    const updated = await sellProduct(product.id, 4)
    expect(updated.stock).toBe(6)

    const movement = await prisma.inventoryMovement.findFirst({
      where: { productId: product.id }, orderBy: { createdAt: 'desc' },
    })
    expect(movement?.type).toBe('OUT')
    expect(movement?.quantity).toBe(4)
    expect(movement?.reason).toBe('Venta mostrador')
    expect(movement?.channel).toBe('MOSTRADOR')

    await prisma.inventoryMovement.deleteMany({ where: { productId: product.id } })
    await prisma.product.delete({ where: { id: product.id } })
  })

  it('sellProduct con stock insuficiente lanza InsufficientStockError y no modifica el stock', async () => {
    const product = await createProduct({ name: 'Producto Venta 2', price: 10, stock: 2, categoryId: category.id })
    await prisma.inventoryMovement.deleteMany({ where: { productId: product.id } })

    await expect(sellProduct(product.id, 5)).rejects.toThrow(InsufficientStockError)

    const unchanged = await prisma.product.findUniqueOrThrow({ where: { id: product.id } })
    expect(unchanged.stock).toBe(2)

    await prisma.inventoryMovement.deleteMany({ where: { productId: product.id } })
    await prisma.product.delete({ where: { id: product.id } })
  })
})

describe('getStoreSummaryToday', () => {
  it('cuenta y suma las ventas de mostrador de hoy (monto = cantidad × precio actual)', async () => {
    const product = await createProduct({ name: 'Producto Resumen', price: 10, stock: 10, categoryId: category.id })
    await prisma.inventoryMovement.deleteMany({ where: { productId: product.id } })

    await sellProduct(product.id, 3)

    const summary = await getStoreSummaryToday()
    expect(summary.salesCount).toBeGreaterThanOrEqual(1)
    expect(summary.salesTotal).toBeGreaterThanOrEqual(30)

    await prisma.inventoryMovement.deleteMany({ where: { productId: product.id } })
    await prisma.product.delete({ where: { id: product.id } })
  })

  it('incluye productos con stock <= minStock en lowStockProducts', async () => {
    const product = await createProduct({ name: 'Producto Bajo Stock', price: 10, stock: 2, minStock: 5, categoryId: category.id })
    await prisma.inventoryMovement.deleteMany({ where: { productId: product.id } })

    const summary = await getStoreSummaryToday()
    expect(summary.lowStockProducts.some((p) => p.id === product.id)).toBe(true)

    await prisma.inventoryMovement.deleteMany({ where: { productId: product.id } })
    await prisma.product.delete({ where: { id: product.id } })
  })

  it('no incluye productos con stock > minStock en lowStockProducts', async () => {
    const product = await createProduct({ name: 'Producto Stock OK', price: 10, stock: 50, minStock: 5, categoryId: category.id })
    await prisma.inventoryMovement.deleteMany({ where: { productId: product.id } })

    const summary = await getStoreSummaryToday()
    expect(summary.lowStockProducts.some((p) => p.id === product.id)).toBe(false)

    await prisma.inventoryMovement.deleteMany({ where: { productId: product.id } })
    await prisma.product.delete({ where: { id: product.id } })
  })
})

describe('getInventoryMovements', () => {
  it('filtra por productId e incluye product.name y channel', async () => {
    const product = await createProduct({ name: 'Producto Historial', price: 10, stock: 10, categoryId: category.id })
    await prisma.inventoryMovement.deleteMany({ where: { productId: product.id } })
    await sellProduct(product.id, 2)

    const movements = await getInventoryMovements({ productId: product.id })
    expect(movements).toHaveLength(1)
    expect(movements[0].product.name).toBe('Producto Historial')
    expect(movements[0].channel).toBe('MOSTRADOR')

    await prisma.inventoryMovement.deleteMany({ where: { productId: product.id } })
    await prisma.product.delete({ where: { id: product.id } })
  })

  it('filtra por channel', async () => {
    const product = await createProduct({ name: 'Producto Historial 2', price: 10, stock: 10, categoryId: category.id })
    await prisma.inventoryMovement.deleteMany({ where: { productId: product.id } })
    await sellProduct(product.id, 1)

    const withChannel = await getInventoryMovements({ productId: product.id, channel: 'MOSTRADOR' })
    const withOtherChannel = await getInventoryMovements({ productId: product.id, channel: 'SERVICIO_TECNICO' })
    expect(withChannel).toHaveLength(1)
    expect(withOtherChannel).toHaveLength(0)

    await prisma.inventoryMovement.deleteMany({ where: { productId: product.id } })
    await prisma.product.delete({ where: { id: product.id } })
  })
})
