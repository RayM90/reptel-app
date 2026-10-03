import request from 'supertest'
import app from '../app'
import prisma from '../lib/prisma'

// Pruebas de seguridad sobre la API real. Los permisos por rol (403) ya se
// prueban en auth.test.ts y catalog.test.ts. La prueba de fuerza bruta va al
// final: deja bloqueado el login de este archivo (cada archivo de Jest tiene
// su propia instancia de la app y de sus límites).

let adminToken: string
let xssClientId: string | undefined

beforeAll(async () => {
  const res = await request(app).post('/api/auth/login').send({ email: 'admin@reptel.com', password: 'RepTel2024*' })
  adminToken = res.body.data.token
})

afterAll(async () => {
  if (xssClientId) await prisma.client.delete({ where: { id: xssClientId } }).catch(() => {})
})

describe('Seguridad — inyección SQL', () => {
  it('el login con una inyección en el correo y la contraseña no inicia sesión', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: "' OR '1'='1' --", password: "' OR '1'='1" })
    expect(res.status).not.toBe(200)
    expect(res.body.data?.token).toBeUndefined()
  })

  it('la búsqueda de clientes trata la inyección como texto y no devuelve registros', async () => {
    const res = await request(app).get('/api/clients/search').query({ q: "' OR 1=1 --" }).set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(0)
  })

  it('el seguimiento público con una inyección en el número de orden responde 404', async () => {
    const res = await request(app).get(`/api/orders/track/${encodeURIComponent("REP' OR '1'='1")}`)
    expect(res.status).toBe(404)
  })
})

describe('Seguridad — XSS', () => {
  it('un <script> guardado como nombre vuelve como texto plano en JSON y con nosniff', async () => {
    const payload = '<script>alert("xss")</script>'
    const created = await prisma.client.create({
      data: { name: payload, lastName: 'Prueba', idNumber: `V-9${String(Date.now()).slice(-7)}`, phone: '04120000000' },
    })
    xssClientId = created.id
    const res = await request(app).get('/api/clients/search').query({ q: created.idNumber }).set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toMatch(/application\/json/)
    expect(res.headers['x-content-type-options']).toBe('nosniff')
    expect(res.body.data[0].name).toBe(payload)
  })
})

describe('Seguridad — CSRF y CORS', () => {
  it('una petición sin token desde otro sitio se rechaza con 401', async () => {
    const res = await request(app).post('/api/orders/counter').set('Origin', 'http://sitio-malicioso.com').send({})
    expect(res.status).toBe(401)
  })

  it('un origen desconocido no recibe permiso CORS', async () => {
    const res = await request(app).get('/').set('Origin', 'http://sitio-malicioso.com')
    expect(res.headers['access-control-allow-origin']).toBeUndefined()
  })

  it('el panel web sí recibe permiso CORS', async () => {
    const res = await request(app).get('/').set('Origin', 'http://localhost:5173')
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173')
  })
})

describe('Seguridad — sesiones', () => {
  it('sin token → 401', async () => {
    expect((await request(app).get('/api/reports/technicians')).status).toBe(401)
  })

  it('token con formato inválido → 401', async () => {
    const res = await request(app).get('/api/reports/technicians').set('Authorization', 'Bearer abc.def.ghi')
    expect(res.status).toBe(401)
  })

  it('token con el contenido alterado (firma inválida) → 401', async () => {
    const [header, body, signature] = adminToken.split('.')
    const claims = JSON.parse(Buffer.from(body, 'base64url').toString())
    claims['cognito:groups'] = ['ADMIN', 'SUPERADMIN']
    const forged = [header, Buffer.from(JSON.stringify(claims)).toString('base64url'), signature].join('.')
    const res = await request(app).get('/api/reports/technicians').set('Authorization', `Bearer ${forged}`)
    expect(res.status).toBe(401)
  })

  it('después de cerrar sesión, el mismo token ya no sirve', async () => {
    const login = await request(app).post('/api/auth/login').send({ email: 'admin@reptel.com', password: 'RepTel2024*' })
    const token = login.body.data.token
    expect((await request(app).get('/api/reports/technicians').set('Authorization', `Bearer ${token}`)).status).toBe(200)
    const out = await request(app).post('/api/auth/logout').set('Authorization', `Bearer ${token}`).send({ refreshToken: login.body.data.refreshToken })
    expect(out.status).toBe(200)
    expect((await request(app).get('/api/reports/technicians').set('Authorization', `Bearer ${token}`)).status).toBe(401)
  })
})

describe('Seguridad — fuerza bruta (al final: deja el login bloqueado en este archivo)', () => {
  it('después de 10 intentos fallidos, el login responde 429', async () => {
    const statuses: number[] = []
    for (let i = 0; i < 12; i++) {
      const r = await request(app).post('/api/auth/login').send({ email: `no-existe-${Date.now()}-${i}@reptel.test`, password: 'Incorrecta123*' })
      statuses.push(r.status)
    }
    // Los intentos fallidos de otras pruebas de este archivo también cuentan,
    // así que el bloqueo llega como máximo en el intento 11.
    const firstBlocked = statuses.indexOf(429)
    expect(firstBlocked).toBeGreaterThan(-1)
    expect(firstBlocked).toBeLessThanOrEqual(10)
    expect(statuses.slice(firstBlocked).every((s) => s === 429)).toBe(true)
  }, 60000)
})
