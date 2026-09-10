import PDFDocument from 'pdfkit'
import path from 'path'

const LOGO_PATH = path.join(process.cwd(), 'assets', 'logo-reptel.png')

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH: 'Efectivo',
  TRANSFER: 'Transferencia',
  POINT_OF_SALE: 'Punto de venta',
  MOBILE_PAYMENT: 'Pago Móvil',
  MIXED: 'Mixto',
  BINANCE: 'Binance',
}

const DEVICE_TYPE_LABELS: Record<string, string> = {
  LAPTOP: 'Laptop',
  PC: 'PC',
}

const formatDate = (date: Date | string | null | undefined): string => {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('es-VE', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const formatMoney = (amount: unknown): string => {
  if (amount === null || amount === undefined) return '—'
  return `$${Number(amount).toFixed(2)}`
}

// Cada fila del recibo es una etiqueta y un valor — sin tablas, texto plano
// bien organizado (decisión de diseño: simple y limpio).
const addRow = (doc: PDFKit.PDFDocument, label: string, value: string) => {
  doc.font('Helvetica-Bold').fontSize(11).text(`${label}: `, { continued: true })
  doc.font('Helvetica').text(value)
  doc.moveDown(0.3)
}

const addHeader = (doc: PDFKit.PDFDocument, title: string, orderNumber: string) => {
  try {
    doc.image(LOGO_PATH, doc.page.width / 2 - 60, doc.y, { width: 120 })
    doc.moveDown(4)
  } catch {
    // Si el logo no está disponible, el recibo se genera igual sin imagen.
  }
  doc.font('Helvetica-Bold').fontSize(16).text(title, { align: 'center' })
  doc.font('Helvetica').fontSize(11).text(`Orden ${orderNumber}`, { align: 'center' })
  doc.moveDown(1.5)
}

interface OrderForReceipt {
  orderNumber: string
  problem: string
  diagnosis: string | null
  budget: unknown
  revisionAmount: unknown
  deliveryAmount: unknown
  advancePaymentMethod: string | null
  finalPaymentDetails: Record<string, string> | null
  technicianCommission: unknown
  receivedAt: Date | string | null
  deliveredAt: Date | string | null
  client: { name: string; lastName: string; phone: string }
  technician: { name: string } | null
  device: { type: string; brand: string; model: string; color: string | null }
  partsUsed?: { productName: string; quantity: number; unitPriceAtUse: unknown }[]
}

// Self-service + delivery: RECEIVED se dispara al confirmar el anticipo, no cuando
// el técnico va a buscar el equipo — hasta que haya diagnóstico, el equipo todavía
// no está físicamente en el taller. Las órdenes de mostrador (deliveryAmount ==
// null) sí tienen el equipo en mano desde el primer momento.
export const getIntakeReceiptLabels = (order: Pick<OrderForReceipt, 'deliveryAmount' | 'diagnosis'>) => {
  const pendingPickup = order.deliveryAmount != null && order.diagnosis == null
  return {
    pendingPickup,
    title: pendingPickup ? 'Recibo de Anticipo' : 'Recibo de Recepción',
    dateLabel: pendingPickup ? 'Fecha de la orden' : 'Fecha de recepción',
  }
}

export const generateIntakeReceipt = (order: OrderForReceipt): PDFKit.PDFDocument => {
  const doc = new PDFDocument({ margin: 50 })
  const { title, dateLabel } = getIntakeReceiptLabels(order)

  addHeader(doc, title, order.orderNumber)

  addRow(doc, 'Cliente', `${order.client.name} ${order.client.lastName}`)
  addRow(doc, 'Teléfono', order.client.phone)
  doc.moveDown(0.5)

  addRow(doc, 'Equipo', DEVICE_TYPE_LABELS[order.device.type] ?? order.device.type)
  addRow(doc, 'Marca / Modelo', `${order.device.brand} ${order.device.model}`)
  addRow(doc, 'Color', order.device.color ?? '—')
  doc.moveDown(0.5)

  addRow(doc, 'Falla reportada', order.problem)
  doc.moveDown(0.5)

  addRow(doc, 'Anticipo de revisión pagado', formatMoney(order.revisionAmount))
  if (order.advancePaymentMethod) {
    addRow(doc, 'Método de pago', PAYMENT_METHOD_LABELS[order.advancePaymentMethod] ?? order.advancePaymentMethod)
  }
  doc.moveDown(0.5)

  addRow(doc, dateLabel, formatDate(order.receivedAt))

  doc.end()
  return doc
}

export const generateFinalReceipt = (order: OrderForReceipt): PDFKit.PDFDocument => {
  const doc = new PDFDocument({ margin: 50 })

  addHeader(doc, 'Recibo de Entrega', order.orderNumber)

  addRow(doc, 'Cliente', `${order.client.name} ${order.client.lastName}`)
  addRow(doc, 'Técnico asignado', order.technician?.name ?? 'Sin asignar')
  doc.moveDown(0.5)

  addRow(doc, 'Falla reportada', order.problem)
  addRow(doc, 'Diagnóstico', order.diagnosis ?? '—')
  doc.moveDown(0.5)

  // Detalle tipo factura simple — igual que el presupuesto se arma sumando
  // catálogo + monto manual + repuestos, el recibo desglosa esas mismas partes.
  doc.font('Helvetica-Bold').fontSize(12).text('Detalle de cobro', { underline: false })
  doc.moveDown(0.3)
  addRow(doc, 'Subtotal (revisión)', formatMoney(order.revisionAmount))
  if (order.deliveryAmount !== null && order.deliveryAmount !== undefined) {
    addRow(doc, 'Subtotal (delivery)', formatMoney(order.deliveryAmount))
  }
  if (order.partsUsed && order.partsUsed.length > 0) {
    doc.moveDown(0.2)
    doc.font('Helvetica-Bold').fontSize(11).text('Repuestos usados:')
    for (const part of order.partsUsed) {
      const lineTotal = part.quantity * Number(part.unitPriceAtUse ?? 0)
      addRow(doc, `  ${part.productName} (x${part.quantity})`, `$${lineTotal.toFixed(2)}`)
    }
  }
  doc.moveDown(0.2)
  addRow(doc, 'Total presupuesto', formatMoney(order.budget))
  if (order.finalPaymentDetails) {
    const methodEntries = Object.entries(order.finalPaymentDetails)
      .map(([key, value]) => `${key}: ${value}`)
      .join(' — ')
    if (methodEntries) addRow(doc, 'Forma de pago final', methodEntries)
  }
  doc.moveDown(0.5)

  addRow(doc, 'Fecha de entrega', formatDate(order.deliveredAt))

  doc.end()
  return doc
}
