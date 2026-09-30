import request from 'supertest'
import app from '../app'
import prisma from '../lib/prisma'
import { parseVenezuelaDay, venezuelaDayKey } from '../modules/reports/reports.dates'

describe('reports.dates', () => {
  it('interpreta YYYY-MM-DD como día completo de Venezuela (UTC-4)', () => {
    expect(parseVenezuelaDay('2026-09-24', 'start')!.toISOString()).toBe('2026-09-24T04:00:00.000Z')
    expect(parseVenezuelaDay('2026-09-24', 'end')!.toISOString()).toBe('2026-09-25T03:59:59.999Z')
  })

  it('rechaza formatos inválidos', () => {
    expect(parseVenezuelaDay('24/09/2026', 'start')).toBeNull()
    expect(parseVenezuelaDay('2026-13-40', 'start')).toBeNull()
  })

  it('venezuelaDayKey devuelve el día local aunque en UTC ya sea el siguiente', () => {
    expect(venezuelaDayKey(new Date('2026-09-25T02:00:00Z'))).toBe('2026-09-24')
    expect(venezuelaDayKey(new Date('2026-09-25T05:00:00Z'))).toBe('2026-09-25')
  })
})

describe('GET /api/reports/audit — filtro de un solo día', () => {
  it('una orden creada a las 11:00 de Venezuela aparece al filtrar ese mismo día', async () => {
    const login = await request(app).post('/api/auth/login').send({ email: 'admin@reptel.com', password: 'RepTel2024*' })
    const token = login.body.data.token
    const suffix = Date.now()
    const client = await prisma.client.create({
      data: { name: 'Cliente', lastName: 'Fechas', idNumber: `TEST-DATES-${suffix}`, phone: '0000000009' },
    })
    const dev = await prisma.device.create({ data: { type: 'LAPTOP', brand: 'Dell', model: 'Fechas' } })
    const order = await prisma.order.create({
      data: {
        orderNumber: `REP-DATES-${suffix}`, status: 'RECEIVED', problem: 'fechas',
        clientId: client.id, deviceId: dev.id, receivedAt: new Date('2026-06-10T15:00:00Z'),
      },
    })
    try {
      const sameDay = await request(app)
        .get(`/api/reports/audit?from=2026-06-10&to=2026-06-10&clientId=${client.id}`)
        .set('Authorization', `Bearer ${token}`)
      expect(sameDay.body.data.map((o: any) => o.orderId)).toEqual([order.id])

      const dayBefore = await request(app)
        .get(`/api/reports/audit?from=2026-06-09&to=2026-06-09&clientId=${client.id}`)
        .set('Authorization', `Bearer ${token}`)
      expect(dayBefore.body.data).toEqual([])
    } finally {
      await prisma.order.delete({ where: { id: order.id } }).catch(() => {})
      await prisma.device.delete({ where: { id: dev.id } }).catch(() => {})
      await prisma.client.delete({ where: { id: client.id } }).catch(() => {})
    }
  }, 20000)
})
