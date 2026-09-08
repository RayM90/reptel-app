import prisma from '../lib/prisma'
import { createProduct, updateProduct, sellProduct, InsufficientStockError } from '../modules/products/products.service'

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

  it('sellProduct con stock suficiente descuenta stock y registra un movimiento OUT', async () => {
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
