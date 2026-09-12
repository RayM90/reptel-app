import request from 'supertest'
import app from '../app'
import prisma from '../lib/prisma'
import { generateIntakeReceipt, generateFinalReceipt, generatePaymentReceipt, generateClosureReceipt, getIntakeReceiptLabels } from '../modules/receipts/receipts.service'
import { decrementTechnicianLoad } from '../modules/orders/orders.service'

const fakeOrder = {
  orderNumber: 'REP-TEST-0001',
  problem: 'Pantalla dañada',
  diagnosis: 'Cambio de pantalla necesario',
  budget: 50,
  revisionAmount: 15,
  deliveryAmount: 10,
  advancePaymentMethod: 'MOBILE_PAYMENT',
  finalPaymentDetails: { referencia: '123456' },
  finalPaymentConfirmedAt: new Date(),
  budgetRejectionReason: 'Muy costoso',
  technicianCommission: 20,
  receivedAt: new Date(),
  deliveredAt: new Date(),
  client: { name: 'Cliente', lastName: 'Prueba', phone: '04120000000' },
  technician: { name: 'Técnico Prueba' },
  device: { type: 'LAPTOP', brand: 'HP', model: 'Pavilion', color: 'Negro' },
}

const collectPdfBuffer = (doc: PDFKit.PDFDocument): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    doc.on('data', (chunk) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)
  })
}

describe('receipts.service — generación de PDF', () => {
  it('generateIntakeReceipt produce un PDF válido', async () => {
    const buffer = await collectPdfBuffer(generateIntakeReceipt(fakeOrder as any))
    expect(buffer.subarray(0, 4).toString()).toBe('%PDF')
  })

  it('generateFinalReceipt produce un PDF válido', async () => {
    const buffer = await collectPdfBuffer(generateFinalReceipt(fakeOrder as any))
    expect(buffer.subarray(0, 4).toString()).toBe('%PDF')
  })

  it('generateFinalReceipt no falla con repuestos usados en el detalle', async () => {
    const orderWithParts = {
      ...fakeOrder,
      partsUsed: [
        { productName: 'Pantalla LCD', quantity: 1, unitPriceAtUse: 45 },
        { productName: 'Cargador USB-C', quantity: 2, unitPriceAtUse: 15 },
      ],
    }
    const buffer = await collectPdfBuffer(generateFinalReceipt(orderWithParts as any))
    expect(buffer.subarray(0, 4).toString()).toBe('%PDF')
  })

  it('generateIntakeReceipt no falla si el dispositivo no tiene color (campo opcional en Device)', async () => {
    const orderWithoutColor = { ...fakeOrder, device: { ...fakeOrder.device, color: null } }
    const buffer = await collectPdfBuffer(generateIntakeReceipt(orderWithoutColor as any))
    expect(buffer.subarray(0, 4).toString()).toBe('%PDF')
  })

  it('generatePaymentReceipt produce un PDF válido', async () => {
    const buffer = await collectPdfBuffer(generatePaymentReceipt(fakeOrder as any))
    expect(buffer.subarray(0, 4).toString()).toBe('%PDF')
  })

  it('generateClosureReceipt produce un PDF válido', async () => {
    const buffer = await collectPdfBuffer(generateClosureReceipt(fakeOrder as any))
    expect(buffer.subarray(0, 4).toString()).toBe('%PDF')
  })
})

describe('getIntakeReceiptLabels — self-service+delivery antes de que el técnico vaya', () => {
  it('orden de mostrador (deliveryAmount null): siempre "Recibo de Recepción"', () => {
    const labels = getIntakeReceiptLabels({ deliveryAmount: null, diagnosis: null })
    expect(labels.pendingPickup).toBe(false)
    expect(labels.title).toBe('Recibo de Recepción')
  })

  it('self-service+delivery sin diagnóstico todavía: "Recibo de Anticipo"', () => {
    const labels = getIntakeReceiptLabels({ deliveryAmount: 10, diagnosis: null })
    expect(labels.pendingPickup).toBe(true)
    expect(labels.title).toBe('Recibo de Anticipo')
    expect(labels.dateLabel).toBe('Fecha de la orden')
  })

  it('self-service+delivery con diagnóstico ya registrado: "Recibo de Recepción"', () => {
    const labels = getIntakeReceiptLabels({ deliveryAmount: 10, diagnosis: 'Cambio de pantalla' })
    expect(labels.pendingPickup).toBe(false)
    expect(labels.title).toBe('Recibo de Recepción')
  })
})

describe('Orders — GET /:id/receipt/*', () => {
  let authToken: string
  let client: { id: string }
  let device: { id: string }
  let orderId: string
  let technicianId: string | null

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@reptel.com', password: 'RepTel2024*' })
    authToken = res.body.data.token

    client = await prisma.client.create({
      data: {
        name: 'Cliente', lastName: 'Recibo Test',
        idNumber: `TEST-RECEIPT-${Date.now()}`, phone: '04120000000',
      },
    })
    device = await prisma.device.create({
      data: { type: 'LAPTOP', brand: 'HP', model: 'Pavilion' },
    })
    const order = await prisma.order.create({
      data: {
        orderNumber: `REP-TEST-RECEIPT-${Date.now()}`,
        problem: 'Pantalla dañada — test recibo',
        status: 'RECEIVED',
        revisionAmount: 15,
        clientId: client.id,
        deviceId: device.id,
      },
    })
    orderId = order.id
    technicianId = order.technicianId
  }, 20000)

  afterAll(async () => {
    await prisma.orderStatusHistory.deleteMany({ where: { orderId } })
    await prisma.order.delete({ where: { id: orderId } }).catch(() => {})
    await prisma.device.delete({ where: { id: device.id } }).catch(() => {})
    await prisma.client.delete({ where: { id: client.id } }).catch(() => {})
    if (technicianId) await decrementTechnicianLoad(technicianId)
  })

  it('recibo de recepción: 200 y PDF para una orden RECEIVED', async () => {
    const res = await request(app)
      .get(`/api/orders/${orderId}/receipt/intake`)
      .set('Authorization', `Bearer ${authToken}`)

    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toBe('application/pdf')
  }, 10000)

  it('recibo de recepción: 400 si la orden sigue en PENDING_PAYMENT', async () => {
    await prisma.order.update({ where: { id: orderId }, data: { status: 'PENDING_PAYMENT' } })

    const res = await request(app)
      .get(`/api/orders/${orderId}/receipt/intake`)
      .set('Authorization', `Bearer ${authToken}`)

    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)

    await prisma.order.update({ where: { id: orderId }, data: { status: 'RECEIVED' } })
  }, 10000)

  it('recibo final: 400 si la orden no está DELIVERED', async () => {
    const res = await request(app)
      .get(`/api/orders/${orderId}/receipt/final`)
      .set('Authorization', `Bearer ${authToken}`)

    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
  }, 10000)

  it('recibo final: 200 y PDF cuando la orden sí está DELIVERED', async () => {
    await prisma.order.update({ where: { id: orderId }, data: { status: 'DELIVERED' } })

    const res = await request(app)
      .get(`/api/orders/${orderId}/receipt/final`)
      .set('Authorization', `Bearer ${authToken}`)

    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toBe('application/pdf')
  }, 10000)
})
