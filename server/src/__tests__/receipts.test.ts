import request from 'supertest'
import PDFDocument from 'pdfkit'
import app from '../app'
import prisma from '../lib/prisma'
import { generateIntakeReceipt, generateFinalReceipt, generatePaymentReceipt, generateClosureReceipt, generateBudgetAdvanceReceipt, getIntakeReceiptLabels } from '../modules/receipts/receipts.service'
import { decrementTechnicianLoad } from '../modules/orders/orders.service'

const fakeOrder = {
  orderNumber: 'REP-TEST-0001',
  problem: 'Pantalla dañada',
  diagnosis: 'Cambio de pantalla necesario',
  observations: 'Rayón en la tapa',
  deliveryObservations: 'Se probó 24h sin fallas',
  budget: 50,
  revisionAmount: 15,
  deliveryAmount: 10,
  advancePaymentMethod: 'MOBILE_PAYMENT',
  finalPaymentDetails: { referencia: '123456' },
  finalPaymentConfirmedAt: new Date(),
  budgetAdvanceConfirmedAt: new Date(),
  budgetAdvanceAmount: 7.5,
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

// Instrumenta PDFDocument.prototype.text para registrar con qué `doc.x`
// arrancó cada llamada — regresión de layout: addTwoColumnRow y
// drawBoxedBlock deben restaurar doc.x al margen izquierdo al terminar, no
// solo doc.y. Todas las llamadas de texto ocurren de forma síncrona dentro
// de las funciones generate*Receipt (antes de doc.end()), así que no hace
// falta esperar el buffer del PDF para inspeccionarlas.
const captureTextXs = (renderFn: () => PDFKit.PDFDocument): { text: string; x: number }[] => {
  const original = PDFDocument.prototype.text
  const calls: { text: string; x: number }[] = []
  ;(PDFDocument.prototype as any).text = function (this: PDFKit.PDFDocument, text: string, ...rest: unknown[]) {
    calls.push({ text, x: this.x })
    return original.apply(this, [text, ...rest] as any)
  }
  try {
    renderFn()
  } finally {
    PDFDocument.prototype.text = original
  }
  return calls
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

  it('generateBudgetAdvanceReceipt produce un PDF válido', async () => {
    const buffer = await collectPdfBuffer(generateBudgetAdvanceReceipt(fakeOrder as any))
    expect(buffer.subarray(0, 4).toString()).toBe('%PDF')
  })

  it('las 5 funciones producen un PDF válido cuando observations/deliveryObservations son null', async () => {
    const orderSinObservaciones = { ...fakeOrder, observations: null, deliveryObservations: null }

    const buffers = await Promise.all([
      collectPdfBuffer(generateIntakeReceipt(orderSinObservaciones as any)),
      collectPdfBuffer(generateFinalReceipt(orderSinObservaciones as any)),
      collectPdfBuffer(generatePaymentReceipt(orderSinObservaciones as any)),
      collectPdfBuffer(generateClosureReceipt(orderSinObservaciones as any)),
      collectPdfBuffer(generateBudgetAdvanceReceipt(orderSinObservaciones as any)),
    ])

    for (const buffer of buffers) {
      expect(buffer.subarray(0, 4).toString()).toBe('%PDF')
    }
  })
})

