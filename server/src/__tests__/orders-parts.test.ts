import prisma from '../lib/prisma'
import { useProductInOrder, revertProductUsage, getPartsUsedInOrder, getOrdersByClient } from '../modules/orders/orders.service'
import { createProduct } from '../modules/products/products.service'

let category: { id: string }
let product: { id: string; price: any }
let technician: { id: string; email: string }
let otherTechnician: { id: string; email: string }
let client: { id: string }
let device: { id: string }
let order: { id: string; orderNumber: string; budget: any }

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
}, 20000)

afterAll(async () => {
  await prisma.inventoryMovement.deleteMany({ where: { orderId: order.id } })
  await prisma.orderStatusHistory.deleteMany({ where: { orderId: order.id } })
  await prisma.order.delete({ where: { id: order.id } }).catch(() => {})
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
})

describe('getPartsUsedInOrder', () => {
  it('lista los movimientos SERVICIO_TECNICO de esa orden con nombre de producto y de quién', async () => {
    const parts = await getPartsUsedInOrder(order.id)
    expect(parts.length).toBeGreaterThan(0)
    expect(parts[0].product.name).toBe('Repuesto Test')
    expect(parts[0].channel).toBe('SERVICIO_TECNICO')
  })
})

describe('getOrdersByClient — repuestos usados', () => {
  it('incluye partsUsed (producto, cantidad, precio) y excluye movimientos revertidos', async () => {
    const used = await useProductInOrder(order.id, product.id, 3, technician.email)

    const orders = await getOrdersByClient(client.id)
    const found = orders.find((o) => o.id === order.id)

    expect(found).toBeDefined()
    expect(found!.partsUsed.length).toBeGreaterThan(0)
    const matching = found!.partsUsed.find((p) => p.productName === 'Repuesto Test' && p.quantity === 3)
    expect(matching).toBeDefined()
    expect(Number(matching!.unitPriceAtUse)).toBe(20)

    await revertProductUsage(used.movement.id, technician.email)
    const ordersAfterRevert = await getOrdersByClient(client.id)
    const foundAfterRevert = ordersAfterRevert.find((o) => o.id === order.id)!
    expect(
      foundAfterRevert.partsUsed.some((p) => p.quantity === 3 && p.productName === 'Repuesto Test')
    ).toBe(false)
  })
})
