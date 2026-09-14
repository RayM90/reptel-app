import prisma from '../lib/prisma'
import { getReportSummary } from '../modules/reports/reports.service'

let clientA: { id: string; name: string; lastName: string; idNumber: string }
let clientB: { id: string; name: string; lastName: string; idNumber: string }
let technicianX: { id: string; name: string }
let technicianY: { id: string; name: string }
let device: { id: string }

const IN_RANGE = new Date('2026-06-15T12:00:00Z')
const OUT_OF_RANGE = new Date('2026-07-15T12:00:00Z')
const RANGE_FROM = new Date('2026-06-01T00:00:00Z')
const RANGE_TO = new Date('2026-06-30T23:59:59Z')

beforeAll(async () => {
  const suffix = Date.now()

  clientA = await prisma.client.create({
    data: {
      name: 'Cliente', lastName: 'Reportes',
      idNumber: `TEST-REPORTS-A-${suffix}`, phone: '0000000003',
      email: `cliente-reportes-a-${suffix}@test.com`,
    },
  })

  clientB = await prisma.client.create({
    data: {
      name: 'Cliente', lastName: 'ReportesB',
      idNumber: `TEST-REPORTS-B-${suffix}`, phone: '0000000004',
      email: `cliente-reportes-b-${suffix}@test.com`,
    },
  })

  technicianX = await prisma.user.create({
    data: {
      name: 'Técnico X', email: `tecnico-x-reportes-${suffix}@test.com`,
      password: 'x', role: 'TECHNICIAN_DELIVERY',
    },
  })

  technicianY = await prisma.user.create({
    data: {
      name: 'Técnico Y', email: `tecnico-y-reportes-${suffix}@test.com`,
      password: 'x', role: 'TECHNICIAN_DELIVERY',
    },
  })

  device = await prisma.device.create({
    data: { type: 'LAPTOP', brand: 'Dell', model: 'Inspiron' },
  })

  // Orden dentro del rango, técnico X
  await prisma.order.create({
    data: {
      orderNumber: `REP-RPT-${suffix}-1`,
      status: 'DELIVERED',
      problem: 'Test reportes 1',
      budget: 100, technicianCommission: 40,
      clientId: clientA.id, deviceId: device.id, technicianId: technicianX.id,
      deliveredAt: IN_RANGE,
    },
  })

  // Segunda orden dentro del rango, mismo técnico X (para probar la suma por técnico)
  await prisma.order.create({
    data: {
      orderNumber: `REP-RPT-${suffix}-2`,
      status: 'DELIVERED',
      problem: 'Test reportes 2',
      budget: 60, technicianCommission: 20,
      clientId: clientA.id, deviceId: device.id, technicianId: technicianX.id,
      deliveredAt: IN_RANGE,
    },
  })

  // Orden dentro del rango, técnico Y
  await prisma.order.create({
    data: {
      orderNumber: `REP-RPT-${suffix}-3`,
      status: 'DELIVERED',
      problem: 'Test reportes 3',
      budget: 80, technicianCommission: 30,
      clientId: clientA.id, deviceId: device.id, technicianId: technicianY.id,
      deliveredAt: IN_RANGE,
    },
  })

  // Orden dentro del rango, cliente B (para probar el filtro/desglose por cliente)
  await prisma.order.create({
    data: {
      orderNumber: `REP-RPT-${suffix}-5`,
      status: 'DELIVERED',
      problem: 'Test reportes cliente B',
      budget: 45, technicianCommission: 15,
      clientId: clientB.id, deviceId: device.id, technicianId: technicianX.id,
      deliveredAt: IN_RANGE,
    },
  })

  // Orden fuera del rango — no debe contarse
  await prisma.order.create({
    data: {
      orderNumber: `REP-RPT-${suffix}-4`,
      status: 'DELIVERED',
      problem: 'Test reportes fuera de rango',
      budget: 999, technicianCommission: 999,
      clientId: clientA.id, deviceId: device.id, technicianId: technicianX.id,
      deliveredAt: OUT_OF_RANGE,
    },
  })
}, 30000)

afterAll(async () => {
  const clientIds = [clientA.id, clientB.id]
  await prisma.orderStatusHistory.deleteMany({ where: { order: { clientId: { in: clientIds } } } })
  await prisma.order.deleteMany({ where: { clientId: { in: clientIds } } })
  await prisma.device.delete({ where: { id: device.id } }).catch(() => {})
  await prisma.user.delete({ where: { id: technicianX.id } }).catch(() => {})
  await prisma.user.delete({ where: { id: technicianY.id } }).catch(() => {})
  await prisma.client.delete({ where: { id: clientA.id } }).catch(() => {})
  await prisma.client.delete({ where: { id: clientB.id } }).catch(() => {})
})

