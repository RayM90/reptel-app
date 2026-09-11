import request from 'supertest'
import app from '../app'
import prisma from '../lib/prisma'
import {
  resolveClientForRegistration,
  buildClientUserCreateData,
} from '../modules/auth/auth.service'

describe('Auth — POST /api/auth/login', () => {

  it('debe retornar 200 y token con credenciales válidas', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'admin@reptel.com',
        password: 'RepTel2024*',
      })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data).toHaveProperty('token')
    expect(res.body.data).toHaveProperty('user')
    expect(res.body.data.user.role).toBe('ADMIN')
  }, 15000)

  it('debe retornar 401 con credenciales incorrectas', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'admin@reptel.com',
        password: 'contraseña_incorrecta',
      })

    expect(res.status).toBe(401)
    expect(res.body).toHaveProperty('message')
  }, 15000)

  it('debe retornar 400 si faltan campos', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'admin@reptel.com',
      })

    expect(res.status).toBe(400)
    expect(res.body).toHaveProperty('message')
  })

})

describe('Auth — POST /api/auth/staff', () => {
  let authToken: string
  let existingStaffUserId: string
  const existingIdNumber = `V-${String(Date.now()).slice(-7)}`

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@reptel.com', password: 'RepTel2024*' })
    authToken = res.body.data.token

    const existing = await prisma.user.create({
      data: {
        email: `staff-fixture-${Date.now()}@reptel.com`,
        name: 'Fixture',
        lastName: 'Existente',
        idNumber: existingIdNumber,
        role: 'TECHNICIAN',
        password: 'no-usado-cognito',
      },
    })
    existingStaffUserId = existing.id
  }, 20000)

  afterAll(async () => {
    await prisma.user.delete({ where: { id: existingStaffUserId } }).catch(() => {})
  })

  it('retorna 403 si el rol no es TECHNICIAN_DELIVERY ni TECHNICIAN (ej. un rol inexistente)', async () => {
    const res = await request(app)
      .post('/api/auth/staff')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        email: 'rol-invalido@reptel.com',
        password: 'Passw0rd!',
        name: 'Test',
        lastName: 'Rol',
        idNumber: `V-${String(Date.now()).slice(-7)}`,
        role: 'DELIVERY',
      })

    expect(res.status).toBe(403)
  })

  it('retorna 400 si faltan campos (lastName/idNumber)', async () => {
    const res = await request(app)
      .post('/api/auth/staff')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ email: 'nuevo@reptel.com', password: 'Passw0rd!', name: 'Nuevo', role: 'TECHNICIAN' })

    expect(res.status).toBe(400)
    expect(res.body).toHaveProperty('message')
  })

  it('retorna 400 si la cédula no tiene formato V/E-dígitos', async () => {
    const res = await request(app)
      .post('/api/auth/staff')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        email: 'formato-invalido@reptel.com',
        password: 'Passw0rd!',
        name: 'Test',
        lastName: 'Formato',
        idNumber: '12345678',
        role: 'TECHNICIAN',
      })

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/cédula/i)
  })

  it('retorna 400 si la cédula ya pertenece a otro empleado (sin llegar a Cognito)', async () => {
    const res = await request(app)
      .post('/api/auth/staff')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        email: 'otro-nuevo@reptel.com',
        password: 'Passw0rd!',
        name: 'Otro',
        lastName: 'Nuevo',
        idNumber: existingIdNumber,
        role: 'TECHNICIAN',
      })

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/cédula/i)
  })
})

