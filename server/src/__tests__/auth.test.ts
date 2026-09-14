import request from 'supertest'
import app from '../app'
import prisma from '../lib/prisma'

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

describe('Auth — POST /api/auth/request-password-reset', () => {
  it('devuelve 200 con mensaje genérico si el email SÍ existe en el sistema', async () => {
    const res = await request(app)
      .post('/api/auth/request-password-reset')
      .send({ email: 'admin@reptel.com' })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.message).toMatch(/administrador/i)

    const created = await prisma.passwordResetRequest.findFirst({
      where: { email: 'admin@reptel.com' },
      orderBy: { createdAt: 'desc' },
    })
    expect(created).not.toBeNull()
    expect(created?.status).toBe('PENDING')

    // limpieza
    if (created) await prisma.passwordResetRequest.delete({ where: { id: created.id } })
  }, 15000)

  it('devuelve el MISMO mensaje genérico si el email NO existe (no revela si la cuenta existe)', async () => {
    const res = await request(app)
      .post('/api/auth/request-password-reset')
      .send({ email: `no-existe-${Date.now()}@test.com` })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.message).toMatch(/administrador/i)
  }, 15000)

  it('no crea un PasswordResetRequest cuando el email no existe', async () => {
    const fakeEmail = `no-existe-${Date.now()}@test.com`
    await request(app).post('/api/auth/request-password-reset').send({ email: fakeEmail })

    const created = await prisma.passwordResetRequest.findFirst({ where: { email: fakeEmail } })
    expect(created).toBeNull()
  }, 15000)

  it('devuelve 400 si falta el email', async () => {
    const res = await request(app).post('/api/auth/request-password-reset').send({})
    expect(res.status).toBe(400)
  }, 15000)
})

describe('Auth — GET/POST /api/auth/password-reset-requests (ADMIN)', () => {
  let adminToken: string
  let pendingRequestId: string
  const testEmail = `reset-test-${Date.now()}@test.com`

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@reptel.com', password: 'RepTel2024*' })
    adminToken = res.body.data.token

    await prisma.user.create({
      data: { name: 'Reset', lastName: 'Test', email: testEmail, role: 'TECHNICIAN', password: 'no-usado-cognito' },
    })
    const created = await prisma.passwordResetRequest.create({ data: { email: testEmail } })
    pendingRequestId = created.id
  }, 15000)

  afterAll(async () => {
    await prisma.passwordResetRequest.deleteMany({ where: { email: testEmail } })
    await prisma.user.deleteMany({ where: { email: testEmail } })
  })

  it('GET devuelve 401 si quien pide no está autenticado', async () => {
    const res = await request(app).get('/api/auth/password-reset-requests')
    expect(res.status).toBe(401)
  })

  it('GET devuelve 200 con la solicitud pendiente creada', async () => {
    const res = await request(app)
      .get('/api/auth/password-reset-requests')
      .set('Authorization', `Bearer ${adminToken}`)

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.some((r: any) => r.id === pendingRequestId)).toBe(true)
  })

  it('POST resolve devuelve 400 si la contraseña temporal tiene menos de 8 caracteres', async () => {
    const res = await request(app)
      .post(`/api/auth/password-reset-requests/${pendingRequestId}/resolve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ newPassword: 'corta' })

    expect(res.status).toBe(400)
  })

  it('POST resolve devuelve 404 para una solicitud que no existe', async () => {
    const res = await request(app)
      .post('/api/auth/password-reset-requests/00000000-0000-0000-0000-000000000000/resolve')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ newPassword: 'TempPass123' })

    expect(res.status).toBe(404)
  })

  it('POST resolve sobre un usuario que no existe en Cognito falla sin marcar el request resuelto', async () => {
    const res = await request(app)
      .post(`/api/auth/password-reset-requests/${pendingRequestId}/resolve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ newPassword: 'TempPass123' })

    expect(res.status).toBe(400)

    const stillPending = await prisma.passwordResetRequest.findUnique({ where: { id: pendingRequestId } })
    expect(stillPending?.status).toBe('PENDING')
  }, 15000)
})

