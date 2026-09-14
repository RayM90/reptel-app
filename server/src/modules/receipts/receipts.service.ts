import PDFDocument from 'pdfkit'
import path from 'path'
import { formatFullName } from '../../lib/format'

const LOGO_PATH = path.join(process.cwd(), 'assets', 'logo-reptel.png')

// Datos del negocio confirmados por el dueño — se usan tal cual en el
// membrete de los 5 recibos. No son la dirección fiscal completa del taller
// (ver boceto de referencia), sino la versión simplificada que Ray aprobó.
const BUSINESS_NAME = 'RepTel'
const BUSINESS_RIF = 'J-40587644'
const BUSINESS_ADDRESS = 'Av. Urdaneta, Caracas, Venezuela'
const BUSINESS_PHONE = '0424-2440004'

const FOOTER_DISCLAIMER_TEXT = 'Este documento es un recibo interno de pago — no constituye factura fiscal.'

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

// Fila de dos columnas (etiqueta/valor a la izquierda, etiqueta/valor a la
// derecha) — solo la usa el recibo de recepción, que tiene formato de
// formulario en vez de caja de factura (ver boceto aprobado por el dueño).
const addTwoColumnRow = (
  doc: PDFKit.PDFDocument,
  leftLabel: string,
  leftValue: string,
  rightLabel: string,
  rightValue: string
) => {
  const contentWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right
  const gap = 20
  const colWidth = (contentWidth - gap) / 2
  const leftX = doc.page.margins.left
  const rightX = leftX + colWidth + gap
  const startY = doc.y

  doc.font('Helvetica-Bold').fontSize(11).text(`${leftLabel}: `, leftX, startY, { continued: true, width: colWidth })
  doc.font('Helvetica').text(leftValue, { width: colWidth })
  const leftEndY = doc.y

  doc.font('Helvetica-Bold').fontSize(11).text(`${rightLabel}: `, rightX, startY, { continued: true, width: colWidth })
  doc.font('Helvetica').text(rightValue, { width: colWidth })
  const rightEndY = doc.y

  // Si una columna hace wrap a más líneas que la otra (nombres largos de
  // cliente, comunes en Venezuela), el cursor debe quedar en la que terminó
  // más abajo — de lo contrario el siguiente contenido se solapa con la
  // columna que todavía no terminó de escribirse.
  doc.y = Math.max(leftEndY, rightEndY)
  // pdfkit deja doc.x en rightX tras el último text() de la columna derecha
  // (no lo restaura solo). Sin esto, todo el contenido que sigue a la
  // última fila de dos columnas arranca a mitad de página en vez del
  // margen izquierdo.
  doc.x = doc.page.margins.left
  doc.moveDown(0.3)
}

// Línea horizontal que separa secciones dentro del recibo de recepción
// (formato de formulario, ver boceto).
const addSectionDivider = (doc: PDFKit.PDFDocument) => {
  doc.moveDown(0.4)
  const y = doc.y
  doc
    .moveTo(doc.page.margins.left, y)
    .lineTo(doc.page.width - doc.page.margins.right, y)
    .stroke()
  doc.moveDown(0.4)
}

// Bloque "Estado del equipo al recibir/entregar" — mismo tratamiento visual
// en el recibo de recepción (observations) y en el de entrega
// (deliveryObservations). Solo se llama cuando el texto existe.
const addObservationsBlock = (doc: PDFKit.PDFDocument, subtitle: string, text: string) => {
  doc.font('Helvetica-Bold').fontSize(11).text(`${subtitle}:`)
  doc.font('Helvetica').fontSize(11).text(text)
  doc.moveDown(0.5)
}