describe('Auth — POST /api/auth/register', () => {
  let clienteConCuentaId: string
  let clienteConCuentaUserId: string
  const idNumberConCuenta = `V-${String(Date.now()).slice(-7)}`

  // Cliente walk-in: lo creó Recepción en persona, todavía sin cuenta (User).
  let clienteWalkInId: string
  const idNumberWalkIn = `V-${String(Date.now() + 1).slice(-7)}`
  const phoneWalkIn = '04121234567'

  // Empleado (User) con idNumber propio y SIN Client vinculado — simula una
  // cédula de personal que intenta auto-registrarse como cliente (Fix 3).
  let staffUserId: string
  const idNumberStaff = `V-${String(Date.now() + 2).slice(-7)}`

  beforeAll(async () => {
    const cliente = await prisma.client.create({
      data: {
        name: 'Cliente', lastName: 'ConCuenta', idNumber: idNumberConCuenta, phone: '04120000001',
      },
    })
    clienteConCuentaId = cliente.id

    const usuario = await prisma.user.create({
      data: {
        email: `cliente-con-cuenta-${Date.now()}@test.com`,
        name: 'Cliente', role: 'CLIENT', password: '', clientId: cliente.id,
      },
    })
    clienteConCuentaUserId = usuario.id

    const clienteWalkIn = await prisma.client.create({
      data: {
        name: 'Cliente', lastName: 'WalkIn', idNumber: idNumberWalkIn, phone: phoneWalkIn,
      },
    })
    clienteWalkInId = clienteWalkIn.id

    const staffUser = await prisma.user.create({
      data: {
        email: `staff-idnumber-fixture-${Date.now()}@reptel.com`,
        name: 'Staff', lastName: 'Fixture', idNumber: idNumberStaff,
        role: 'TECHNICIAN', password: 'no-usado-cognito',
      },
    })
    staffUserId = staffUser.id
  }, 20000)

  afterAll(async () => {
    await prisma.user.delete({ where: { id: clienteConCuentaUserId } }).catch(() => {})
    await prisma.client.delete({ where: { id: clienteConCuentaId } }).catch(() => {})
    await prisma.client.delete({ where: { id: clienteWalkInId } }).catch(() => {})
    await prisma.user.delete({ where: { id: staffUserId } }).catch(() => {})
  })

  it('retorna 400 si faltan campos (lastName/idNumber)', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'nuevo-cliente@test.com', password: 'Passw0rd!', name: 'Nuevo', role: 'CLIENT',
      })

    expect(res.status).toBe(400)
    expect(res.body).toHaveProperty('message')
  })

  it('retorna 400 si la cédula no tiene formato V/E-dígitos', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'nuevo-cliente@test.com', password: 'Passw0rd!', name: 'Nuevo', lastName: 'Cliente',
        idNumber: '12345678', role: 'CLIENT',
      })

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/cédula/i)
  })

  it('retorna 400 si la cédula ya tiene una cuenta asociada (sin llegar a Cognito)', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'otro-correo@test.com', password: 'Passw0rd!', name: 'Otro', lastName: 'Nombre',
        idNumber: idNumberConCuenta, role: 'CLIENT',
      })

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/cédula/i)
  })

  it('retorna 403 si el rol no es CLIENT', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'nuevo-staff@test.com', password: 'Passw0rd!', name: 'Nuevo', lastName: 'Staff',
        idNumber: `V-${String(Date.now()).slice(-7)}`, role: 'ADMIN',
      })

    expect(res.status).toBe(403)
  })

  // Fix 1 (seguridad): reutilizar un Client walk-in sin verificar el
  // teléfono permitía apropiarse de la cuenta de otra persona conociendo
  // solo su cédula (no es secreta en Venezuela).
  it('retorna 400 si la cédula pertenece a un cliente walk-in pero el teléfono no coincide (sin llegar a Cognito)', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'impostor@test.com', password: 'Passw0rd!', name: 'Impostor', lastName: 'Apellido',
        idNumber: idNumberWalkIn, phone: '04129999999', role: 'CLIENT',
      })

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/identidad|verificar/i)
  })

  it('retorna 400 si la cédula pertenece a un cliente walk-in y no se envía teléfono (sin llegar a Cognito)', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'sin-telefono@test.com', password: 'Passw0rd!', name: 'Sin', lastName: 'Telefono',
        idNumber: idNumberWalkIn, role: 'CLIENT',
      })

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/identidad|verificar/i)
  })

  // Fix 3: idNumber es @unique en User — una cédula de personal no debe
  // poder colisionar más adelante con un P2002 crudo al auto-registrarse.
  it('retorna 400 si la cédula ya pertenece a un User existente (empleado, sin llegar a Cognito)', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'empleado-intenta-cliente@test.com', password: 'Passw0rd!', name: 'Empleado', lastName: 'Intenta',
        idNumber: idNumberStaff, phone: '04121234567', role: 'CLIENT',
      })

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/cuenta/i)
  })
})

