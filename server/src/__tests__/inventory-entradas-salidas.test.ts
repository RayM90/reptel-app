import prisma from '../lib/prisma'
import { deriveDestination } from '../modules/products/products.service'
import { useProductInOrder } from '../modules/orders/orders.service'

describe('deriveDestination', () => {
  it('TECHNICIAN_DELIVERY (motorizado) → DOMICILIO_CLIENTE', () => {
    expect(deriveDestination('TECHNICIAN_DELIVERY')).toBe('DOMICILIO_CLIENTE')
  })

  it('TECHNICIAN (mostrador) → TALLER', () => {
    expect(deriveDestination('TECHNICIAN')).toBe('TALLER')
  })

  it('ADMIN → TIENDA', () => {
    expect(deriveDestination('ADMIN')).toBe('TIENDA')
  })

  it('cualquier otro rol → TIENDA (default seguro)', () => {
    expect(deriveDestination('CLIENT')).toBe('TIENDA')
  })
})

describe('useProductInOrder — destination se auto-completa', () => {
  let client: { id: string }
  let device: { id: string }
  let technician: { id: string; email: string }
  let order: { id: string }
  let product: { id: string }

  beforeAll(async () => {
    const suffix = Date.now()
    client = await prisma.client.create({
      data: { name: 'Cliente', lastName: 'Destino', idNumber: `TEST-DEST-${suffix}`, phone: '0000000000', email: `cliente-dest-${suffix}@test.com` },
    })
    device = await prisma.device.create({ data: { type: 'LAPTOP', brand: 'TestBrand', model: 'X1' } })
    technician = await prisma.user.create({
      data: { name: 'Tecnico', lastName: 'Motorizado', email: `tecnico-dest-${suffix}@test.com`, role: 'TECHNICIAN_DELIVERY', password: 'COGNITO_MANAGED' },
    })
    order = await prisma.order.create({
      data: { orderNumber: `TEST-DEST-ORDER-${suffix}`, clientId: client.id, deviceId: device.id, problem: 'Prueba destination', technicianId: technician.id },
    })
    const category = await prisma.productCategory.findFirst({ where: { isActive: true } })
    product = await prisma.product.create({
      data: { name: `Producto destino ${suffix}`, price: 10, stock: 5, categoryId: category!.id },
    })
  }, 20000)

  afterAll(async () => {
    await prisma.inventoryMovement.deleteMany({ where: { productId: product.id } })
    await prisma.product.delete({ where: { id: product.id } }).catch(() => {})
    await prisma.orderStatusHistory.deleteMany({ where: { orderId: order.id } })
    await prisma.order.delete({ where: { id: order.id } }).catch(() => {})
    await prisma.device.delete({ where: { id: device.id } }).catch(() => {})
    await prisma.user.delete({ where: { id: technician.id } }).catch(() => {})
    await prisma.client.delete({ where: { id: client.id } }).catch(() => {})
  })

  it('un técnico motorizado usando un repuesto deja destination=DOMICILIO_CLIENTE', async () => {
    const { movement } = await useProductInOrder(order.id, product.id, 1, technician.email)
    expect(movement.destination).toBe('DOMICILIO_CLIENTE')
  })
})
