import prisma from '../lib/prisma'

describe('columnas *Url ampliadas a VARCHAR(500)', () => {
  it('acepta una URL firmada larga (300+ caracteres) sin truncar', async () => {
    const category = await prisma.productCategory.create({ data: { name: `Categoria URL ${Date.now()}` } })
    const longUrl = 'https://bucket.s3.amazonaws.com/productos/' + 'a'.repeat(280) + '.jpg?X-Amz-Signature=' + 'b'.repeat(40)

    const product = await prisma.product.create({
      data: { name: 'Producto URL', price: 10, categoryId: category.id, imageUrl: longUrl },
    })

    const readBack = await prisma.product.findUnique({ where: { id: product.id } })
    expect(readBack?.imageUrl).toBe(longUrl)
    expect(readBack?.imageUrl?.length).toBeGreaterThan(191)

    await prisma.product.delete({ where: { id: product.id } })
    await prisma.productCategory.delete({ where: { id: category.id } })
  })
})
