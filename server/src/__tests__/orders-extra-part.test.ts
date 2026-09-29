import prisma from '../lib/prisma'
import {
  useProductInOrder, revertProductUsage, rejectExtraPart,
  submitBudgetPaymentInstallment, confirmAdvancePaymentInstallment, finishRepair,
} from '../modules/orders/orders.service'
import { createProduct } from '../modules/products/products.service'

let category: { id: string }
let product: { id: string }
let technician: { id: string; email: string }
let client: { id: string }
let clientUser: { id: string; email: string }
let device: { id: string }

// Presupuesto $115, revisión $15 → base $100. Con $50 confirmados la orden
// está en reparación (mínimo 50%, sin repuestos).
const makeRepairingOrder = async () => {
  const order = await prisma.order.create({
    data: {
      orderNumber: `REP-TEST-XP-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      problem: 'Prueba repuesto adicional', status: 'REPAIRING', budget: 115, revisionAmount: 15,
      budgetApproved: true, clientId: client.id, deviceId: device.id, technicianId: technician.id,
    },
  })
  await prisma.advancePaymentSubmission.create({
    data: { orderId: order.id, amount: 50, paymentDetails: { banco: 'Test' }, kind: 'BUDGET', status: 'CONFIRMED' },
  })
  return order
}

beforeAll(async () => {
  const suffix = Date.now()
  category = await prisma.productCategory.create({ data: { name: `Categoria XP ${suffix}` } })
  product = await createProduct({ name: 'Repuesto XP', price: 30, stock: 20, categoryId: category.id })
  technician = await prisma.user.create({ data: { name: 'Tec', lastName: 'XP', email: `tec-xp-${suffix}@test.com`, password: 'x', role: 'TECHNICIAN_DELIVERY' } })
  client = await prisma.client.create({ data: { name: 'Cliente', lastName: 'XP', idNumber: `TEST-XP-${suffix}`, phone: '04120000000' } })
  clientUser = await prisma.user.create({ data: { name: 'Cliente', lastName: 'XP', email: `cliente-xp-${suffix}@test.com`, password: 'x', role: 'CLIENT', clientId: client.id } })
  device = await prisma.device.create({ data: { type: 'LAPTOP', brand: 'Test', model: 'XP' } })
}, 20000)

afterAll(async () => {
  await prisma.inventoryMovement.deleteMany({ where: { productId: product.id } })
  await prisma.advancePaymentSubmission.deleteMany({ where: { order: { clientId: client.id } } })
  await prisma.orderStatusHistory.deleteMany({ where: { order: { clientId: client.id } } })
  await prisma.order.deleteMany({ where: { clientId: client.id } })
  await prisma.device.delete({ where: { id: device.id } }).catch(() => {})
  await prisma.user.delete({ where: { id: clientUser.id } }).catch(() => {})
  await prisma.client.delete({ where: { id: client.id } }).catch(() => {})
  await prisma.user.delete({ where: { id: technician.id } }).catch(() => {})
  await prisma.product.delete({ where: { id: product.id } }).catch(() => {})
  await prisma.productCategory.delete({ where: { id: category.id } }).catch(() => {})
})

describe('repuesto adicional durante la reparación', () => {
  it('si lo pagado sigue cubriendo el mínimo, la reparación no se pausa', async () => {
    const order = await makeRepairingOrder()
    // +$30 → base $130, repuestos $30 (23%) → mínimo 50% = $65 > $50 → pausa.
    // Para este caso se confirma antes un abono extra de $20 → $70 ≥ $65.
    await prisma.advancePaymentSubmission.create({
      data: { orderId: order.id, amount: 20, paymentDetails: { banco: 'Test' }, kind: 'BUDGET', status: 'CONFIRMED' },
    })
    const result = await useProductInOrder(order.id, product.id, 1, technician.email)
    expect(result.order.status).toBe('REPAIRING')
    expect(result.movement.awaitingClientPayment).toBe(false)
  })

  it('si no lo cubre, pausa la orden y marca el repuesto', async () => {
    const order = await makeRepairingOrder()
    const result = await useProductInOrder(order.id, product.id, 1, technician.email)
    expect(result.order.status).toBe('WAITING_EXTRA_PAYMENT')
    expect(result.movement.awaitingClientPayment).toBe(true)
    await expect(finishRepair(order.id, technician.id)).rejects.toThrow(/en reparación/)
  })

  it('al confirmarse el pago de la diferencia, vuelve a REPAIRING y limpia la marca', async () => {
    const order = await makeRepairingOrder()
    const used = await useProductInOrder(order.id, product.id, 1, technician.email)
    // base $130 → mínimo $65; confirmado $50 → falta $15
    const s = await submitBudgetPaymentInstallment(order.id, clientUser.email, { banco: 'Test' }, 15)
    const updated = await confirmAdvancePaymentInstallment(s.id, true)
    expect(updated.status).toBe('REPAIRING')
    const movement = await prisma.inventoryMovement.findUniqueOrThrow({ where: { id: used.movement.id } })
    expect(movement.awaitingClientPayment).toBe(false)
  })

  it('un abono que no alcanza deja la orden en pausa', async () => {
    const order = await makeRepairingOrder()
    await useProductInOrder(order.id, product.id, 1, technician.email)
    const s = await submitBudgetPaymentInstallment(order.id, clientUser.email, { banco: 'Test' }, 5)
    const updated = await confirmAdvancePaymentInstallment(s.id, true)
    expect(updated.status).toBe('WAITING_EXTRA_PAYMENT')
  })

  it('si el técnico revierte el repuesto pendiente, la orden vuelve a REPAIRING', async () => {
    const order = await makeRepairingOrder()
    const used = await useProductInOrder(order.id, product.id, 1, technician.email)
    const reverted = await revertProductUsage(used.movement.id, technician.email)
    expect(reverted.order.status).toBe('REPAIRING')
  })

  it('rejectExtraPart: devuelve el stock, baja el presupuesto y sigue la reparación', async () => {
    const order = await makeRepairingOrder()
    const stockBefore = (await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).stock
    await useProductInOrder(order.id, product.id, 1, technician.email)

    const updated = await rejectExtraPart(order.id, clientUser.email)
    expect(updated.status).toBe('REPAIRING')
    expect(Number(updated.budget)).toBe(115)
    const stockAfter = (await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).stock
    expect(stockAfter).toBe(stockBefore)
    const h = await prisma.orderStatusHistory.findFirst({ where: { orderId: order.id, status: 'REPAIRING' }, orderBy: { createdAt: 'desc' } })
    expect(h?.comment).toMatch(/responsabilidad del cliente/)
  })

  it('rejectExtraPart fuera de WAITING_EXTRA_PAYMENT lanza error', async () => {
    const order = await makeRepairingOrder()
    await expect(rejectExtraPart(order.id, clientUser.email)).rejects.toThrow(/repuesto adicional/)
  })

  it('rejectExtraPart tras que el técnico ya revirtió el repuesto: la orden ya está en REPAIRING y no toca el stock', async () => {
    const order = await makeRepairingOrder()
    const used = await useProductInOrder(order.id, product.id, 1, technician.email)
    const reverted = await revertProductUsage(used.movement.id, technician.email)
    expect(reverted.order.status).toBe('REPAIRING')
    const stockAfterRevert = (await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).stock

    await expect(rejectExtraPart(order.id, clientUser.email)).rejects.toThrow(/repuesto adicional/)
    const stockFinal = (await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).stock
    expect(stockFinal).toBe(stockAfterRevert)
  })

  it('rejectExtraPart llamado dos veces: la segunda no vuelve a tocar stock ni presupuesto', async () => {
    const order = await makeRepairingOrder()
    await useProductInOrder(order.id, product.id, 1, technician.email)
    const stockAfterUse = (await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).stock

    const first = await rejectExtraPart(order.id, clientUser.email)
    expect(first.status).toBe('REPAIRING')
    expect(Number(first.budget)).toBe(115)
    const stockAfterFirst = (await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).stock
    expect(stockAfterFirst).toBe(stockAfterUse + 1)

    await expect(rejectExtraPart(order.id, clientUser.email)).rejects.toThrow(/repuesto adicional/)
    const stockAfterSecond = (await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).stock
    expect(stockAfterSecond).toBe(stockAfterFirst)
  })

  it('revertProductUsage llamado dos veces sobre el mismo movimiento: la segunda falla y no duplica el stock', async () => {
    const order = await makeRepairingOrder()
    const used = await useProductInOrder(order.id, product.id, 1, technician.email)
    const stockAfterUse = (await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).stock

    const first = await revertProductUsage(used.movement.id, technician.email)
    expect(first.order.status).toBe('REPAIRING')
    const stockAfterFirst = (await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).stock
    expect(stockAfterFirst).toBe(stockAfterUse + 1)

    await expect(revertProductUsage(used.movement.id, technician.email)).rejects.toThrow(/ya fue revertido/)
    const stockAfterSecond = (await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).stock
    expect(stockAfterSecond).toBe(stockAfterFirst)
  })
})
