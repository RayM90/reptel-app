import prisma from '../lib/prisma'

describe('Device.serialNumber único', () => {
  it('rechaza dos dispositivos con el mismo serialNumber', async () => {
    const suffix = Date.now()
    const serial = `SN-DUP-${suffix}`
    const deviceA = await prisma.device.create({ data: { type: 'LAPTOP', brand: 'A', model: 'X', serialNumber: serial } })

    await expect(
      prisma.device.create({ data: { type: 'LAPTOP', brand: 'B', model: 'Y', serialNumber: serial } })
    ).rejects.toThrow()

    await prisma.device.delete({ where: { id: deviceA.id } })
  })

  it('permite múltiples dispositivos sin serialNumber (NULL)', async () => {
    const deviceA = await prisma.device.create({ data: { type: 'LAPTOP', brand: 'A', model: 'X' } })
    const deviceB = await prisma.device.create({ data: { type: 'LAPTOP', brand: 'B', model: 'Y' } })

    expect(deviceA.serialNumber).toBeNull()
    expect(deviceB.serialNumber).toBeNull()

    await prisma.device.delete({ where: { id: deviceA.id } })
    await prisma.device.delete({ where: { id: deviceB.id } })
  })
})
