import prisma from '../lib/prisma'

let category: { id: string }

beforeAll(async () => {
  category = await prisma.productCategory.create({ data: { name: `Categoria Check ${Date.now()}` } })
})

afterAll(async () => {
  await prisma.productCategory.delete({ where: { id: category.id } }).catch(() => {})
})

describe('CHECK constraints a nivel de base de datos', () => {
  it('rechaza un Product con price negativo aunque se salte el controlador', async () => {
    await expect(
      prisma.product.create({ data: { name: 'Producto Check', price: -1, categoryId: category.id } })
    ).rejects.toThrow()
  })

  it('rechaza un Product con stock negativo aunque se salte el controlador', async () => {
    await expect(
      prisma.product.create({ data: { name: 'Producto Check 2', price: 10, stock: -1, categoryId: category.id } })
    ).rejects.toThrow()
  })
})
