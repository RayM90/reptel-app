import prisma from '../lib/prisma'
import { getAllOrders, getOrderById, getOrdersByTechnician, getTodayOrders } from '../modules/orders/orders.service'

// La dirección del cliente vive en ClientAddress, no en Client. Las órdenes
// tienen que traerla aplanada en `client` (mismo shape que /api/clients) —
// sin ella, el motorizado no sabe a dónde ir a buscar el equipo y el modal
// del admin muestra la dirección vacía. Incidente del 2026-09-23.
describe('órdenes — incluyen la dirección principal del cliente', () => {
  let tech: { id: string }
  let client: { id: string }
  let orderId: string
  let deviceId: string

  beforeAll(async () => {
    const suffix = Date.now()
    tech = await prisma.user.create({
      data: {
        name: 'Motorizado', lastName: 'Direccion Test', email: `direccion-${suffix}@test.com`,
        password: 'x', role: 'TECHNICIAN_DELIVERY',
      },
    })
    client = await prisma.client.create({
      data: {
        name: 'Cliente', lastName: 'Direccion Test', idNumber: `TEST-ADDR-${suffix}`, phone: '04120000005',
        addresses: {
          create: [
            { label: 'Trabajo', isPrimary: false, addressStreet: 'Calle Secundaria', addressCity: 'Otra' },
            {
              label: 'Principal', isPrimary: true, addressState: 'Miranda', addressCity: 'Los Teques',
              addressNeighborhood: 'El Paso', addressStreet: 'Calle C', addressBuilding: 'Casa 12',
            },
          ],
        },
      },
    })
    const device = await prisma.device.create({
      data: { type: 'LAPTOP', brand: 'TestBrand', model: 'Dir X1', color: 'Negro', accessories: 'Ninguno' },
    })
    deviceId = device.id
    const order = await prisma.order.create({
      data: {
        orderNumber: `REP-TEST-ADDR-${suffix}`, clientId: client.id, deviceId, technicianId: tech.id,
        problem: 'Prueba de dirección', status: 'DIAGNOSING', deliveryAmount: 10,
      },
    })
    orderId = order.id
  })

  afterAll(async () => {
    await prisma.orderStatusHistory.deleteMany({ where: { orderId } })
    await prisma.order.delete({ where: { id: orderId } }).catch(() => {})
    await prisma.device.delete({ where: { id: deviceId } }).catch(() => {})
    await prisma.client.delete({ where: { id: client.id } }).catch(() => {})
    await prisma.user.delete({ where: { id: tech.id } }).catch(() => {})
  })

  const expectPrimaryAddress = (c: any) => {
    expect(c.addressStreet).toBe('Calle C')
    expect(c.addressBuilding).toBe('Casa 12')
    expect(c.addressNeighborhood).toBe('El Paso')
    expect(c.addressCity).toBe('Los Teques')
    expect(c.addressState).toBe('Miranda')
    expect(c.phone).toBe('04120000005')
  }

  it('getOrdersByTechnician (tablero del motorizado)', async () => {
    const orders = await getOrdersByTechnician(tech.id)
    expectPrimaryAddress(orders.find((o) => o.id === orderId)!.client)
  })

  it('getAllOrders (panel admin)', async () => {
    const orders = await getAllOrders()
    expectPrimaryAddress(orders.find((o) => o.id === orderId)!.client)
  })

  it('getTodayOrders', async () => {
    const orders = await getTodayOrders()
    expectPrimaryAddress(orders.find((o) => o.id === orderId)!.client)
  })

  it('getOrderById', async () => {
    const order = await getOrderById(orderId)
    expectPrimaryAddress(order!.client)
  })
})