describe('resolveClientForRegistration', () => {
  let clienteWalkInId: string
  let clienteConCuentaId: string
  let clienteConCuentaUserId: string
  const idNumberWalkIn = `V-${String(Date.now() + 10).slice(-7)}`
  const phoneWalkIn = '04121112233'
  const idNumberConCuenta = `V-${String(Date.now() + 11).slice(-7)}`
  const idNumberNuevo = `V-${String(Date.now() + 12).slice(-7)}`

  beforeAll(async () => {
    const clienteWalkIn = await prisma.client.create({
      data: { name: 'Cliente', lastName: 'WalkIn', idNumber: idNumberWalkIn, phone: phoneWalkIn },
    })
    clienteWalkInId = clienteWalkIn.id

    const clienteConCuenta = await prisma.client.create({
      data: { name: 'Cliente', lastName: 'ConCuenta', idNumber: idNumberConCuenta, phone: '04120001111' },
    })
    clienteConCuentaId = clienteConCuenta.id

    const usuario = await prisma.user.create({
      data: {
        email: `resolve-test-${Date.now()}@test.com`,
        name: 'Cliente', role: 'CLIENT', password: '', clientId: clienteConCuenta.id,
      },
    })
    clienteConCuentaUserId = usuario.id
  }, 20000)

  afterAll(async () => {
    await prisma.user.delete({ where: { id: clienteConCuentaUserId } }).catch(() => {})
    await prisma.client.delete({ where: { id: clienteConCuentaId } }).catch(() => {})
    await prisma.client.delete({ where: { id: clienteWalkInId } }).catch(() => {})
  })

  it('cédula nueva (sin Client) → create', async () => {
    const result = await resolveClientForRegistration(idNumberNuevo, '04120000000')
    expect(result).toEqual({ type: 'create' })
  })

  it('cliente walk-in (sin User) + teléfono coincide → reuse con el id correcto', async () => {
    const result = await resolveClientForRegistration(idNumberWalkIn, phoneWalkIn)
    expect(result).toEqual({ type: 'reuse', clientId: clienteWalkInId })
  })

  it('cliente walk-in (sin User) + teléfono NO coincide → verification_failed', async () => {
    const result = await resolveClientForRegistration(idNumberWalkIn, '04120000000')
    expect(result).toEqual({ type: 'verification_failed' })
  })

  it('cliente walk-in (sin User) + teléfono ausente → verification_failed', async () => {
    const result = await resolveClientForRegistration(idNumberWalkIn, undefined)
    expect(result).toEqual({ type: 'verification_failed' })
  })

  it('cliente con User ya vinculado → already_registered (incluso con el teléfono correcto)', async () => {
    const result = await resolveClientForRegistration(idNumberConCuenta, '04120001111')
    expect(result).toEqual({ type: 'already_registered' })
  })
})

describe('buildClientUserCreateData', () => {
  it('incluye lastName e idNumber en el payload de User (Fix 3 — antes se perdían)', () => {
    const data = buildClientUserCreateData(
      'cliente@test.com', 'Nombre', 'Apellido', 'V-12345678', 'CLIENT', '04120000000', 'client-id-123'
    )

    expect(data).toEqual({
      email: 'cliente@test.com',
      name: 'Nombre',
      lastName: 'Apellido',
      idNumber: 'V-12345678',
      role: 'CLIENT',
      phone: '04120000000',
      password: '',
      clientId: 'client-id-123',
    })
  })

  it('usa null para phone/clientId ausentes', () => {
    const data = buildClientUserCreateData(
      'cliente2@test.com', 'Nombre', 'Apellido', 'V-87654321', 'CLIENT', undefined, undefined
    )

    expect(data.phone).toBeNull()
    expect(data.clientId).toBeNull()
  })
})