// Membrete compartido por los 5 recibos: logo, nombre del negocio, dirección,
// teléfono y RIF centrados, una línea horizontal, y debajo el título del
// recibo (mayúsculas) + número de orden. Reemplaza a la vieja addHeader.
const addLetterhead = (doc: PDFKit.PDFDocument, title: string, orderNumber: string) => {
  try {
    doc.image(LOGO_PATH, doc.page.width / 2 - 40, doc.y, { width: 80 })
    doc.moveDown(3.5)
  } catch {
    // Si el logo no está disponible, el recibo se genera igual sin imagen.
  }

  doc.font('Helvetica-Bold').fontSize(14).text(BUSINESS_NAME, { align: 'center' })
  doc.font('Helvetica').fontSize(8)
  doc.text(BUSINESS_ADDRESS, { align: 'center' })
  doc.text(`Tel: ${BUSINESS_PHONE}`, { align: 'center' })
  doc.text(`RIF: ${BUSINESS_RIF}`, { align: 'center' })
  doc.moveDown(0.6)

  const lineY = doc.y
  doc
    .moveTo(doc.page.margins.left, lineY)
    .lineTo(doc.page.width - doc.page.margins.right, lineY)
    .stroke()
  doc.moveDown(0.8)

  doc.font('Helvetica-Bold').fontSize(16).text(title.toUpperCase(), { align: 'center' })
  doc.font('Helvetica').fontSize(11).text(`Orden ${orderNumber}`, { align: 'center' })
  doc.moveDown(1.2)
}

// Disclaimer legal al pie de los 5 recibos — nunca se llama la palabra
// "Factura" ni se menciona IVA/crédito fiscal en ningún recibo (regla legal
// no negociable, ver brief de la tarea).
const addFooterDisclaimer = (doc: PDFKit.PDFDocument) => {
  doc.moveDown(1)
  const lineY = doc.y
  doc
    .moveTo(doc.page.margins.left, lineY)
    .lineTo(doc.page.width - doc.page.margins.right, lineY)
    .stroke()
  doc.moveDown(0.5)
  doc.font('Helvetica').fontSize(8).text(FOOTER_DISCLAIMER_TEXT, { align: 'center' })
}

