import prisma from '../lib/prisma'

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

import request from 'supertest'
import app from '../app'
import { authorize } from '../middleware/auth.middleware'

let adminToken: string

beforeAll(async () => {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: 'admin@reptel.com', password: 'RepTel2024*' })
  adminToken = res.body.data.token
}, 20000)

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
        status: 'WAITING_EXTRA_PAYMENT',
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
        from: RANGE_FROM, to: RANGE_TO, status: 'WAITING_EXTRA_PAYMENT', clientId: client.id,
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

describe('reports — monto de una orden con presupuesto rechazado', () => {
  it('muestra solo lo cobrado (revisión + delivery), no el presupuesto rechazado', async () => {
    const { getAuditReport, getClientHistoryReport } = await import('../modules/reports/reports.service')
    const suffix = Date.now()

    const client = await prisma.client.create({
      data: { name: 'Cliente', lastName: 'Rechazo', idNumber: `TEST-RECHAZO-${suffix}`, phone: '0000000006' },
    })
    const dev = await prisma.device.create({ data: { type: 'LAPTOP', brand: 'HP', model: 'Rechazo' } })
    const order = await prisma.order.create({
      data: {
        orderNumber: `REP-RECHAZO-${suffix}`,
        status: 'CANCELLED',
        problem: 'Test rechazo',
        budget: 65, revisionAmount: 15, deliveryAmount: 10,
        budgetApproved: false, budgetRejectionReason: 'No quiere reparar',
        clientId: client.id,
        deviceId: dev.id,
        receivedAt: IN_RANGE,
      },
    })

    try {
      const audit = await getAuditReport({ from: RANGE_FROM, to: RANGE_TO, clientId: client.id })
      expect(audit[0].totalAmount).toBe(25)

      const history = await getClientHistoryReport(client.idNumber)
      expect(history!.history[0].totalAmount).toBe(25)
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

describe('reports.service — getClientHistoryReport', () => {
  it('retorna null si la cédula no existe', async () => {
    const { getClientHistoryReport } = await import('../modules/reports/reports.service')
    const result = await getClientHistoryReport('CEDULA-QUE-NO-EXISTE-999')
    expect(result).toBeNull()
  })

  it('calcula devicesIngresados, totalPaid e historial', async () => {
    const { getClientHistoryReport } = await import('../modules/reports/reports.service')
    const result = await getClientHistoryReport(clientA.idNumber)

    expect(result).not.toBeNull()
    expect(result!.devicesIngresados).toBe(1) // las 4 órdenes de clientA usan el mismo device
    // getClientHistoryReport no filtra por rango de fechas — suma TODAS las
    // DELIVERED del cliente: 100 + 60 + 80 + 999 (la "fuera de rango" también
    // es DELIVERED, solo queda fuera del reporte de resumen por fecha).
    expect(result!.totalPaid).toBe(1239)
    expect(result!.history.length).toBeGreaterThanOrEqual(4)
  })
})

describe('reports.service — getReportTechnicians', () => {
  it('incluye técnicos sin filtrar por isActive/estado', async () => {
    const { getReportTechnicians } = await import('../modules/reports/reports.service')
    const result = await getReportTechnicians()

    expect(result.some((t) => t.id === technicianX.id)).toBe(true)
    expect(result.some((t) => t.id === technicianY.id)).toBe(true)
  })
})

describe('GET /api/reports/client-history/:idNumber', () => {
  it('sin token retorna 401', async () => {
    const res = await request(app).get(`/api/reports/client-history/${clientA.idNumber}`)
    expect(res.status).toBe(401)
  })

  it('con token ADMIN y cédula existente retorna 200', async () => {
    const res = await request(app)
      .get(`/api/reports/client-history/${clientA.idNumber}`)
      .set('Authorization', `Bearer ${adminToken}`)

    expect(res.status).toBe(200)
    expect(res.body.data.client.idNumber).toBe(clientA.idNumber)
  }, 10000)

  it('con cédula inexistente retorna 404', async () => {
    const res = await request(app)
      .get('/api/reports/client-history/CEDULA-QUE-NO-EXISTE-999')
      .set('Authorization', `Bearer ${adminToken}`)

    expect(res.status).toBe(404)
  }, 10000)
})

describe('GET /api/reports/technicians', () => {
  it('con token ADMIN retorna 200 con un arreglo', async () => {
    const res = await request(app)
      .get('/api/reports/technicians')
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
