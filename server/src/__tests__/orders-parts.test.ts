import prisma from '../lib/prisma'
import { useProductInOrder, revertProductUsage, getPartsUsedInOrder } from '../modules/orders/orders.service'
import { createProduct } from '../modules/products/products.service'

let category: { id: string }
let product: { id: string; price: any }
let technician: { id: string; email: string }
let otherTechnician: { id: string; email: string }
let client: { id: string }
let device: { id: string }
let order: { id: string; orderNumber: string; budget: any }
let orderSinPresupuesto: { id: string; orderNumber: string }

beforeAll(async () => {
  const suffix = Date.now()
  category = await prisma.productCategory.create({ data: { name: `Categoria Parts ${suffix}` } })
  product = await createProduct({ name: 'Repuesto Test', price: 20, stock: 10, categoryId: category.id })
  await prisma.inventoryMovement.deleteMany({ where: { productId: product.id } }) // limpiar el IN inicial

  technician = await prisma.user.create({
    data: { name: 'Tecnico', lastName: 'Parts', email: `tecnico-parts-${suffix}@test.com`, password: 'x', role: 'TECHNICIAN_DELIVERY' },
  })
  otherTechnician = await prisma.user.create({
    data: { name: 'Otro', lastName: 'Tecnico', email: `otro-tecnico-parts-${suffix}@test.com`, password: 'x', role: 'TECHNICIAN_DELIVERY' },
  })

  client = await prisma.client.create({
    data: { name: 'Cliente', lastName: 'Parts', idNumber: `TEST-PARTS-${suffix}`, phone: '04120000000' },
  })
  device = await prisma.device.create({ data: { type: 'LAPTOP', brand: 'Test', model: 'Parts X1' } })

  order = await prisma.order.create({
    data: {
      orderNumber: `REP-TEST-PARTS-${suffix}`,
      problem: 'Falla original',
      status: 'DIAGNOSING',
      budget: 50,
      budgetApproved: true, // ya aprobado — el repuesto debe sumarse igual
      clientId: client.id,
      deviceId: device.id,
      technicianId: technician.id,
    },
  })

  orderSinPresupuesto = await prisma.order.create({
    data: {
      orderNumber: `REP-TEST-PARTS-NULL-${suffix}`,
      problem: 'Falla original, aún sin diagnóstico',
      status: 'DIAGNOSING',
      // budget se omite a propósito — así queda NULL, igual que una orden
      // real antes de que el técnico envíe el diagnóstico.
      clientId: client.id,
      deviceId: device.id,
      technicianId: technician.id,
    },
  })
}, 20000)

afterAll(async () => {
  await prisma.inventoryMovement.deleteMany({ where: { orderId: order.id } })
  await prisma.orderStatusHistory.deleteMany({ where: { orderId: order.id } })
  await prisma.order.delete({ where: { id: order.id } }).catch(() => {})
  await prisma.inventoryMovement.deleteMany({ where: { orderId: orderSinPresupuesto.id } })
  await prisma.orderStatusHistory.deleteMany({ where: { orderId: orderSinPresupuesto.id } })
  await prisma.order.delete({ where: { id: orderSinPresupuesto.id } }).catch(() => {})
  await prisma.device.delete({ where: { id: device.id } }).catch(() => {})
  await prisma.client.delete({ where: { id: client.id } }).catch(() => {})
  await prisma.user.delete({ where: { id: technician.id } }).catch(() => {})
  await prisma.user.delete({ where: { id: otherTechnician.id } }).catch(() => {})
  await prisma.product.delete({ where: { id: product.id } }).catch(() => {})
  await prisma.productCategory.delete({ where: { id: category.id } }).catch(() => {})
})

describe('useProductInOrder', () => {
  it('descuenta stock, suma al budget (aunque ya esté aprobado) y crea el InventoryMovement con channel SERVICIO_TECNICO', async () => {
    const result = await useProductInOrder(order.id, product.id, 2, technician.email)

    expect(Number(result.order.budget)).toBe(90) // 50 + (2 × $20)
    expect(result.movement.channel).toBe('SERVICIO_TECNICO')
    expect(result.movement.orderId).toBe(order.id)

    const updatedProduct = await prisma.product.findUniqueOrThrow({ where: { id: product.id } })
    expect(updatedProduct.stock).toBe(8) // 10 - 2
  })

  it('rechaza si el actor no es el técnico asignado a la orden', async () => {
    await expect(
      useProductInOrder(order.id, product.id, 1, otherTechnician.email)
    ).rejects.toThrow(/Solo el técnico asignado/)
  })

  it('rechaza si no hay stock suficiente', async () => {
    await expect(
      useProductInOrder(order.id, product.id, 999, technician.email)
    ).rejects.toThrow()
  })

  it('suma el costo al budget cuando la orden todavía no tiene presupuesto (NULL)', async () => {
    const result = await useProductInOrder(orderSinPresupuesto.id, product.id, 1, technician.email)

    expect(result.order.budget).not.toBeNull()
    expect(Number(result.order.budget)).toBe(20) // 0 (null) + 1 × $20

    const persisted = await prisma.order.findUniqueOrThrow({ where: { id: orderSinPresupuesto.id } })
    expect(Number(persisted.budget)).toBe(20)
  })
})

describe('revertProductUsage', () => {
  it('repone el stock y resta del budget lo que se había sumado', async () => {
    const used = await useProductInOrder(order.id, product.id, 1, technician.email)
    const productBefore = await prisma.product.findUniqueOrThrow({ where: { id: product.id } })

    const reverted = await revertProductUsage(used.movement.id, technician.email)

    expect(Number(reverted.order.budget)).toBe(Number(used.order.budget) - 20)
    const productAfter = await prisma.product.findUniqueOrThrow({ where: { id: product.id } })
    expect(productAfter.stock).toBe(productBefore.stock + 1)

    const movement = await prisma.inventoryMovement.findUniqueOrThrow({ where: { id: used.movement.id } })
    expect(movement.reversedAt).not.toBeNull()
  })

  it('rechaza revertir dos veces el mismo movimiento', async () => {
    const used = await useProductInOrder(order.id, product.id, 1, technician.email)
    await revertProductUsage(used.movement.id, technician.email)

    await expect(revertProductUsage(used.movement.id, technician.email)).rejects.toThrow(/ya fue revertido/)
  })

  it('revertir un repuesto agregado cuando el budget era NULL deja el budget en 0, no en NULL', async () => {
    const used = await useProductInOrder(orderSinPresupuesto.id, product.id, 1, technician.email)
    expect(Number(used.order.budget)).toBe(40) // 20 (del test anterior) + 1 × $20

    const reverted = await revertProductUsage(used.movement.id, technician.email)

    expect(reverted.order.budget).not.toBeNull()
    expect(Number(reverted.order.budget)).toBe(20) // vuelve a lo que había antes de este repuesto
  })
})

describe('getPartsUsedInOrder', () => {
  it('lista los movimientos SERVICIO_TECNICO de esa orden con nombre de producto y de quién', async () => {
    const parts = await getPartsUsedInOrder(order.id)
    expect(parts.length).toBeGreaterThan(0)
    expect(parts[0].product.name).toBe('Repuesto Test')
    expect(parts[0].channel).toBe('SERVICIO_TECNICO')
  })
})
