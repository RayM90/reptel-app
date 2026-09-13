import request from 'supertest'
import prisma from '../lib/prisma'
import app from '../app'
import { deriveDestination, registerMerma } from '../modules/products/products.service'
import { useProductInOrder } from '../modules/orders/orders.service'

describe('deriveDestination', () => {
  it('TECHNICIAN_DELIVERY (motorizado) → DOMICILIO_CLIENTE', () => {
    expect(deriveDestination('TECHNICIAN_DELIVERY')).toBe('DOMICILIO_CLIENTE')
  })

  it('TECHNICIAN (mostrador) → TALLER', () => {
    expect(deriveDestination('TECHNICIAN')).toBe('TALLER')
  })

  it('ADMIN → TIENDA', () => {
    expect(deriveDestination('ADMIN')).toBe('TIENDA')
  })

  it('cualquier otro rol → TIENDA (default seguro)', () => {
    expect(deriveDestination('CLIENT')).toBe('TIENDA')
  })
})

describe('useProductInOrder — destination se auto-completa', () => {
  let client: { id: string }
  let device: { id: string }
  let technician: { id: string; email: string }
  let order: { id: string }
  let product: { id: string }

  beforeAll(async () => {
    const suffix = Date.now()
    client = await prisma.client.create({
      data: { name: 'Cliente', lastName: 'Destino', idNumber: `TEST-DEST-${suffix}`, phone: '0000000000', email: `cliente-dest-${suffix}@test.com` },
    })
    device = await prisma.device.create({ data: { type: 'LAPTOP', brand: 'TestBrand', model: 'X1' } })
    technician = await prisma.user.create({
      data: { name: 'Tecnico', lastName: 'Motorizado', email: `tecnico-dest-${suffix}@test.com`, role: 'TECHNICIAN_DELIVERY', password: 'COGNITO_MANAGED' },
    })
    order = await prisma.order.create({
      data: { orderNumber: `TEST-DEST-ORDER-${suffix}`, clientId: client.id, deviceId: device.id, problem: 'Prueba destination', technicianId: technician.id },
    })
    const category = await prisma.productCategory.findFirst({ where: { isActive: true } })
    product = await prisma.product.create({
      data: { name: `Producto destino ${suffix}`, price: 10, stock: 5, categoryId: category!.id },
    })
  }, 20000)

  afterAll(async () => {
    await prisma.inventoryMovement.deleteMany({ where: { productId: product.id } })
    await prisma.product.delete({ where: { id: product.id } }).catch(() => {})
    await prisma.orderStatusHistory.deleteMany({ where: { orderId: order.id } })
    await prisma.order.delete({ where: { id: order.id } }).catch(() => {})
    await prisma.device.delete({ where: { id: device.id } }).catch(() => {})
    await prisma.user.delete({ where: { id: technician.id } }).catch(() => {})
    await prisma.client.delete({ where: { id: client.id } }).catch(() => {})
  })

  it('un técnico motorizado usando un repuesto deja destination=DOMICILIO_CLIENTE', async () => {
    const { movement } = await useProductInOrder(order.id, product.id, 1, technician.email)
    expect(movement.destination).toBe('DOMICILIO_CLIENTE')
  })
})

describe('POST /api/products/:id/restock', () => {
  let adminToken: string
  let product: { id: string; stock: number }

  beforeAll(async () => {
    const loginRes = await request(app).post('/api/auth/login').send({ email: 'admin@reptel.com', password: 'RepTel2024*' })
    adminToken = loginRes.body.data.token
    const category = await prisma.productCategory.findFirst({ where: { isActive: true } })
    product = await prisma.product.create({ data: { name: `Producto restock ${Date.now()}`, price: 5, stock: 2, categoryId: category!.id } })
  }, 20000)

  afterAll(async () => {
    await prisma.inventoryMovement.deleteMany({ where: { productId: product.id } })
    await prisma.product.delete({ where: { id: product.id } }).catch(() => {})
  })

  it('sin token retorna 401', async () => {
    const res = await request(app).post(`/api/products/${product.id}/restock`).send({ quantity: 5 })
    expect(res.status).toBe(401)
  })

  it('incrementa el stock y crea un movimiento IN con proveedor', async () => {
    const res = await request(app)
      .post(`/api/products/${product.id}/restock`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ quantity: 10, supplierName: 'Distribuidora Ejemplo' })

    expect(res.status).toBe(200)
    expect(res.body.data.product.stock).toBe(12)

    const movement = await prisma.inventoryMovement.findFirst({
      where: { productId: product.id, type: 'IN' },
      orderBy: { createdAt: 'desc' },
    })
    expect(movement?.quantity).toBe(10)
    expect(movement?.supplierName).toBe('Distribuidora Ejemplo')
    expect(movement?.channel).toBe('AJUSTE_MANUAL')
  })

  it('retorna 400 si quantity no es positivo', async () => {
    const res = await request(app)
      .post(`/api/products/${product.id}/restock`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ quantity: 0 })
    expect(res.status).toBe(400)
  })

  it('retorna 404 si el producto no existe', async () => {
    const res = await request(app)
      .post('/api/products/00000000-0000-0000-0000-000000000000/restock')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ quantity: 5 })
    expect(res.status).toBe(404)
  })
})

