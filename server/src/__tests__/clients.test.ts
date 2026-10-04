import request from 'supertest'
import app from '../app'
import { authorize } from '../middleware/auth.middleware'
import prisma from '../lib/prisma'
import * as authService from '../modules/auth/auth.service'

const fullAddress = {
  addressState: 'Carabobo',
  addressCity: 'Valencia',
  addressNeighborhood: 'La Trigaleña',
  addressStreet: 'Calle 5',
  addressBuilding: 'Casa 12',
}

let cognitoCreateSpy: jest.SpyInstance
let cognitoDeleteSpy: jest.SpyInstance

beforeEach(() => {
  // Nunca crear usuarios reales en Cognito desde los tests.
  cognitoCreateSpy = jest.spyOn(authService, 'createClientCognitoAccount').mockResolvedValue(undefined)
  cognitoDeleteSpy = jest.spyOn(authService, 'deleteCognitoUser').mockResolvedValue(undefined)
})

afterEach(() => {
  jest.restoreAllMocks()
})

const uniqueEmail = (tag: string) => `cli-${tag}-${Date.now()}-${Math.floor(Math.random() * 1e4)}@reptel-test.com`

const cleanupClient = async (clientId: string) => {
  await prisma.user.deleteMany({ where: { clientId } })
  await prisma.clientAddress.deleteMany({ where: { clientId } })
  await prisma.client.delete({ where: { id: clientId } }).catch(() => {})
}

let adminToken: string

beforeAll(async () => {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: 'admin@reptel.com', password: 'RepTel2024*' })
  adminToken = res.body.data.token
}, 20000)

describe('Clients — protección de rutas', () => {
  it('GET /api/clients sin token debe retornar 401', async () => {
    const res = await request(app).get('/api/clients')
    expect(res.status).toBe(401)
  })

  it('GET /api/clients/search sin token debe retornar 401', async () => {
    const res = await request(app).get('/api/clients/search?q=test')
    expect(res.status).toBe(401)
  })

  it('POST /api/clients sin token debe retornar 401', async () => {
    const res = await request(app).post('/api/clients').send({})
    expect(res.status).toBe(401)
  })

  it('GET /api/clients con token ADMIN debe retornar 200', async () => {
    const res = await request(app)
      .get('/api/clients')
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
  }, 10000)
})

describe('Clients — validación de formato venezolano', () => {
  it('POST /api/clients retorna 400 si la cédula no tiene formato V/E-dígitos', async () => {
    const res = await request(app)
      .post('/api/clients')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Test', lastName: 'Cliente', idNumber: '12345678', phone: '04121234567' })

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/cédula/i)
  })

  it('POST /api/clients retorna 400 si el teléfono no es un número venezolano válido', async () => {
    const res = await request(app)
      .post('/api/clients')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Test', lastName: 'Cliente', idNumber: `V-${String(Date.now()).slice(-7)}`, phone: '123456' })

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/teléfono/i)
  })
})

