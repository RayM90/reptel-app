import prisma from '../lib/prisma'
import { confirmFinalPayment, markOrderDelivered, markOrderPickedUpUnrepaired, submitCounterFinalPayment } from '../modules/orders/orders.service'

let client: { id: string }
let technician: { id: string }
let device: { id: string }

const makeOrder = async (overrides: Partial<{ status: string; budget: number; finalPaymentDetails: Record<string, string> | null; deliveryAmount: number | null }> = {}) => {
  return prisma.order.create({
    data: {
      orderNumber: `REP-TEST-FP-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      status: (overrides.status ?? 'READY') as any,
      problem: 'Pantalla dañada — test pago final',
      budget: overrides.budget ?? 100,
      deliveryAmount: 'deliveryAmount' in overrides ? overrides.deliveryAmount : 10,
      revisionAmount: 15,
      finalPaymentDetails: 'finalPaymentDetails' in overrides ? (overrides.finalPaymentDetails as any) : { monto: '100', metodo: 'Pago Móvil' },
      clientId: client.id,
      deviceId: device.id,
      technicianId: technician.id,
    },
  })
}

beforeAll(async () => {
  const suffix = Date.now()
  client = await prisma.client.create({
    data: {
      name: 'Cliente', lastName: 'Pago Final',
      idNumber: `TEST-FP-${suffix}`, phone: '0000000003',
    },
  })
  technician = await prisma.user.create({
    data: {
      name: 'Técnico Test FP', email: `tecnico-fp-${suffix}@test.com`,
      password: 'x', role: 'TECHNICIAN_DELIVERY',
      technicianStatus: 'BUSY', activeOrderCount: 1,
    },
  })
  device = await prisma.device.create({
    data: { type: 'LAPTOP', brand: 'HP', model: 'Pavilion 15' },
  })
}, 20000)

afterAll(async () => {
  // confirmFinalPayment registra el cobro como AdvancePaymentSubmission
  // (Finding A, revisión final) — hay que borrarlos antes que las órdenes.
  await prisma.advancePaymentSubmission.deleteMany({ where: { order: { clientId: client.id } } })
  await prisma.orderStatusHistory.deleteMany({ where: { order: { clientId: client.id } } })
  await prisma.order.deleteMany({ where: { clientId: client.id } })
  await prisma.device.delete({ where: { id: device.id } }).catch(() => {})
  await prisma.user.delete({ where: { id: technician.id } }).catch(() => {})
  await prisma.client.delete({ where: { id: client.id } }).catch(() => {})
})

describe('orders.service — confirmFinalPayment', () => {
  it('al aprobar: PAID_PENDING_DELIVERY, deliveredAt sigue null, comisión calculada', async () => {
    const order = await makeOrder({ budget: 100 })
    const result = await confirmFinalPayment(order.id, true)

    expect(result.status).toBe('PAID_PENDING_DELIVERY')
    expect(result.deliveredAt).toBeNull()
    expect(result.finalPaymentConfirmed).toBe(true)
    expect(result.finalPaymentConfirmedAt).not.toBeNull()
    expect(Number(result.technicianCommission)).toBe(44) // 10 + 0.4*(100-15)

    const techAfter = await prisma.user.findUnique({ where: { id: technician.id } })
    expect(techAfter?.activeOrderCount).toBe(0)
  })

  it('al rechazar: vuelve a READY, limpia finalPaymentDetails', async () => {
    const order = await makeOrder({ budget: 80 })
    const result = await confirmFinalPayment(order.id, false, 'Monto incorrecto')

    expect(result.status).toBe('READY')
    expect(result.finalPaymentDetails).toBeNull()
    expect(result.finalPaymentConfirmed).toBe(false)
    expect(result.finalPaymentRejectionReason).toBe('Monto incorrecto')
  })
})

describe('orders.service — markOrderDelivered', () => {
  it('desde PAID_PENDING_DELIVERY: pasa a DELIVERED y setea deliveredAt', async () => {
    const order = await makeOrder({ status: 'PAID_PENDING_DELIVERY' })
    const result = await markOrderDelivered(order.id)

    expect(result.status).toBe('DELIVERED')
    expect(result.deliveredAt).not.toBeNull()
  })

  it('lanza error si el status no es PAID_PENDING_DELIVERY', async () => {
    const order = await makeOrder({ status: 'READY' })
    await expect(markOrderDelivered(order.id)).rejects.toThrow(
      'Esta acción solo aplica a órdenes pagadas, pendientes de entrega'
    )
  })
})

describe('orders.service — markOrderPickedUpUnrepaired', () => {
  it('desde REJECTED_PENDING_PICKUP: pasa a CANCELLED y setea deliveredAt', async () => {
    const order = await makeOrder({ status: 'REJECTED_PENDING_PICKUP' })
    const result = await markOrderPickedUpUnrepaired(order.id)

    expect(result.status).toBe('CANCELLED')
    expect(result.deliveredAt).not.toBeNull()
  })

  it('lanza error si el status no es REJECTED_PENDING_PICKUP', async () => {
    const order = await makeOrder({ status: 'READY' })
    await expect(markOrderPickedUpUnrepaired(order.id)).rejects.toThrow(
      'Esta acción solo aplica a órdenes con presupuesto rechazado, pendientes de retiro'
    )
  })
})

describe('orders.service — submitCounterFinalPayment', () => {
  it('desde READY sin pago final aún: guarda finalPaymentDetails', async () => {
    const order = await makeOrder({ status: 'READY', finalPaymentDetails: null, deliveryAmount: null })
    const result = await submitCounterFinalPayment(order.id, { banco: 'Bancaribe', telefono: '04121234567', referencia: '9999' })

    expect(result.finalPaymentDetails).toEqual({ banco: 'Bancaribe', telefono: '04121234567', referencia: '9999' })
    expect(result.status).toBe('READY')
  })

  it('lanza error si el status no es READY', async () => {
    const order = await makeOrder({ status: 'DIAGNOSING', finalPaymentDetails: null, deliveryAmount: null })
    await expect(
      submitCounterFinalPayment(order.id, { banco: 'Bancaribe', telefono: '04121234567', referencia: '9999' })
    ).rejects.toThrow('Esta acción solo aplica a órdenes listas para entrega')
  })

  it('lanza error si la orden es de la app (el cliente paga desde la app)', async () => {
    const order = await makeOrder({ status: 'READY', finalPaymentDetails: null, deliveryAmount: 10 })
    await expect(
      submitCounterFinalPayment(order.id, { banco: 'Bancaribe', telefono: '04121234567', referencia: '9999' })
    ).rejects.toThrow('Las órdenes de la app las gestiona el cliente desde la app')
  })

  it('lanza error si la orden no existe', async () => {
    await expect(
      submitCounterFinalPayment('00000000-0000-0000-0000-000000000000', { banco: 'Bancaribe' })
    ).rejects.toThrow('Orden no encontrada')
  })
})