describe('reports.service — getReportSummary', () => {
  it('suma presupuesto y comisión solo de las órdenes dentro del rango', async () => {
    const result = await getReportSummary({ from: RANGE_FROM, to: RANGE_TO })

    expect(result.servicio.ordersCount).toBe(4)
    expect(result.servicio.totalBudget).toBe(285) // 100 + 60 + 80 + 45
    expect(result.servicio.totalTechnicianCommission).toBe(105) // 40 + 20 + 30 + 15
  })

  it('agrupa por técnico correctamente', async () => {
    const result = await getReportSummary({ from: RANGE_FROM, to: RANGE_TO })

    const techX = result.servicio.byTechnician.find((t) => t.technicianId === technicianX.id)
    const techY = result.servicio.byTechnician.find((t) => t.technicianId === technicianY.id)

    expect(techX?.ordersCount).toBe(3) // clientA x2 + clientB x1
    expect(techX?.totalCommission).toBe(75) // 40 + 20 + 15
    expect(techY?.ordersCount).toBe(1)
    expect(techY?.totalCommission).toBe(30)
  })

  it('filtra por technicianId cuando se especifica', async () => {
    const result = await getReportSummary({ from: RANGE_FROM, to: RANGE_TO, technicianId: technicianY.id })

    expect(result.servicio.ordersCount).toBe(1)
    expect(result.servicio.totalBudget).toBe(80)
    expect(result.servicio.byTechnician).toHaveLength(1)
    expect(result.servicio.byTechnician[0].technicianId).toBe(technicianY.id)
  })

  it('agrupa por cliente correctamente', async () => {
    const result = await getReportSummary({ from: RANGE_FROM, to: RANGE_TO })

    const byA = result.servicio.byClient.find((c) => c.clientId === clientA.id)
    const byB = result.servicio.byClient.find((c) => c.clientId === clientB.id)

    expect(byA?.ordersCount).toBe(3) // las 3 órdenes originales de clientA
    expect(byA?.totalBudget).toBe(240) // 100 + 60 + 80
    expect(byB?.ordersCount).toBe(1)
    expect(byB?.totalBudget).toBe(45)
  })

  it('filtra por clientId cuando se especifica', async () => {
    const result = await getReportSummary({ from: RANGE_FROM, to: RANGE_TO, clientId: clientB.id })

    expect(result.servicio.ordersCount).toBe(1)
    expect(result.servicio.orders[0].orderNumber).toContain('-5')
    expect(result.servicio.byClient).toHaveLength(1)
  })

  it('cada orden del detalle incluye orderId (necesario para descargar recibos)', async () => {
    const result = await getReportSummary({ from: RANGE_FROM, to: RANGE_TO, clientId: clientB.id })

    expect(result.servicio.orders[0].orderId).toBeTruthy()
  })

  it('retorna todo en cero cuando no hay datos en el rango', async () => {
    const result = await getReportSummary({
      from: new Date('2020-01-01'),
      to: new Date('2020-01-31'),
    })

    expect(result.servicio.ordersCount).toBe(0)
    expect(result.servicio.totalBudget).toBe(0)
    expect(result.servicio.byTechnician).toEqual([])
    expect(result.servicio.byClient).toEqual([])
  })

  it('incluye el canal (WEB/APK) en cada orden del detalle', async () => {
    const result = await getReportSummary({ from: RANGE_FROM, to: RANGE_TO, clientId: clientB.id })

    expect(result.servicio.orders[0].channel).toBe('WEB')
    expect(result.servicio.orders[0].clientIdNumber).toBe(clientB.idNumber)
  })

  it('filtra por channel APK cuando se especifica', async () => {
    const result = await getReportSummary({ from: RANGE_FROM, to: RANGE_TO, channel: 'APK' })
    expect(result.servicio.ordersCount).toBe(0) // ninguna orden de este fixture tiene deliveryAmount
  })

  it('filtra por channel WEB cuando se especifica', async () => {
    const result = await getReportSummary({ from: RANGE_FROM, to: RANGE_TO, channel: 'WEB' })
    expect(result.servicio.ordersCount).toBe(4) // todas las órdenes del fixture son WEB (sin deliveryAmount)
  })

  it('calcula mermas a partir de InventoryMovement OUT/AJUSTE_MANUAL en el rango', async () => {
    const category = await prisma.productCategory.create({ data: { name: `Cat-Mermas-${Date.now()}` } })
    const product = await prisma.product.create({
      data: { name: `Producto Merma ${Date.now()}`, price: 10, categoryId: category.id },
    })
    await prisma.inventoryMovement.create({
      data: {
        type: 'OUT', channel: 'AJUSTE_MANUAL', quantity: 3, reason: 'Merma de prueba',
        productId: product.id, createdAt: IN_RANGE,
      },
    })

    const result = await getReportSummary({ from: RANGE_FROM, to: RANGE_TO })
    expect(result.mermas.total).toBe(30) // 3 × $10
    expect(result.mermas.count).toBe(1)

    await prisma.inventoryMovement.deleteMany({ where: { productId: product.id } })
    await prisma.product.delete({ where: { id: product.id } })
    await prisma.productCategory.delete({ where: { id: category.id } })
  })
})

import request from 'supertest'
import app from '../app'
import { authorize } from '../middleware/auth.middleware'