describe('POST /api/products/:id/merma', () => {
  let adminToken: string
  let technician: { id: string; email: string }
  let product: { id: string; stock: number }

  beforeAll(async () => {
    const loginRes = await request(app).post('/api/auth/login').send({ email: 'admin@reptel.com', password: 'RepTel2024*' })
    adminToken = loginRes.body.data.token

    const category = await prisma.productCategory.findFirst({ where: { isActive: true } })
    product = await prisma.product.create({ data: { name: `Producto merma ${Date.now()}`, price: 8, stock: 5, categoryId: category!.id } })

    // No hay cuenta seed de TECHNICIAN con credenciales Cognito conocidas (el login real
    // pasa por Cognito, no por comparación local de password) — se crea el fixture local y
    // se llama registerMerma directo, igual que Task 2 llamó useProductInOrder directo.
    const suffix = Date.now()
    technician = await prisma.user.create({
      data: { name: 'Tecnico', lastName: 'Merma', email: `tecnico-merma-${suffix}@test.com`, role: 'TECHNICIAN', password: 'COGNITO_MANAGED' },
    })
  }, 20000)

  afterAll(async () => {
    await prisma.inventoryMovement.deleteMany({ where: { productId: product.id } })
    await prisma.product.delete({ where: { id: product.id } }).catch(() => {})
    await prisma.user.delete({ where: { id: technician.id } }).catch(() => {})
  })

  it('sin token retorna 401', async () => {
    const res = await request(app).post(`/api/products/${product.id}/merma`).send({ quantity: 1, lossReason: 'PERDIDA', reason: 'x' })
    expect(res.status).toBe(401)
  })

  it('retorna 400 si falta reason (obligatorio)', async () => {
    const res = await request(app)
      .post(`/api/products/${product.id}/merma`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ quantity: 1, lossReason: 'PERDIDA' })
    expect(res.status).toBe(400)
  })

  it('retorna 400 si la cantidad excede el stock disponible', async () => {
    const res = await request(app)
      .post(`/api/products/${product.id}/merma`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ quantity: 999, lossReason: 'PERDIDA', reason: 'Prueba de stock insuficiente' })
    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/stock/i)
  })

  it('retorna 400 si lossReason no es válido (no solo si está ausente)', async () => {
    const res = await request(app)
      .post(`/api/products/${product.id}/merma`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ quantity: 1, lossReason: 'ALGO_INVENTADO', reason: 'Motivo inventado' })
    expect(res.status).toBe(400)
  })

  it('retorna 400 si falta lossReason', async () => {
    const res = await request(app)
      .post(`/api/products/${product.id}/merma`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ quantity: 1, reason: 'Sin motivo de merma' })
    expect(res.status).toBe(400)
  })

  it('ADMIN registra una merma: descuenta stock, crea movimiento OUT/MERMA con destino TIENDA por default', async () => {
    const res = await request(app)
      .post(`/api/products/${product.id}/merma`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ quantity: 2, lossReason: 'DEFECTUOSO', reason: 'Encontrado roto al abrir la caja' })

    expect(res.status).toBe(200)
    expect(res.body.data.product.stock).toBe(3)

    const movement = await prisma.inventoryMovement.findFirst({
      where: { productId: product.id, channel: 'MERMA' },
      orderBy: { createdAt: 'desc' },
    })
    expect(movement?.type).toBe('OUT')
    expect(movement?.lossReason).toBe('DEFECTUOSO')
    expect(movement?.destination).toBe('TIENDA')
    expect(movement?.reason).toBe('Encontrado roto al abrir la caja')
  })

  it('un TECHNICIAN registra una merma exitosamente y el destino se auto-deriva a TALLER', async () => {
    const { product: updated, movement } = await registerMerma(
      product.id,
      1,
      technician.email,
      'PERDIDA',
      'Repuesto perdido por el técnico en el taller',
    )

    expect(updated.stock).toBe(2)
    expect(movement.channel).toBe('MERMA')
    expect(movement.destination).toBe('TALLER')
  })

  it('ADMIN puede sobreescribir destination explícitamente (no usa el default TIENDA)', async () => {
    const res = await request(app)
      .post(`/api/products/${product.id}/merma`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ quantity: 1, lossReason: 'OTRO', reason: 'Entregado directo a domicilio por error', destination: 'DOMICILIO_CLIENTE' })

    expect(res.status).toBe(200)

    const movement = await prisma.inventoryMovement.findFirst({
      where: { productId: product.id, channel: 'MERMA' },
      orderBy: { createdAt: 'desc' },
    })
    expect(movement?.destination).toBe('DOMICILIO_CLIENTE')
  })
})

