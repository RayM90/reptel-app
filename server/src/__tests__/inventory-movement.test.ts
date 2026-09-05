import prisma from '../lib/prisma'
import { createProduct, updateProduct } from '../modules/products/products.service'

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
})