interface OrderForReceipt {
  orderNumber: string
  problem: string
  diagnosis: string | null
  observations: string | null
  deliveryObservations: string | null
  budget: unknown
  revisionAmount: unknown
  deliveryAmount: unknown
  advancePaymentMethod: string | null
  finalPaymentDetails: Record<string, string> | null
  finalPaymentConfirmedAt: Date | string | null
  budgetAdvanceConfirmedAt: Date | string | null
  budgetAdvanceAmount: unknown
  budgetRejectionReason: string | null
  technicianCommission: unknown
  receivedAt: Date | string | null
  deliveredAt: Date | string | null
  client: { name: string; lastName: string; phone: string }
  technician: { name: string } | null
  device: { type: string; brand: string; model: string; color: string | null; serialNumber: string | null }
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

// Recibo de Recepción — único con formato de FORMULARIO (no de caja de
// factura), siguiendo el boceto físico aprobado por el dueño del negocio:
// pares etiqueta/valor en dos columnas, separados por líneas horizontales
// por sección.
export const generateIntakeReceipt = (order: OrderForReceipt): PDFKit.PDFDocument => {
  const doc = new PDFDocument({ margin: 50 })
  const { title, dateLabel } = getIntakeReceiptLabels(order)

  addLetterhead(doc, title, order.orderNumber)

  addTwoColumnRow(doc, 'Cliente', formatFullName(order.client.name, order.client.lastName), 'Teléf', order.client.phone)
  addTwoColumnRow(
    doc,
    'Equipo/Marca',
    `${DEVICE_TYPE_LABELS[order.device.type] ?? order.device.type} ${order.device.brand}`,
    'Modelo',
    order.device.model
  )
  addTwoColumnRow(doc, 'Serial (ESN)', order.device.serialNumber ?? '—', 'Color', order.device.color ?? '—')

  addSectionDivider(doc)
  doc.font('Helvetica-Bold').fontSize(11).text('Falla reportada:')
  doc.font('Helvetica').fontSize(11).text(order.problem)
  doc.moveDown(0.3)

  if (order.observations && order.observations.trim() !== '') {
    addSectionDivider(doc)
    addObservationsBlock(doc, 'Estado del equipo al recibir', order.observations)
  }

  addSectionDivider(doc)
  addRow(doc, 'Anticipo de revisión pagado', formatMoney(order.revisionAmount))
  if (order.advancePaymentMethod) {
    addRow(doc, 'Método de pago', PAYMENT_METHOD_LABELS[order.advancePaymentMethod] ?? order.advancePaymentMethod)
  }
  addRow(doc, dateLabel, formatDate(order.receivedAt))

  addSectionDivider(doc)
  doc
    .font('Helvetica')
    .fontSize(10)
    .text('El equipo queda sujeto a diagnóstico y presupuesto por parte del técnico.', { align: 'center' })

  addFooterDisclaimer(doc)
  doc.end()
  return doc
}

// Padding interno de las cajas tipo factura (rectángulo alrededor del
// "Detalle de cobro" y del total de cierre).
const BOX_PADDING = 10

// Mide cuánto alto va a ocupar el contenido de una caja, ejecutando
// `renderContent` sobre un documento descartable (mismo ancho/márgenes que
// el recibo real, pero con una altura de página enorme para que pdfkit
// nunca dispare un salto de página mientras medimos). Nunca se pipea ni se
// escribe a disco — solo nos interesa dónde queda `doc.y` al terminar.
const measureBoxedBlockHeight = (
  doc: PDFKit.PDFDocument,
  renderContent: (target: PDFKit.PDFDocument, contentX: number, contentWidth: number) => void,
  contentWidth: number
): number => {
  const measureDoc = new PDFDocument({ margin: doc.page.margins.left, size: [doc.page.width, 5000] })
  const contentX = measureDoc.page.margins.left + BOX_PADDING
  const startY = measureDoc.y
  renderContent(measureDoc, contentX, contentWidth)
  return measureDoc.y - startY
}

// Dibuja un rectángulo alrededor de lo que `renderContent` escriba, con
// padding interno consistente. `renderContent` recibe el documento sobre el
// que debe dibujar (el real o, durante la medición, uno descartable) más la
// x/ancho de contenido ya descontado el padding, para no salirse del
// recuadro.
//
// Antes de dibujar nada medimos el bloque completo y, si no entra en el
// espacio que queda hasta el margen inferior de la página actual, forzamos
// un salto de página ANTES de empezar — así la caja nunca queda partida a
// mitad de camino por el salto de página automático de pdfkit (que resetea
// doc.y a los márgenes de la página nueva sin avisar).
const drawBoxedBlock = (
  doc: PDFKit.PDFDocument,
  renderContent: (target: PDFKit.PDFDocument, contentX: number, contentWidth: number) => void
) => {
  const boxWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right
  const contentWidth = boxWidth - BOX_PADDING * 2

  const estimatedHeight = measureBoxedBlockHeight(doc, renderContent, contentWidth)
  const availableSpace = doc.page.height - doc.page.margins.bottom - doc.y
  if (estimatedHeight + BOX_PADDING * 2 > availableSpace) {
    doc.addPage()
  }

  const boxX = doc.page.margins.left
  const contentX = boxX + BOX_PADDING
  const boxTop = doc.y

  doc.y = boxTop + BOX_PADDING
  renderContent(doc, contentX, contentWidth)

  const boxBottom = doc.y + BOX_PADDING
  doc.rect(boxX, boxTop, boxWidth, boxBottom - boxTop).stroke()
  doc.y = boxBottom
  // Mismo defecto que en addTwoColumnRow: doc.x queda en contentX (margen +
  // padding interno de la caja) tras el último text() de renderContent. Sin
  // esto, todo lo que se escribe después de la caja queda indentado 10pt de
  // más respecto al resto del recibo.
  doc.x = doc.page.margins.left
  doc.moveDown(0.8)
}

// Fila etiqueta/valor confinada al ancho de contenido de una caja (a
// diferencia de addRow, que usa el ancho completo de la página).
const addBoxRow = (doc: PDFKit.PDFDocument, label: string, value: string, x: number, width: number) => {
  doc.font('Helvetica-Bold').fontSize(11).text(`${label}: `, x, doc.y, { continued: true, width })
  doc.font('Helvetica').text(value, { width })
  doc.moveDown(0.3)
}

// Bloque "Detalle de cobro" — lo comparten el recibo de entrega, el de pago
// y el de anticipo de presupuesto (mismo desglose: revisión, delivery,
// repuestos, forma de pago). `paymentMethodLabel` deja a cada llamador su
// propia etiqueta para no cambiar el texto que ya usa cada recibo en
// producción. Envuelto en un rectángulo tipo caja de factura, con el Total
// resaltado en negrita y alineado a la derecha al final.
const addCostBreakdown = (doc: PDFKit.PDFDocument, order: OrderForReceipt, paymentMethodLabel: string) => {
  drawBoxedBlock(doc, (target, contentX, contentWidth) => {
    target.font('Helvetica-Bold').fontSize(12).text('Detalle de cobro', contentX, target.y, { width: contentWidth })
    target.moveDown(0.3)

    addBoxRow(target, 'Subtotal (revisión)', formatMoney(order.revisionAmount), contentX, contentWidth)
    if (order.deliveryAmount !== null && order.deliveryAmount !== undefined) {
      addBoxRow(target, 'Subtotal (delivery)', formatMoney(order.deliveryAmount), contentX, contentWidth)
    }
    if (order.partsUsed && order.partsUsed.length > 0) {
      target.moveDown(0.2)
      target.font('Helvetica-Bold').fontSize(11).text('Repuestos usados:', contentX, target.y, { width: contentWidth })
      for (const part of order.partsUsed) {
        const lineTotal = part.quantity * Number(part.unitPriceAtUse ?? 0)
        addBoxRow(target, `  ${part.productName} (x${part.quantity})`, `$${lineTotal.toFixed(2)}`, contentX, contentWidth)
      }
    }
    if (order.finalPaymentDetails) {
      const methodEntries = Object.entries(order.finalPaymentDetails)
        .map(([key, value]) => `${key}: ${value}`)
        .join(' — ')
      if (methodEntries) addBoxRow(target, paymentMethodLabel, methodEntries, contentX, contentWidth)
    }

    target.moveDown(0.2)
    target
      .font('Helvetica-Bold')
      .fontSize(12)
      .text(`Total: ${formatMoney(order.budget)}`, contentX, target.y, { width: contentWidth, align: 'right' })
  })
}

export const generateFinalReceipt = (order: OrderForReceipt): PDFKit.PDFDocument => {
  const doc = new PDFDocument({ margin: 50 })

  addLetterhead(doc, 'Recibo de Entrega', order.orderNumber)

  addRow(doc, 'Cliente', formatFullName(order.client.name, order.client.lastName))
  addRow(doc, 'Técnico asignado', order.technician?.name ?? 'Sin asignar')
  doc.moveDown(0.5)

  addRow(doc, 'Falla reportada', order.problem)
  addRow(doc, 'Diagnóstico', order.diagnosis ?? '—')
  doc.moveDown(0.5)

  addCostBreakdown(doc, order, 'Forma de pago final')

  if (order.deliveryObservations && order.deliveryObservations.trim() !== '') {
    addObservationsBlock(doc, 'Estado del equipo al entregar', order.deliveryObservations)
  }

  addRow(doc, 'Fecha de entrega', formatDate(order.deliveredAt))

  addFooterDisclaimer(doc)
  doc.end()
  return doc
}

// Recibo de Pago — se genera cuando el admin aprueba el pago final
// (PAID_PENDING_DELIVERY), ANTES de que el equipo salga físicamente del
// taller. Mismo desglose de cobro que el recibo de entrega (vía
// addCostBreakdown), pero fechado con finalPaymentConfirmedAt en vez de
// deliveredAt — es la única constancia que tiene el cliente de lo que pagó
// hasta que retire el equipo.
export const generatePaymentReceipt = (order: OrderForReceipt): PDFKit.PDFDocument => {
  const doc = new PDFDocument({ margin: 50 })

  addLetterhead(doc, 'Recibo de Pago', order.orderNumber)

  addRow(doc, 'Cliente', formatFullName(order.client.name, order.client.lastName))
  addRow(doc, 'Técnico asignado', order.technician?.name ?? 'Sin asignar')
  doc.moveDown(0.5)

  addRow(doc, 'Falla reportada', order.problem)
  addRow(doc, 'Diagnóstico', order.diagnosis ?? '—')
  doc.moveDown(0.5)

  addCostBreakdown(doc, order, 'Forma de pago')

  addRow(doc, 'Fecha de pago', formatDate(order.finalPaymentConfirmedAt))

  addFooterDisclaimer(doc)
  doc.end()
  return doc
}

// Recibo de Cierre — se genera cuando el cliente retira su equipo SIN
// reparar, tras rechazar el presupuesto (CANCELLED vía
// markOrderPickedUpUnrepaired). Deja constancia de lo único que sí se cobró
// (revisión + delivery) y del motivo del rechazo. No usa addCostBreakdown
// (el presupuesto fue rechazado, no cobrado) pero sí el mismo tratamiento de
// caja tipo factura con el total resaltado a la derecha.
export const generateClosureReceipt = (order: OrderForReceipt): PDFKit.PDFDocument => {
  const doc = new PDFDocument({ margin: 50 })

  addLetterhead(doc, 'Recibo de Cierre', order.orderNumber)

  addRow(doc, 'Cliente', formatFullName(order.client.name, order.client.lastName))
  doc.moveDown(0.5)

  addRow(doc, 'Falla reportada', order.problem)
  addRow(doc, 'Diagnóstico', order.diagnosis ?? '—')
  addRow(doc, 'Presupuesto rechazado', formatMoney(order.budget))
  addRow(doc, 'Motivo del rechazo', order.budgetRejectionReason ?? '—')
  doc.moveDown(0.5)

  const totalCobrado = Number(order.revisionAmount ?? 0) + Number(order.deliveryAmount ?? 0)
  drawBoxedBlock(doc, (target, contentX, contentWidth) => {
    target
      .font('Helvetica-Bold')
      .fontSize(12)
      .text('Total cobrado (revisión, sin reparación)', contentX, target.y, { width: contentWidth })
    target.moveDown(0.3)

    addBoxRow(target, 'Subtotal (revisión)', formatMoney(order.revisionAmount), contentX, contentWidth)
    if (order.deliveryAmount !== null && order.deliveryAmount !== undefined) {
      addBoxRow(target, 'Subtotal (delivery)', formatMoney(order.deliveryAmount), contentX, contentWidth)
    }

    target.moveDown(0.2)
    target
      .font('Helvetica-Bold')
      .fontSize(12)
      .text(`Total: $${totalCobrado.toFixed(2)}`, contentX, target.y, { width: contentWidth, align: 'right' })
  })

  addRow(doc, 'Fecha de retiro', formatDate(order.deliveredAt))

  addFooterDisclaimer(doc)
  doc.end()
  return doc
}

// Recibo de Anticipo de Presupuesto — se genera cuando se completa el 50%
// del presupuesto (kind BUDGET en AdvancePaymentSubmission), que ahora es
// lo que autoriza al técnico a reparar. Mismo desglose de cobro (vía
// addCostBreakdown) que el recibo de pago/entrega, fechado con
// budgetAdvanceConfirmedAt.
export const generateBudgetAdvanceReceipt = (order: OrderForReceipt): PDFKit.PDFDocument => {
  const doc = new PDFDocument({ margin: 50 })

  addLetterhead(doc, 'Recibo de Anticipo de Presupuesto', order.orderNumber)

  addRow(doc, 'Cliente', formatFullName(order.client.name, order.client.lastName))
  addRow(doc, 'Técnico asignado', order.technician?.name ?? 'Sin asignar')
  doc.moveDown(0.5)

  addRow(doc, 'Falla reportada', order.problem)
  addRow(doc, 'Diagnóstico', order.diagnosis ?? '—')
  doc.moveDown(0.5)

  addCostBreakdown(doc, order, 'Forma de pago')

  addRow(doc, 'Anticipo pagado', formatMoney(order.budgetAdvanceAmount))
  addRow(doc, 'Fecha de anticipo', formatDate(order.budgetAdvanceConfirmedAt))

  addFooterDisclaimer(doc)
  doc.end()
  return doc
}