let adminToken: string

describe('GET /api/reports/summary', () => {
  beforeAll(async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@reptel.com', password: 'RepTel2024*' })
    adminToken = res.body.data.token
  }, 20000)

  it('sin token retorna 401', async () => {
    const res = await request(app).get('/api/reports/summary?from=2026-06-01&to=2026-06-30')
    expect(res.status).toBe(401)
  })

  it('con token ADMIN y rango válido retorna 200 con la forma esperada', async () => {
    const res = await request(app)
      .get('/api/reports/summary?from=2026-06-01&to=2026-06-30')
      .set('Authorization', `Bearer ${adminToken}`)

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data).toHaveProperty('servicio')
  }, 10000)

  it('sin from/to retorna 400', async () => {
    const res = await request(app)
      .get('/api/reports/summary')
      .set('Authorization', `Bearer ${adminToken}`)

    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
  }, 10000)

  it('con from posterior a to retorna 400', async () => {
    const res = await request(app)
      .get('/api/reports/summary?from=2026-06-30&to=2026-06-01')
      .set('Authorization', `Bearer ${adminToken}`)

    expect(res.status).toBe(400)
  }, 10000)

  it('con technicianId filtra la respuesta (200)', async () => {
    const res = await request(app)
      .get(`/api/reports/summary?from=2026-06-01&to=2026-06-30&technicianId=${technicianY.id}`)
      .set('Authorization', `Bearer ${adminToken}`)

    expect(res.status).toBe(200)
    expect(res.body.data.servicio.ordersCount).toBe(1)
  }, 10000)

  it('con clientId filtra la respuesta (200)', async () => {
    const res = await request(app)
      .get(`/api/reports/summary?from=2026-06-01&to=2026-06-30&clientId=${clientB.id}`)
      .set('Authorization', `Bearer ${adminToken}`)

    expect(res.status).toBe(200)
    expect(res.body.data.servicio.ordersCount).toBe(1)
  }, 10000)
})

describe('reports.service — getAuditReport', () => {
  // Fixture propia (con receivedAt explícito dentro de RANGE) — las órdenes
  // del describe de arriba no fijan receivedAt (queda en "now" real, fuera
  // de RANGE_FROM/RANGE_TO que son fechas fijas de 2026-06), así que audit
  // (que filtra por receivedAt) no las vería.
  it('incluye la orden en el rango, filtra por status/cliente y trae partsUsed', async () => {
    const { getAuditReport } = await import('../modules/reports/reports.service')
    const suffix = Date.now()

    const client = await prisma.client.create({
      data: { name: 'Cliente', lastName: 'Audit', idNumber: `TEST-AUDIT-${suffix}`, phone: '0000000005' },
    })
    const dev = await prisma.device.create({ data: { type: 'LAPTOP', brand: 'Dell', model: 'Audit' } })
    const order = await prisma.order.create({
      data: {
        orderNumber: `REP-AUDIT-${suffix}`,
        status: 'WAITING_PART',
        problem: 'Test audit',
        clientId: client.id,
        deviceId: dev.id,
        receivedAt: IN_RANGE,
      },
    })

    try {
      const all = await getAuditReport({ from: RANGE_FROM, to: RANGE_TO })
      expect(all.some((o) => o.orderId === order.id)).toBe(true)

      const filtered = await getAuditReport({
        from: RANGE_FROM, to: RANGE_TO, status: 'WAITING_PART', clientId: client.id,
      })
      expect(filtered).toHaveLength(1)
      expect(filtered[0].clientIdNumber).toBe(client.idNumber)
      expect(filtered[0].channel).toBe('WEB')
      expect(filtered[0].partsUsed).toEqual([])
    } finally {
      await prisma.order.delete({ where: { id: order.id } }).catch(() => {})
      await prisma.device.delete({ where: { id: dev.id } }).catch(() => {})
      await prisma.client.delete({ where: { id: client.id } }).catch(() => {})
    }
  })
})

describe('GET /api/reports/audit', () => {
  it('sin token retorna 401', async () => {
    const res = await request(app).get('/api/reports/audit?from=2026-06-01&to=2026-06-30')
    expect(res.status).toBe(401)
  })

  it('con token ADMIN retorna 200 con un arreglo', async () => {
    const res = await request(app)
      .get('/api/reports/audit?from=2026-06-01&to=2026-06-30')
      .set('Authorization', `Bearer ${adminToken}`)

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.data)).toBe(true)
  }, 10000)
})

describe('Reports — authorize() rechaza roles no-ADMIN (unitario)', () => {
  it('retorna 403 cuando el usuario no tiene el rol ADMIN', () => {
    const middleware = authorize('ADMIN')
    const req: any = { user: { sub: 'x', email: 'x@x.com', groups: ['CLIENT'] } }
    const json = jest.fn()
    const res: any = { status: jest.fn(() => ({ json })) }
    const next = jest.fn()

    middleware(req, res, next)

    expect(res.status).toHaveBeenCalledWith(403)
    expect(next).not.toHaveBeenCalled()
  })
})