describe('Auth — POST /api/auth/register (paridad de campos)', () => {
  const baseAddress = {
    addressState: 'Carabobo',
    addressCity: 'Valencia',
    addressNeighborhood: 'La Isabelica',
    addressStreet: 'Av. Bolívar',
    addressBuilding: 'Res. Las Palmas, piso 2',
  }

  it('retorna 400 si falta la cédula', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: `sin-cedula-${Date.now()}@test.com`,
        password: 'Passw0rd!',
        name: 'Sin',
        lastName: 'Cedula',
        phone: '04121234567',
        role: 'CLIENT',
        address: baseAddress,
      })

    expect(res.status).toBe(400)
  })

  it('retorna 400 si la dirección no trae los 5 campos', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: `direccion-incompleta-${Date.now()}@test.com`,
        password: 'Passw0rd!',
        name: 'Direccion',
        lastName: 'Incompleta',
        idNumber: `V-${String(Date.now()).slice(-7)}`,
        phone: '04121234567',
        role: 'CLIENT',
        address: { addressState: 'Carabobo' },
      })

    expect(res.status).toBe(400)
  })

  it('retorna 400 si la segunda dirección viene incompleta (todo o nada)', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: `secundaria-incompleta-${Date.now()}@test.com`,
        password: 'Passw0rd!',
        name: 'Secundaria',
        lastName: 'Incompleta',
        idNumber: `V-${String(Date.now()).slice(-7)}`,
        phone: '04121234567',
        role: 'CLIENT',
        address: baseAddress,
        secondaryAddress: { label: 'Trabajo', addressState: 'Carabobo' },
      })

    expect(res.status).toBe(400)
  })

  // Este describe es el primer test automatizado que ejercita SignUpCommand
  // (auto-registro) — a diferencia de InitiateAuthCommand/AdminCreateUserCommand
  // (login/altas de personal, ya cubiertos en otros describes de este archivo),
  // dispara un `await import()` dentro de @aws-sdk/credential-provider-node que
  // Jest no resuelve sin --experimental-vm-modules (ver "test" en package.json).
  it('retorna 400 si la cédula ya existe, SIN dejar una cuenta de Cognito huérfana', async () => {
    const idNumber = `V-${String(Date.now()).slice(-7)}`
    const firstEmail = `primero-${Date.now()}@test.com`
    const first = await request(app)
      .post('/api/auth/register')
      .send({
        email: firstEmail,
        password: 'Passw0rd!',
        name: 'Primero',
        lastName: 'Registrado',
        idNumber,
        phone: '04121234567',
        role: 'CLIENT',
        address: baseAddress,
      })
    expect(first.status).toBe(201)

    const duplicateEmail = `duplicado-${Date.now()}@test.com`
    const second = await request(app)
      .post('/api/auth/register')
      .send({
        email: duplicateEmail,
        password: 'Passw0rd!',
        name: 'Segundo',
        lastName: 'ConCedulaRepetida',
        idNumber,
        phone: '04121234567',
        role: 'CLIENT',
        address: baseAddress,
      })
    expect(second.status).toBe(400)
    expect(second.body.message).toMatch(/cédula/i)

    // Si Cognito llegó a crear la cuenta duplicada, este login funcionaría
    // (o devolvería un error de challenge, no "credenciales inválidas").
    const loginAttempt = await request(app)
      .post('/api/auth/login')
      .send({ email: duplicateEmail, password: 'Passw0rd!' })
    expect(loginAttempt.status).toBe(401)

    await prisma.client.delete({ where: { idNumber } }).catch(() => {})
    await prisma.user.deleteMany({ where: { email: firstEmail } })
  }, 20000)

  it('registra una empresa (RIF J-) sin apellido, con contactPerson y dirección secundaria', async () => {
    const idNumber = `J-${String(Date.now()).slice(-9)}`
    const email = `empresa-${Date.now()}@test.com`

    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email,
        password: 'Passw0rd!',
        name: 'Constructora ABC, C.A.',
        idNumber,
        phone: '04121234567',
        role: 'CLIENT',
        contactPerson: 'Juan Pérez',
        address: baseAddress,
        secondaryAddress: { label: 'Trabajo', ...baseAddress, addressCity: 'Naguanagua' },
      })

    expect(res.status).toBe(201)

    const client = await prisma.client.findUnique({ where: { idNumber }, include: { addresses: true } })
    expect(client?.lastName).toBe('')
    expect(client?.contactPerson).toBe('Juan Pérez')
    expect(client?.addresses).toHaveLength(2)
    expect(client?.addresses.find((a) => a.isPrimary)?.addressCity).toBe('Valencia')
    expect(client?.addresses.find((a) => !a.isPrimary)?.label).toBe('Trabajo')

    await prisma.clientAddress.deleteMany({ where: { clientId: client!.id } })
    await prisma.client.delete({ where: { idNumber } })
    await prisma.user.deleteMany({ where: { email } })
  }, 20000)
})