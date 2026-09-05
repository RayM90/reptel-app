import prisma from '../lib/prisma'
import { getDeviceById } from '../modules/devices/devices.service'

let clientA: { id: string }
let clientB: { id: string }
let deviceA: { id: string }

beforeAll(async () => {
  const suffix = Date.now()

  clientA = await prisma.client.create({
    data: {
      name: 'Cliente',
      lastName: 'Prueba A',
      idNumber: `TEST-DEVICE-A-${suffix}`,
      phone: '0000000000',
      email: `cliente-a-${suffix}@test.com`,
      password: '',
    },
  })

  clientB = await prisma.client.create({
    data: {
      name: 'Cliente',
      lastName: 'Prueba B',
      idNumber: `TEST-DEVICE-B-${suffix}`,
      phone: '0000000000',
      email: `cliente-b-${suffix}@test.com`,
      password: '',
    },
  })

  deviceA = await prisma.device.create({
    data: {
      type: 'LAPTOP',
      brand: 'TestBrand',
      model: 'X1',
      devicePassword: 'secreto123',
    },
  })

  await prisma.order.create({
    data: {
      orderNumber: `TEST-DEVICE-ORDER-${suffix}`,
      clientId: clientA.id,
      deviceId: deviceA.id,
      problem: 'Prueba automatizada — IDOR devices',
    },
  })
}, 20000)

afterAll(async () => {
  await prisma.order.deleteMany({ where: { deviceId: deviceA.id } })
  await prisma.device.delete({ where: { id: deviceA.id } }).catch(() => {})
  await prisma.client.delete({ where: { id: clientA.id } }).catch(() => {})
  await prisma.client.delete({ where: { id: clientB.id } }).catch(() => {})
})

describe('devices.service — getDeviceById (control de propiedad)', () => {

  it('devuelve el dispositivo cuando lo pide el dueño (clientA)', async () => {
    const result = await getDeviceById(deviceA.id, clientA.id)
    expect(result).not.toBeNull()
    expect(result?.id).toBe(deviceA.id)
  })

  it('retorna null cuando lo pide un cliente que no es el dueño (clientB)', async () => {
    const result = await getDeviceById(deviceA.id, clientB.id)
    expect(result).toBeNull()
  })

  it('retorna el dispositivo sin filtrar cuando no se pasa requestingClientId (uso de ADMIN/TÉCNICO)', async () => {
    const result = await getDeviceById(deviceA.id)
    expect(result).not.toBeNull()
    expect(result?.id).toBe(deviceA.id)
  })

})