describe('GET /api/products/movements — filtros nuevos', () => {
  let adminToken: string
  let product: { id: string }
  let technician: { id: string; email: string }

  beforeAll(async () => {
    const loginRes = await request(app).post('/api/auth/login').send({ email: 'admin@reptel.com', password: 'RepTel2024*' })
    adminToken = loginRes.body.data.token

    const category = await prisma.productCategory.findFirst({ where: { isActive: true } })
    product = await prisma.product.create({ data: { name: `Producto filtros ${Date.now()}`, price: 3, stock: 20, categoryId: category!.id } })
    technician = await prisma.user.create({
      data: { name: 'Tecnico', lastName: 'Filtro', email: `tecnico-filtro-${Date.now()}@test.com`, role: 'TECHNICIAN_DELIVERY', password: 'COGNITO_MANAGED' },
    })

    // Fixture: una entrada con proveedor, una merma con destino/lossReason.
    await prisma.inventoryMovement.create({
      data: { productId: product.id, type: 'IN', channel: 'AJUSTE_MANUAL', quantity: 10, reason: 'Compra', supplierName: 'Proveedor Filtro Test' },
    })
    await prisma.inventoryMovement.create({
      data: { productId: product.id, type: 'OUT', channel: 'MERMA', quantity: 1, reason: 'Prueba', lossReason: 'PERDIDA', destination: 'TALLER', userId: technician.id },
    })
  }, 20000)

  afterAll(async () => {
    await prisma.inventoryMovement.deleteMany({ where: { productId: product.id } })
    await prisma.product.delete({ where: { id: product.id } }).catch(() => {})
    await prisma.user.delete({ where: { id: technician.id } }).catch(() => {})
  })

  it('filtra por type=IN', async () => {
    const res = await request(app)
      .get('/api/products/movements')
      .set('Authorization', `Bearer ${adminToken}`)
      .query({ productId: product.id, type: 'IN' })
    expect(res.status).toBe(200)
    expect(res.body.data.every((m: any) => m.type === 'IN')).toBe(true)
    expect(res.body.data.some((m: any) => m.supplierName === 'Proveedor Filtro Test')).toBe(true)
  })

  it('filtra por destination', async () => {
    const res = await request(app)
      .get('/api/products/movements')
      .set('Authorization', `Bearer ${adminToken}`)
      .query({ productId: product.id, destination: 'TALLER' })
    expect(res.status).toBe(200)
    expect(res.body.data.every((m: any) => m.destination === 'TALLER')).toBe(true)
  })

  it('filtra por technicianRole', async () => {
    const res = await request(app)
      .get('/api/products/movements')
      .set('Authorization', `Bearer ${adminToken}`)
      .query({ productId: product.id, technicianRole: 'TECHNICIAN_DELIVERY' })
    expect(res.status).toBe(200)
    expect(res.body.data.length).toBeGreaterThan(0)
    expect(res.body.data.every((m: any) => m.user?.role === 'TECHNICIAN_DELIVERY')).toBe(true)
  })

  it('filtra por lossReason', async () => {
    const res = await request(app)
      .get('/api/products/movements')
      .set('Authorization', `Bearer ${adminToken}`)
      .query({ productId: product.id, lossReason: 'PERDIDA' })
    expect(res.status).toBe(200)
    expect(res.body.data.every((m: any) => m.lossReason === 'PERDIDA')).toBe(true)
  })

  it('filtro "to" incluye movimientos del mismo día (no solo hasta medianoche UTC)', async () => {
    const todayStr = new Date().toISOString().slice(0, 10) // YYYY-MM-DD

    const res = await request(app)
      .get('/api/products/movements')
      .set('Authorization', `Bearer ${adminToken}`)
      .query({ productId: product.id, to: todayStr })

    expect(res.status).toBe(200)
    // El fixture del beforeAll (entrada IN + merma OUT) fue creado "hoy" (más tarde
    // que medianoche UTC en la enorme mayoría de zonas horarias reales); con to=hoy
    // debe seguir apareciendo, no ser excluido por interpretar "to" como medianoche.
    expect(res.body.data.some((m: any) => m.supplierName === 'Proveedor Filtro Test')).toBe(true)
  })
})