describe('Clients — authorize() rechaza roles no-ADMIN (unitario, sin depender de un usuario CLIENT sembrado)', () => {
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

describe('Clients — persona natural vs. empresa (J-/G-)', () => {
  it('POST /api/clients retorna 400 si falta el apellido para un prefijo V/E (persona natural)', async () => {
    const res = await request(app)
      .post('/api/clients')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Test', idNumber: `V-${String(Date.now()).slice(-7)}`, phone: '04121234567' })

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/apellido/i)
  })

  it('POST /api/clients crea el cliente sin apellido cuando el prefijo es J- (empresa)', async () => {
    const idNumber = `J-${String(Date.now()).slice(-9)}`
    const res = await request(app)
      .post('/api/clients')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Constructora Test, C.A.', idNumber, phone: '04121234567', email: uniqueEmail('j'), ...fullAddress })

    expect(res.status).toBe(201)
    expect(res.body.data.lastName).toBe('')
    await cleanupClient(res.body.data.id)
  })

  it('POST /api/clients crea el cliente sin apellido cuando el prefijo es G- (gobierno) y guarda contactPerson', async () => {
    const idNumber = `G-${String(Date.now()).slice(-9)}`
    const res = await request(app)
      .post('/api/clients')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Alcaldía Test', idNumber, phone: '04121234567', contactPerson: 'Ana Pérez', email: uniqueEmail('g'), ...fullAddress })

    expect(res.status).toBe(201)
    expect(res.body.data.lastName).toBe('')
    expect(res.body.data.contactPerson).toBe('Ana Pérez')
    await cleanupClient(res.body.data.id)
  })
})

describe('Clients — dirección vía ClientAddress', () => {
  let createdClientId: string
  const testIdNumber = `V-${String(Date.now()).slice(-7)}`

  afterAll(async () => {
    if (createdClientId) await cleanupClient(createdClientId)
  })

  it('POST /api/clients crea una fila ClientAddress principal y la API la devuelve aplanada', async () => {
    const res = await request(app)
      .post('/api/clients')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Cliente',
        lastName: 'DePrueba',
        idNumber: testIdNumber,
        phone: '04121234567',
        email: uniqueEmail('addr'),
        addressState: 'Carabobo',
        addressCity: 'Valencia',
        addressNeighborhood: 'La Trigaleña',
        addressStreet: 'Calle 5',
        addressBuilding: 'Casa 12',
      })

    expect(res.status).toBe(201)
    expect(res.body.data.addressState).toBe('Carabobo')
    expect(res.body.data.addressBuilding).toBe('Casa 12')
    createdClientId = res.body.data.id

    const rows = await prisma.clientAddress.findMany({ where: { clientId: createdClientId } })
    expect(rows).toHaveLength(1)
    expect(rows[0].isPrimary).toBe(true)
    expect(rows[0].label).toBe('Principal')
  }, 15000)

  it('PATCH /api/clients/:id actualiza la fila ClientAddress principal existente (no crea una segunda)', async () => {
    const res = await request(app)
      .patch(`/api/clients/${createdClientId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ addressCity: 'Naguanagua' })

    expect(res.status).toBe(200)
    expect(res.body.data.addressCity).toBe('Naguanagua')
    expect(res.body.data.addressState).toBe('Carabobo') // no se pierde lo que no vino en el PATCH

    const rows = await prisma.clientAddress.findMany({ where: { clientId: createdClientId } })
    expect(rows).toHaveLength(1)
  })

  it('GET /api/clients/idnumber/:idNumber devuelve la dirección aplanada', async () => {
    const res = await request(app)
      .get(`/api/clients/idnumber/${testIdNumber}`)
      .set('Authorization', `Bearer ${adminToken}`)

    expect(res.status).toBe(200)
    expect(res.body.data.addressCity).toBe('Naguanagua')
    expect(res.body.data.addresses).toBeUndefined() // no se filtra el array crudo en la respuesta
  })
})

describe('Clients — registro de mostrador con acceso a la app', () => {
  const created: string[] = []
  afterAll(async () => {
    for (const id of created) await cleanupClient(id)
  })

  it('retorna 400 si falta el correo', async () => {
    const res = await request(app)
      .post('/api/clients')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Sin', lastName: 'Correo', idNumber: `V-${String(Date.now()).slice(-8)}`, phone: '04121234567', ...fullAddress })
    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/correo/i)
    expect(cognitoCreateSpy).not.toHaveBeenCalled()
  })

  it('retorna 400 si la dirección está incompleta', async () => {
    const { addressBuilding, ...partial } = fullAddress
    const res = await request(app)
      .post('/api/clients')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Dir', lastName: 'Incompleta', idNumber: `V-${String(Date.now()).slice(-8)}`, phone: '04121234567', email: uniqueEmail('dir'), ...partial })
    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/dirección/i)
    expect(cognitoCreateSpy).not.toHaveBeenCalled()
  })

  it('retorna 400 si el correo ya pertenece a una cuenta de la app, sin tocar Cognito', async () => {
    const res = await request(app)
      .post('/api/clients')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Correo', lastName: 'Usado', idNumber: `V-${String(Date.now()).slice(-8)}`, phone: '04121234567', email: 'admin@reptel.com', ...fullAddress })
    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/ya pertenece a una cuenta/i)
    expect(cognitoCreateSpy).not.toHaveBeenCalled()
  })

  it('crea Client + User vinculado y devuelve la clave provisional Reptel.NNNN', async () => {
    const email = uniqueEmail('ok')
    const res = await request(app)
      .post('/api/clients')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Luis', lastName: 'Gómez', idNumber: `V-${String(Date.now()).slice(-8)}`, phone: '04125550011', email, ...fullAddress })

    expect(res.status).toBe(201)
    expect(res.body.tempPassword).toMatch(/^Reptel\.\d{4}$/)
    created.push(res.body.data.id)

    expect(cognitoCreateSpy).toHaveBeenCalledWith(email, 'Luis', 'Gómez', res.body.tempPassword)
    const user = await prisma.user.findUnique({ where: { email } })
    expect(user?.clientId).toBe(res.body.data.id)
    expect(user?.role).toBe('CLIENT')
  })

  it('si falla la BD después de Cognito, borra el usuario de Cognito y no deja el cliente', async () => {
    const email = uniqueEmail('rollback')
    const idNumber = `V-${String(Date.now()).slice(-8)}`
    jest.spyOn(prisma, '$transaction').mockRejectedValueOnce(new Error('falla simulada'))

    const res = await request(app)
      .post('/api/clients')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Roll', lastName: 'Back', idNumber, phone: '04121234567', email, ...fullAddress })

    expect(res.status).toBe(500)
    expect(cognitoDeleteSpy).toHaveBeenCalledWith(email)
    expect(await prisma.client.findUnique({ where: { idNumber } })).toBeNull()
  })
})