describe('regresión de layout — doc.x tras addTwoColumnRow y drawBoxedBlock', () => {
  const MARGIN = 50

  it('generateIntakeReceipt: el contenido después de las filas de dos columnas arranca en el margen izquierdo, no en la columna derecha', () => {
    // Apellido largo para forzar wrap en una columna y no en la otra —
    // el bug de doc.x se reproduce igual sin esto, pero así cubrimos
    // también el caso de columnas de alturas distintas.
    const orderConNombreLargo = {
      ...fakeOrder,
      client: {
        name: 'Clienta',
        lastName: 'Con Un Apellido Sumamente Largo Para Forzar El Wrap De Texto En La Columna Izquierda',
        phone: '04120000000',
      },
    }

    const calls = captureTextXs(() => generateIntakeReceipt(orderConNombreLargo as any))

    const fallaIndex = calls.findIndex((c) => c.text === 'Falla reportada:')
    expect(fallaIndex).toBeGreaterThan(-1)

    // Todo lo que se escribe desde 'Falla reportada:' en adelante (falla,
    // estado del equipo al recibir, anticipo, método de pago, fecha, nota
    // de diagnóstico, disclaimer) debe arrancar en el margen izquierdo.
    const postTwoColumnCalls = calls.slice(fallaIndex)
    expect(postTwoColumnCalls.length).toBeGreaterThan(0)
    for (const call of postTwoColumnCalls) {
      expect(call.x).toBe(MARGIN)
    }
  })

  it('generateIntakeReceipt: cliente empresa sin apellido no deja un espacio colgante en el nombre', () => {
    const orderEmpresa = {
      ...fakeOrder,
      client: { name: 'Constructora ABC, C.A.', lastName: '', phone: '04120000000' },
    }

    const calls = captureTextXs(() => generateIntakeReceipt(orderEmpresa as any))

    expect(calls.some((c) => c.text === 'Constructora ABC, C.A.')).toBe(true)
    expect(calls.some((c) => c.text === 'Constructora ABC, C.A. ')).toBe(false)
  })

  it('generatePaymentReceipt: el contenido después de la caja "Detalle de cobro" arranca en el margen izquierdo, no en contentX de la caja', () => {
    const calls = captureTextXs(() => generatePaymentReceipt(fakeOrder as any))

    const fechaIndex = calls.findIndex((c) => c.text === 'Fecha de pago: ')
    expect(fechaIndex).toBeGreaterThan(-1)

    const postBoxCalls = calls.slice(fechaIndex)
    expect(postBoxCalls.length).toBeGreaterThan(0)
    for (const call of postBoxCalls) {
      expect(call.x).toBe(MARGIN)
    }
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
    await prisma.advancePaymentSubmission.deleteMany({ where: { orderId } })
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

  it('recibo de pago: 400 si el pago final no está confirmado', async () => {
    await prisma.order.update({ where: { id: orderId }, data: { status: 'READY', finalPaymentConfirmed: false } })

    const res = await request(app)
      .get(`/api/orders/${orderId}/receipt/payment`)
      .set('Authorization', `Bearer ${authToken}`)

    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
  }, 10000)

  it('recibo de pago: 200 y PDF cuando el pago final ya está confirmado', async () => {
    await prisma.order.update({
      where: { id: orderId },
      data: { status: 'PAID_PENDING_DELIVERY', finalPaymentConfirmed: true, budget: 50 },
    })

    const res = await request(app)
      .get(`/api/orders/${orderId}/receipt/payment`)
      .set('Authorization', `Bearer ${authToken}`)

    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toBe('application/pdf')
  }, 10000)

  it('recibo de cierre: 400 si la orden no está CANCELLED', async () => {
    await prisma.order.update({ where: { id: orderId }, data: { status: 'READY' } })

    const res = await request(app)
      .get(`/api/orders/${orderId}/receipt/closure`)
      .set('Authorization', `Bearer ${authToken}`)

    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
  }, 10000)

  it('recibo de cierre: 200 y PDF cuando la orden está CANCELLED', async () => {
    await prisma.order.update({ where: { id: orderId }, data: { status: 'CANCELLED', budgetRejectionReason: 'Muy costoso' } })

    const res = await request(app)
      .get(`/api/orders/${orderId}/receipt/closure`)
      .set('Authorization', `Bearer ${authToken}`)

    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toBe('application/pdf')
  }, 10000)

  it('recibo de anticipo de presupuesto: 400 si no hay abono BUDGET confirmado', async () => {
    await prisma.order.update({ where: { id: orderId }, data: { status: 'WAITING_APPROVAL', budget: 30 } })

    const res = await request(app)
      .get(`/api/orders/${orderId}/receipt/budget-advance`)
      .set('Authorization', `Bearer ${authToken}`)

    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
  }, 10000)

  it('recibo de anticipo de presupuesto: 200 y PDF cuando ya hay un abono BUDGET confirmado', async () => {
    await prisma.advancePaymentSubmission.create({
      data: {
        orderId,
        amount: 7.5,
        paymentDetails: { banco: 'Bancaribe', telefono: '04121234567', referencia: '9999' },
        kind: 'BUDGET',
        status: 'CONFIRMED',
        confirmedAt: new Date(),
      },
    })

    const res = await request(app)
      .get(`/api/orders/${orderId}/receipt/budget-advance`)
      .set('Authorization', `Bearer ${authToken}`)

    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toBe('application/pdf')
  }, 10000)
})

describe('addLetterhead — grid corporativo (logo izq, datos del negocio a la derecha)', () => {
  const MARGIN = 50

  it('el bloque de datos del negocio (dirección, teléfono, RIF) arranca a la derecha del logo, no centrado', () => {
    // captureTextXs registra doc.x ANTES de que pdfkit procese cada llamada,
    // así que la primera línea (nombre) no puede probarse así: su x propio
    // (120) recién queda reflejado en doc.x para la SIGUIENTE llamada. Las
    // 3 líneas siguientes sí heredan correctamente ese x explícito.
    const calls = captureTextXs(() => generateIntakeReceipt(fakeOrder as any))
    const textX = MARGIN + 70

    const direccionCall = calls.find((c) => c.text === 'Av. Urdaneta, Caracas, Venezuela')
    const telefonoCall = calls.find((c) => c.text === 'Tel: 0424-2440004')
    const rifCall = calls.find((c) => c.text === 'RIF: J-40587644')

    expect(direccionCall?.x).toBe(textX)
    expect(telefonoCall?.x).toBe(textX)
    expect(rifCall?.x).toBe(textX)
  })

  it('el título y el número de orden siguen arrancando en el margen izquierdo tras el nuevo membrete (doc.x restaurado)', () => {
    const calls = captureTextXs(() => generateIntakeReceipt(fakeOrder as any))

    const tituloIndex = calls.findIndex((c) => c.text === 'RECIBO DE RECEPCIÓN')
    expect(tituloIndex).toBeGreaterThan(-1)
    expect(calls[tituloIndex].x).toBe(MARGIN)

    const ordenIndex = calls.findIndex((c) => c.text === `Orden ${fakeOrder.orderNumber}`)
    expect(ordenIndex).toBeGreaterThan(-1)
    expect(calls[ordenIndex].x).toBe(MARGIN)
  })
})

describe('addFooterDisclaimer — nota adicional exclusiva del Recibo de Recepción', () => {
  it('generateIntakeReceipt incluye la nota legal del anticipo en el footer', () => {
    const calls = captureTextXs(() => generateIntakeReceipt(fakeOrder as any))
    const texts = calls.map((c) => c.text)
    expect(texts).toContain(
      'El monto abonado por diagnóstico/revisión será descontado del costo total del servicio si la reparación es aprobada.'
    )
  })

  it('generateFinalReceipt NO incluye la nota del anticipo (es exclusiva de Recepción)', () => {
    const calls = captureTextXs(() => generateFinalReceipt(fakeOrder as any))
    const texts = calls.map((c) => c.text)
    expect(texts).not.toContain(
      'El monto abonado por diagnóstico/revisión será descontado del costo total del servicio si la reparación es aprobada.'
    )
  })
})

describe('generateBudgetAdvanceReceipt — título estricto y tabla financiera', () => {
  it('el título es "RECIBO PAGO DE PRESUPUESTO" (ya no "de Anticipo")', () => {
    const calls = captureTextXs(() => generateBudgetAdvanceReceipt(fakeOrder as any))
    const texts = calls.map((c) => c.text)
    expect(texts).toContain('RECIBO PAGO DE PRESUPUESTO')
    expect(texts).not.toContain('RECIBO DE ANTICIPO DE PRESUPUESTO')
  })

  it('la tabla muestra Monto Total, Monto Abonado y Saldo Pendiente calculado', () => {
    // fakeOrder: budget 50, budgetAdvanceAmount 7.5 → saldo 42.5
    const calls = captureTextXs(() => generateBudgetAdvanceReceipt(fakeOrder as any))
    const texts = calls.map((c) => c.text)

    expect(texts).toContain('Monto Total: ')
    expect(texts.some((t) => t.startsWith('$50.00'))).toBe(true)
    expect(texts).toContain('Monto Abonado: ')
    expect(texts.some((t) => t.startsWith('$7.50'))).toBe(true)
    expect(texts).toContain('Saldo Pendiente: $42.50')
  })

  it('lista los repuestos usados dentro de la caja cuando existen', () => {
    const orderConRepuestos = {
      ...fakeOrder,
      partsUsed: [
        { productName: 'RAM DDR4 8GB', quantity: 2, unitPriceAtUse: 20 },
      ],
    }
    const calls = captureTextXs(() => generateBudgetAdvanceReceipt(orderConRepuestos as any))
    const texts = calls.map((c) => c.text)

    expect(texts).toContain('Repuestos usados:')
    expect(texts.some((t) => t.includes('RAM DDR4 8GB (x2)'))).toBe(true)
    expect(texts.some((t) => t.includes('$40.00'))).toBe(true)
  })

  it('no muestra la sección de repuestos cuando no hay ninguno', () => {
    const calls = captureTextXs(() => generateBudgetAdvanceReceipt(fakeOrder as any))
    const texts = calls.map((c) => c.text)
    expect(texts).not.toContain('Repuestos usados:')
  })
})

describe('generateFinalReceipt — relabel de observaciones de entrega', () => {
  it('usa el subtítulo "Estado final, pruebas y observaciones" en vez de "Estado del equipo al entregar"', () => {
    const calls = captureTextXs(() => generateFinalReceipt(fakeOrder as any))
    const texts = calls.map((c) => c.text)
    expect(texts).toContain('Estado final, pruebas y observaciones:')
    expect(texts).not.toContain('Estado del equipo al entregar:')
  })
})

const orderConHistorialDePagos = {
  ...fakeOrder,
  advancePaymentSubmissions: [
    {
      kind: 'REVISION',
      amount: 15,
      paymentDetails: { banco: 'Bancaribe', referencia: '1111' },
      confirmedAt: new Date('2026-01-01T10:00:00Z'),
    },
    {
      kind: 'BUDGET',
      amount: 25,
      paymentDetails: { banco: 'Bancaribe', referencia: '2222' },
      confirmedAt: new Date('2026-01-05T10:00:00Z'),
    },
  ],
}

describe('generateFinalReceipt — historial de pagos y saldo $0.00', () => {
  const MARGIN = 50

  it('lista cada abono confirmado (revisión y presupuesto) con monto, método y fecha', () => {
    const calls = captureTextXs(() => generateFinalReceipt(orderConHistorialDePagos as any))
    const texts = calls.map((c) => c.text)

    expect(texts).toContain('Anticipo de revisión: ')
    expect(texts.some((t) => t.includes('$15.00') && t.includes('banco: Bancaribe'))).toBe(true)
    expect(texts).toContain('Anticipo de presupuesto: ')
    expect(texts.some((t) => t.includes('$25.00') && t.includes('referencia: 2222'))).toBe(true)
  })

  it('cierra siempre con "Saldo pendiente: $0.00", sin importar los montos abonados', () => {
    const calls = captureTextXs(() => generateFinalReceipt(orderConHistorialDePagos as any))
    const texts = calls.map((c) => c.text)
    expect(texts).toContain('Saldo pendiente: $0.00')
  })

  it('no falla cuando no hay advancePaymentSubmissions (orden sin abonos previos registrados)', async () => {
    const orderSinHistorial = { ...fakeOrder, advancePaymentSubmissions: undefined }
    const buffer = await collectPdfBuffer(generateFinalReceipt(orderSinHistorial as any))
    expect(buffer.subarray(0, 4).toString()).toBe('%PDF')
  })

  it('el contenido después de la caja de historial de pagos arranca en el margen izquierdo', () => {
    const calls = captureTextXs(() => generateFinalReceipt(orderConHistorialDePagos as any))
    const fechaIndex = calls.findIndex((c) => c.text === 'Fecha de entrega: ')
    expect(fechaIndex).toBeGreaterThan(-1)
    const postBoxCalls = calls.slice(fechaIndex)
    expect(postBoxCalls.length).toBeGreaterThan(0)
    for (const call of postBoxCalls) {
      expect(call.x).toBe(MARGIN)
    }
  })
})

describe('generateFinalReceipt — firma del cliente', () => {
  it('incluye la línea de firma y la fecha de entrega antes del disclaimer legal', () => {
    const calls = captureTextXs(() => generateFinalReceipt(fakeOrder as any))
    const texts = calls.map((c) => c.text)

    const firmaIndex = texts.indexOf('Firma del cliente')
    const disclaimerIndex = texts.indexOf('Este documento es un recibo interno de pago — no constituye factura fiscal.')
    expect(firmaIndex).toBeGreaterThan(-1)
    expect(disclaimerIndex).toBeGreaterThan(-1)
    expect(firmaIndex).toBeLessThan(disclaimerIndex)
  })
})
