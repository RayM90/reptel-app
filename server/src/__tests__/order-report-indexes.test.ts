import prisma from '../lib/prisma'

describe('índices de Order para reportes', () => {
  it('existe un índice compuesto sobre (status, deliveredAt)', async () => {
    const rows: any[] = await prisma.$queryRawUnsafe(`
      SELECT DISTINCT INDEX_NAME FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'order'
        AND COLUMN_NAME = 'status'
    `)
    const names = rows.map((r) => r.INDEX_NAME)
    expect(names.some((n) => n !== 'PRIMARY')).toBe(true)
  })

  it('existe un índice sobre receivedAt', async () => {
    const rows: any[] = await prisma.$queryRawUnsafe(`
      SELECT DISTINCT INDEX_NAME FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'order'
        AND COLUMN_NAME = 'receivedAt'
    `)
    expect(rows.length).toBeGreaterThan(0)
  })
})
