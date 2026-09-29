import prisma from '../lib/prisma'
import {
  useProductInOrder, revertProductUsage, rejectExtraPart, rejectExtraPartByAdmin,
  submitBudgetPaymentInstallment, confirmAdvancePaymentInstallment, finishRepair,
  addBudgetAdjustment, getOrdersByClient,
} from '../modules/orders/orders.service'
import { createProduct } from '../modules/products/products.service'

let category: { id: string }
let product: { id: string }
let cheapProduct: { id: string }
let technician: { id: string; email: string }
let admin: { id: string; email: string }
let client: { id: string }
let clientUser: { id: string; email: string }
let device: { id: string }

// Presupuesto $115, revisión $15 → base $100. Con $50 confirmados la orden
// está en reparación (mínimo 50%, sin repuestos). Sin deliveryAmount = orden
// de mostrador; con deliveryAmount = orden de la app.
// Regla de pausa (D1): solo si lo confirmado ($50) no cubre los repuestos.
const makeRepairingOrder = async (deliveryAmount?: number) => {
  const order = await prisma.order.create({
    data: {
      orderNumber: `REP-TEST-XP-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      problem: 'Prueba repuesto adicional', status: 'REPAIRING', budget: 115, revisionAmount: 15,
      deliveryAmount,
      budgetApproved: true, clientId: client.id, deviceId: device.id, technicianId: technician.id,
    },
  })
  await prisma.advancePaymentSubmission.create({
    data: { orderId: order.id, amount: 50, paymentDetails: { banco: 'Test' }, kind: 'BUDGET', status: 'CONFIRMED' },
  })
  return order
}

// Dos repuestos de $30 = $60 > $50 confirmado → pausa, faltan $10.
const pauseOrder = (orderId: string) => useProductInOrder(orderId, product.id, 2, technician.email)

const stockOf = async (id: string) => (await prisma.product.findUniqueOrThrow({ where: { id } })).stock

beforeAll(async () => {
  const suffix = Date.now()
  category = await prisma.productCategory.create({ data: { name: `Categoria XP ${suffix}` } })
  product = await createProduct({ name: 'Repuesto XP', price: 30, stock: 40, categoryId: category.id })
  cheapProduct = await createProduct({ name: 'Repuesto XP barato', price: 5, stock: 20, categoryId: category.id })
  technician = await prisma.user.create({ data: { name: 'Tec', lastName: 'XP', email: `tec-xp-${suffix}@test.com`, password: 'x', role: 'TECHNICIAN_DELIVERY' } })
  admin = await prisma.user.create({ data: { name: 'Admin', lastName: 'XP', email: `admin-xp-${suffix}@test.com`, password: 'x', role: 'ADMIN' } })
  client = await prisma.client.create({ data: { name: 'Cliente', lastName: 'XP', idNumber: `TEST-XP-${suffix}`, phone: '04120000000' } })
  clientUser = await prisma.user.create({ data: { name: 'Cliente', lastName: 'XP', email: `cliente-xp-${suffix}@test.com`, password: 'x', role: 'CLIENT', clientId: client.id } })
  device = await prisma.device.create({ data: { type: 'LAPTOP', brand: 'Test', model: 'XP' } })
}, 20000)

afterAll(async () => {
  await prisma.inventoryMovement.deleteMany({ where: { productId: { in: [product.id, cheapProduct.id] } } })
  await prisma.advancePaymentSubmission.deleteMany({ where: { order: { clientId: client.id } } })
  await prisma.orderStatusHistory.deleteMany({ where: { order: { clientId: client.id } } })
  await prisma.order.deleteMany({ where: { clientId: client.id } })
  await prisma.device.delete({ where: { id: device.id } }).catch(() => {})
  await prisma.user.delete({ where: { id: clientUser.id } }).catch(() => {})
  await prisma.client.delete({ where: { id: client.id } }).catch(() => {})
  await prisma.user.delete({ where: { id: technician.id } }).catch(() => {})
  await prisma.user.delete({ where: { id: admin.id } }).catch(() => {})
  await prisma.product.delete({ where: { id: product.id } }).catch(() => {})
  await prisma.product.delete({ where: { id: cheapProduct.id } }).catch(() => {})
  await prisma.productCategory.delete({ where: { id: category.id } }).catch(() => {})
})

describe('repuesto adicional durante la reparación', () => {
  it('un repuesto que no supera lo pagado no pausa la reparación', async () => {
    const order = await makeRepairingOrder()
    // $30 ≤ $50 confirmado (con la regla vieja del mínimo sí pausaba).
    const result = await useProductInOrder(order.id, product.id, 1, technician.email)
    expect(result.order.status).toBe('REPAIRING')
    expect(result.movement.awaitingClientPayment).toBe(false)
  })

  it('si los repuestos superan lo pagado, pausa la orden, marca el repuesto y pide la diferencia', async () => {
    const order = await makeRepairingOrder()
    const result = await pauseOrder(order.id)
    expect(result.order.status).toBe('WAITING_EXTRA_PAYMENT')
    expect(result.movement.awaitingClientPayment).toBe(true)
    const h = await prisma.orderStatusHistory.findFirst({ where: { orderId: order.id, status: 'WAITING_EXTRA_PAYMENT' } })
    expect(h?.comment).toMatch(/\$10\.00/)
    const summary = (await getOrdersByClient(client.id)).find((o) => o.id === order.id)
    expect(summary?.paymentSummary?.pendingForMinimum).toBe(10)
    await expect(finishRepair(order.id, technician.id)).rejects.toThrow(/en reparación/)
  })

  it('el repuesto que hace superar lo pagado es el que pausa', async () => {
    const order = await makeRepairingOrder()
    const first = await useProductInOrder(order.id, product.id, 1, technician.email)
    expect(first.order.status).toBe('REPAIRING')
    const second = await useProductInOrder(order.id, product.id, 1, technician.email)
    expect(second.order.status).toBe('WAITING_EXTRA_PAYMENT')
    expect(second.movement.awaitingClientPayment).toBe(true)
  })

  it('al confirmarse el pago de la diferencia, vuelve a REPAIRING y limpia la marca', async () => {
    const order = await makeRepairingOrder()
    const used = await pauseOrder(order.id)
    const s = await submitBudgetPaymentInstallment(order.id, clientUser.email, { banco: 'Test' }, 10)
    const updated = await confirmAdvancePaymentInstallment(s.id, true)
    expect(updated.status).toBe('REPAIRING')
    const movement = await prisma.inventoryMovement.findUniqueOrThrow({ where: { id: used.movement.id } })
    expect(movement.awaitingClientPayment).toBe(false)
  })

  it('un abono que no alcanza deja la orden en pausa', async () => {
    const order = await makeRepairingOrder()
    await pauseOrder(order.id)
    const s = await submitBudgetPaymentInstallment(order.id, clientUser.email, { banco: 'Test' }, 5)
    const updated = await confirmAdvancePaymentInstallment(s.id, true)
    expect(updated.status).toBe('WAITING_EXTRA_PAYMENT')
  })

  it('un ajuste de presupuesto nunca pausa, y un repuesto chico después tampoco', async () => {
    const order = await makeRepairingOrder()
    const adjusted = await addBudgetAdjustment(order.id, technician.email, 40, 'Mano de obra extra')
    expect(adjusted.status).toBe('REPAIRING')
    // Repuestos $5 ≤ $50 confirmado (con la regla vieja: mínimo $70 → pausaba).
    const result = await useProductInOrder(order.id, cheapProduct.id, 1, technician.email)
    expect(result.order.status).toBe('REPAIRING')
  })

  it('si el técnico revierte el repuesto pendiente, la orden vuelve a REPAIRING con un texto neutro', async () => {
    const order = await makeRepairingOrder()
    const used = await pauseOrder(order.id)
    const reverted = await revertProductUsage(used.movement.id, technician.email)
    expect(reverted.order.status).toBe('REPAIRING')
    const h = await prisma.orderStatusHistory.findFirst({ where: { orderId: order.id, status: 'REPAIRING' }, orderBy: { createdAt: 'desc' } })
    expect(h?.comment).toBe('Presupuesto actualizado — el técnico continúa la reparación')
  })

  it('rejectExtraPart: devuelve el stock, baja el presupuesto y sigue la reparación', async () => {
    const order = await makeRepairingOrder()
    const stockBefore = await stockOf(product.id)
    await pauseOrder(order.id)

    const updated = await rejectExtraPart(order.id, clientUser.email)
    expect(updated.status).toBe('REPAIRING')
    expect(Number(updated.budget)).toBe(115)
    expect(await stockOf(product.id)).toBe(stockBefore)
    const h = await prisma.orderStatusHistory.findFirst({ where: { orderId: order.id, status: 'REPAIRING' }, orderBy: { createdAt: 'desc' } })
    expect(h?.comment).toMatch(/^El cliente rechazó el repuesto adicional/)
    expect(h?.comment).toMatch(/responsabilidad del cliente/)
  })

  it('rejectExtraPart fuera de WAITING_EXTRA_PAYMENT lanza error', async () => {
    const order = await makeRepairingOrder()
    await expect(rejectExtraPart(order.id, clientUser.email)).rejects.toThrow(/repuesto adicional/)
  })

  it('rejectExtraPart tras que el técnico ya revirtió el repuesto: la orden ya está en REPAIRING y no toca el stock', async () => {
    const order = await makeRepairingOrder()
    const used = await pauseOrder(order.id)
    const reverted = await revertProductUsage(used.movement.id, technician.email)
    expect(reverted.order.status).toBe('REPAIRING')
    const stockAfterRevert = await stockOf(product.id)

    await expect(rejectExtraPart(order.id, clientUser.email)).rejects.toThrow(/repuesto adicional/)
    expect(await stockOf(product.id)).toBe(stockAfterRevert)
  })

  it('rejectExtraPart llamado dos veces: la segunda no vuelve a tocar stock ni presupuesto', async () => {
    const order = await makeRepairingOrder()
    await pauseOrder(order.id)
    const stockAfterUse = await stockOf(product.id)

    const first = await rejectExtraPart(order.id, clientUser.email)
    expect(first.status).toBe('REPAIRING')
    expect(Number(first.budget)).toBe(115)
    const stockAfterFirst = await stockOf(product.id)
    expect(stockAfterFirst).toBe(stockAfterUse + 2)

    await expect(rejectExtraPart(order.id, clientUser.email)).rejects.toThrow(/repuesto adicional/)
    expect(await stockOf(product.id)).toBe(stockAfterFirst)
  })

  it('revertProductUsage llamado dos veces sobre el mismo movimiento: la segunda falla y no duplica el stock', async () => {
    const order = await makeRepairingOrder()
    const used = await pauseOrder(order.id)
    const stockAfterUse = await stockOf(product.id)

    const first = await revertProductUsage(used.movement.id, technician.email)
    expect(first.order.status).toBe('REPAIRING')
    const stockAfterFirst = await stockOf(product.id)
    expect(stockAfterFirst).toBe(stockAfterUse + 2)

    await expect(revertProductUsage(used.movement.id, technician.email)).rejects.toThrow(/ya fue revertido/)
    expect(await stockOf(product.id)).toBe(stockAfterFirst)
  })
})

describe('rejectExtraPartByAdmin (mostrador)', () => {
  it('en una orden de mostrador: vuelve a REPAIRING, devuelve el stock y el historial nombra al administrador', async () => {
    const order = await makeRepairingOrder()
    const stockBefore = await stockOf(product.id)
    await pauseOrder(order.id)

    const updated = await rejectExtraPartByAdmin(order.id, admin.email)
    expect(updated.status).toBe('REPAIRING')
    expect(Number(updated.budget)).toBe(115)
    expect(await stockOf(product.id)).toBe(stockBefore)
    const h = await prisma.orderStatusHistory.findFirst({ where: { orderId: order.id, status: 'REPAIRING' }, orderBy: { createdAt: 'desc' } })
    expect(h?.comment).toBe(
      'Rechazo registrado por el administrador: el cliente rechazó el repuesto Repuesto XP (x2). La reparación sigue sin él, bajo su responsabilidad; lo ya pagado no se devuelve.'
    )
    expect(h?.userId).toBe(admin.id)
  })

  it('con nombres de repuesto largos el historial usa la cantidad y no revienta el VARCHAR(191)', async () => {
    const longProduct = await createProduct({
      name: 'Pantalla LED 15.6 pulgadas FHD 30 pines slim con bisagras', price: 80, stock: 2, categoryId: category.id,
    })
    try {
      const order = await makeRepairingOrder()
      await useProductInOrder(order.id, longProduct.id, 1, technician.email)
      const updated = await rejectExtraPartByAdmin(order.id, admin.email)
      expect(updated.status).toBe('REPAIRING')
      const h = await prisma.orderStatusHistory.findFirst({ where: { orderId: order.id, status: 'REPAIRING' }, orderBy: { createdAt: 'desc' } })
      expect(h?.comment).toMatch(/el cliente rechazó el repuesto \(1 repuesto\)\./)
    } finally {
      await prisma.inventoryMovement.deleteMany({ where: { productId: longProduct.id } })
      await prisma.product.delete({ where: { id: longProduct.id } }).catch(() => {})
    }
  })

  it('en una orden de la app lanza el error de assertCounterOrder y no toca la orden', async () => {
    const order = await makeRepairingOrder(10)
    await pauseOrder(order.id)
    await expect(rejectExtraPartByAdmin(order.id, admin.email)).rejects.toThrow('Las órdenes de la app las gestiona el cliente desde la app')
    const still = await prisma.order.findUniqueOrThrow({ where: { id: order.id } })
    expect(still.status).toBe('WAITING_EXTRA_PAYMENT')
  })

  it('fuera de WAITING_EXTRA_PAYMENT lanza error', async () => {
    const order = await makeRepairingOrder()
    await expect(rejectExtraPartByAdmin(order.id, admin.email)).rejects.toThrow(/repuesto adicional/)
  })
})
