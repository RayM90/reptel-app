import request from 'supertest'
import app from '../app'
import prisma from '../lib/prisma'
import {
  createProductOrder,
  cancelProductOrder,
} from '../modules/product-orders/product-orders.service'

let category: { id: string }
let product: { id: string }
let client: { id: string }

beforeAll(async () => {
  const suffix = Date.now()

  category = await prisma.productCategory.create({
    data: { name: `Categoria Test ${suffix}` },
  })

  product = await prisma.product.create({
    data: {
      name: `Producto Test ${suffix}`,
      price: 10,
      stock: 10,
      categoryId: category.id,
    },
  })

  client = await prisma.client.create({
    data: {
      name: 'Cliente',
      lastName: 'Cancelacion',
      idNumber: `TEST-CANCEL-${suffix}`,
      phone: '0000000000',
      email: `cliente-cancel-${suffix}@test.com`,
      password: '',
    },
  })
}, 20000)

afterAll(async () => {
  await prisma.productOrderStatusHistory.deleteMany({ where: { productOrder: { clientId: client.id } } })
  await prisma.productOrderItem.deleteMany({ where: { productId: product.id } })
  await prisma.productOrder.deleteMany({ where: { clientId: client.id } })
  await prisma.product.delete({ where: { id: product.id } }).catch(() => {})
  await prisma.productCategory.delete({ where: { id: category.id } }).catch(() => {})
  await prisma.client.delete({ where: { id: client.id } }).catch(() => {})
})

describe('product-orders.service — cancelProductOrder', () => {

  it('restaura el stock y marca el pedido como CANCELLED', async () => {
    const order = await createProductOrder({
      clientId: client.id,
      items: [{ productId: product.id, quantity: 3 }],
      paymentMethod: 'MOBILE_PAYMENT',
      address: 'Calle de prueba 123',
    })

    const afterCreate = await prisma.product.findUnique({ where: { id: product.id } })
    expect(afterCreate?.stock).toBe(7)

    const cancelled = await cancelProductOrder(order.id)
    expect(cancelled.status).toBe('CANCELLED')

    const afterCancel = await prisma.product.findUnique({ where: { id: product.id } })
    expect(afterCancel?.stock).toBe(10)
  })

  it('no permite cancelar un pedido que ya no está PENDING', async () => {
    const order = await createProductOrder({
      clientId: client.id,
      items: [{ productId: product.id, quantity: 2 }],
      paymentMethod: 'MOBILE_PAYMENT',
      address: 'Calle de prueba 123',
    })

    await prisma.productOrder.update({
      where: { id: order.id },
      data: { status: 'CONFIRMED' },
    })

    await expect(cancelProductOrder(order.id)).rejects.toThrow()

    // El stock del pedido ya confirmado no debe tocarse.
    // (el test anterior dejó el stock en 10 tras cancelar su propio pedido;
    // este pedido consume 2 y debe quedar así, sin restaurarse)
    const afterAttempt = await prisma.product.findUnique({ where: { id: product.id } })
    expect(afterAttempt?.stock).toBe(8)

    // Limpieza manual — este pedido no queda en PENDING, así que el
    // afterAll (que borra por clientId) igual lo alcanza.
  })

})

describe('PATCH /api/product-orders/:id/cancel — protección de ruta', () => {

  it('sin token debe retornar 401', async () => {
    const res = await request(app).patch('/api/product-orders/cualquier-id/cancel')
    expect(res.status).toBe(401)
  })

})
