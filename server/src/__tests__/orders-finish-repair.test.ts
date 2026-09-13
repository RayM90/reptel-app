import prisma from '../lib/prisma'
import {
  CONCURRENT_FINAL_PAYMENT_ERROR,
  CONCURRENT_FINISH_REPAIR_ERROR,
  addBudgetAdjustment,
  confirmFinalPayment,
  finishRepair,
} from '../modules/orders/orders.service'

let client: { id: string }
let clientUser: { id: string; email: string }
let device: { id: string }
let adminEmail: string
let technician: { id: string; email: string }
let otherTechnician: { id: string; email: string }

const makeOrder = async (
  overrides: Partial<{
    status: string
    budget: number
    revisionAmount: number
    deliveryAmount: number
    technicianId: string | null
    finalPaymentConfirmed: boolean
    finalPaymentConfirmedAt: Date
    technicianCommission: number
    finalPaymentDetails: Record<string, string>
    finalPaymentRejectionReason: string
  }> = {}
) => {
  return prisma.order.create({
    data: {
      finalPaymentDetails: overrides.finalPaymentDetails ?? undefined,
      finalPaymentRejectionReason: overrides.finalPaymentRejectionReason ?? null,
      orderNumber: `REP-TEST-FR-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      status: (overrides.status ?? 'REPAIRING') as any,
      problem: 'Formateo + respaldo — test finalizar reparación',
      budget: overrides.budget ?? 30,
      revisionAmount: overrides.revisionAmount ?? 15,
      deliveryAmount: overrides.deliveryAmount ?? 10,
      technicianId: overrides.technicianId === undefined ? technician.id : overrides.technicianId,
      finalPaymentConfirmed: overrides.finalPaymentConfirmed ?? false,
      finalPaymentConfirmedAt: overrides.finalPaymentConfirmedAt ?? null,
      technicianCommission: overrides.technicianCommission ?? null,
      clientId: client.id,
      deviceId: device.id,
    },
  })
}

beforeAll(async () => {
  const suffix = Date.now()
  client = await prisma.client.create({
    data: { name: 'Cliente', lastName: 'Finalizar Reparación', idNumber: `TEST-FR-${suffix}`, phone: '0000000005' },
  })
  clientUser = await prisma.user.create({
    data: { name: 'Cliente', lastName: 'Finalizar Reparación', email: `cliente-fr-${suffix}@test.com`, password: 'x', role: 'CLIENT', clientId: client.id },
  })
  device = await prisma.device.create({ data: { type: 'LAPTOP', brand: 'HP', model: 'Pavilion' } })

  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' }, select: { email: true } })
  adminEmail = admin!.email

  technician = await prisma.user.create({
    data: {
      name: 'Técnico',
      lastName: 'Asignado FR',
      email: `tecnico-fr-${suffix}@test.com`,
      password: 'x',
      role: 'TECHNICIAN',
      technicianStatus: 'BUSY',
      activeOrderCount: 1,
    },
  })
  otherTechnician = await prisma.user.create({
    data: {
      name: 'Técnico',
      lastName: 'Otro FR',
      email: `tecnico-otro-fr-${suffix}@test.com`,
      password: 'x',
      role: 'TECHNICIAN',
      technicianStatus: 'AVAILABLE',
      activeOrderCount: 0,
    },
  })
}, 20000)

afterAll(async () => {
  await prisma.advancePaymentSubmission.deleteMany({ where: { order: { clientId: client.id } } })
  await prisma.orderStatusHistory.deleteMany({ where: { order: { clientId: client.id } } })
  await prisma.order.deleteMany({ where: { clientId: client.id } })
  await prisma.device.delete({ where: { id: device.id } }).catch(() => {})
  await prisma.user.delete({ where: { id: clientUser.id } }).catch(() => {})
  await prisma.user.delete({ where: { id: technician.id } }).catch(() => {})
  await prisma.user.delete({ where: { id: otherTechnician.id } }).catch(() => {})
  await prisma.client.delete({ where: { id: client.id } }).catch(() => {})
})

describe('orders.service — finishRepair', () => {
  it('con saldo pendiente, queda en READY y finalPaymentConfirmed sigue false', async () => {
    const order = await makeOrder({ budget: 30, revisionAmount: 15 })
    const updated = await finishRepair(order.id, technician.id)
    expect(updated.status).toBe('READY')
    expect(updated.finalPaymentConfirmed).toBe(false)
  })

  it('con el 100% ya pagado, salta a PAID_PENDING_DELIVERY con comisión correcta', async () => {
    // revisionAmount 20 (a propósito distinto de ADVANCE_REVISION_AMOUNT=15): si el código
    // confundiera el fallback de comisión con la constante hardcodeada en vez del valor real
    // de la orden, la comisión esperada acá (16) no coincidiría con la que daría ese bug (18).
    // budget 35, revisionAmount 20 -> base 15. Un abono BUDGET CONFIRMED de 15 cubre toda la base.
    const order = await makeOrder({ budget: 35, revisionAmount: 20, deliveryAmount: 10 })
    await prisma.advancePaymentSubmission.create({
      data: {
        orderId: order.id,
        amount: 15,
        paymentDetails: { banco: 'Bancaribe' },
        status: 'CONFIRMED',
        kind: 'BUDGET',
        confirmedAt: new Date(),
      },
    })

    const updated = await finishRepair(order.id, technician.id, 'Listo, probado')

    expect(updated.status).toBe('PAID_PENDING_DELIVERY')
    expect(updated.finalPaymentConfirmed).toBe(true)
    // comisión = deliveryAmount + 0.4 * (budget - (revisionAmount ? Number(revisionAmount) : 0))
    // = 10 + 0.4 * (35 - 20) = 16
    expect(Number(updated.technicianCommission)).toBe(16)
  })

  it('rechaza si el status no es REPAIRING', async () => {
    const order = await makeOrder({ status: 'WAITING_APPROVAL' })
    await expect(finishRepair(order.id, technician.id)).rejects.toThrow(
      'Esta acción solo aplica a órdenes en reparación'
    )
  })

  it('rechaza si el technicianId no es el asignado a la orden', async () => {
    const order = await makeOrder({ status: 'REPAIRING' })
    await expect(finishRepair(order.id, otherTechnician.id)).rejects.toThrow(
      'Solo el técnico asignado a esta orden puede finalizar la reparación'
    )
  })

  // Guarda de concurrencia sobre `budget` (Finding C, revisión final): un
  // addBudgetAdjustment puede subir el presupuesto SIN tocar el status, así
  // que filtrar el updateMany solo por status no alcanzaba — la comisión y la
  // decisión de "pagado en su totalidad" se escribían sobre datos viejos.
  // Se interfiere el budget justo después de la lectura que hace finishRepair
  // dentro de su transacción, envolviendo el cliente transaccional.
  it('aborta si el budget cambia entre la lectura y la escritura', async () => {
    // budget 35, revisión 20 → base 15, cubierta por un abono de 15: sin
    // interferencia, esta orden saltaría a PAID_PENDING_DELIVERY con comisión 16.
    const order = await makeOrder({ status: 'REPAIRING', budget: 35, revisionAmount: 20, deliveryAmount: 10 })
    await prisma.advancePaymentSubmission.create({
      data: {
        orderId: order.id,
        amount: 15,
        paymentDetails: { banco: 'Bancaribe' },
        status: 'CONFIRMED',
        kind: 'BUDGET',
        confirmedAt: new Date(),
      },
    })

    const realTransaction = prisma.$transaction.bind(prisma)
    let interfered = false

    const spy = jest.spyOn(prisma, '$transaction').mockImplementation(((fn: any, options: any) => {
      if (typeof fn !== 'function') return realTransaction(fn, options)
      return realTransaction(async (tx: any) => {
        const proxiedTx = new Proxy(tx, {
          get(target, prop) {
            if (prop !== 'order') return target[prop]
            const orderDelegate = target.order
            return new Proxy(orderDelegate, {
              get(delegate, method) {
                if (method !== 'findUnique') return delegate[method]
                return async (...args: any[]) => {
                  const result = await delegate.findUnique(...args)
                  if (!interfered) {
                    interfered = true
                    // Escritura desde otra conexión (el cliente de fuera de la
                    // transacción) — simula el ajuste concurrente ya commiteado.
                    await prisma.order.update({ where: { id: order.id }, data: { budget: 45 } })
                  }
                  return result
                }
              },
            })
          },
        })
        return await fn(proxiedTx)
      }, options)
    }) as any)

    try {
      await expect(finishRepair(order.id, technician.id)).rejects.toThrow(CONCURRENT_FINISH_REPAIR_ERROR)
    } finally {
      spy.mockRestore()
    }

    expect(interfered).toBe(true)

    const after = await prisma.order.findUniqueOrThrow({ where: { id: order.id } })
    // La transición no se aplicó: sigue en reparación, sin comisión ni pago
    // final confirmado sobre el presupuesto viejo.
    expect(after.status).toBe('REPAIRING')
    expect(Number(after.budget)).toBe(45)
    expect(after.technicianCommission).toBeNull()
    expect(after.finalPaymentConfirmed).toBe(false)
  }, 20000)
})

describe('orders.service — addBudgetAdjustment', () => {
  it('suma correctamente el monto a order.budget en REPAIRING', async () => {
    const order = await makeOrder({ status: 'REPAIRING', budget: 30 })
    const updated = await addBudgetAdjustment(order.id, adminEmail, 10, 'Repuesto adicional no previsto')
    expect(Number(updated.budget)).toBe(40)
    expect(updated.status).toBe('REPAIRING')
  })

  it('en PAID_PENDING_DELIVERY revierte a READY y limpia el pago final confirmado', async () => {
    const order = await makeOrder({
      status: 'PAID_PENDING_DELIVERY',
      budget: 30,
      finalPaymentConfirmed: true,
      finalPaymentConfirmedAt: new Date(),
      technicianCommission: 16,
    })

    const updated = await addBudgetAdjustment(order.id, adminEmail, 5, 'Repuesto imprevisto tras terminar')

    expect(updated.status).toBe('READY')
    expect(Number(updated.budget)).toBe(35)
    expect(updated.finalPaymentConfirmed).toBe(false)
    expect(updated.finalPaymentConfirmedAt).toBeNull()
    expect(updated.technicianCommission).toBeNull()
  })

  // Finding E (revisión final): el comprobante viejo quedaba en la orden, así
  // que "Aprobar pago final" volvía a estar a un clic sin haber cobrado el
  // ajuste, y el formulario de mostrador (oculto si finalPaymentDetails != null)
  // no reaparecía.
  it('al revertir a READY limpia el comprobante y el motivo de rechazo del pago final', async () => {
    const order = await makeOrder({
      status: 'PAID_PENDING_DELIVERY',
      budget: 30,
      finalPaymentConfirmed: true,
      finalPaymentConfirmedAt: new Date(),
      technicianCommission: 16,
      finalPaymentDetails: { banco: 'Banesco', referencia: '1234' },
      finalPaymentRejectionReason: 'Motivo viejo',
    })

    await addBudgetAdjustment(order.id, adminEmail, 5, 'Imprevisto tras el pago')

    const after = await prisma.order.findUniqueOrThrow({ where: { id: order.id } })
    expect(after.status).toBe('READY')
    expect(after.finalPaymentDetails).toBeNull()
    expect(after.finalPaymentRejectionReason).toBeNull()
  })

  // Finding E (revisión final), 2da parte: al llegar a PAID_PENDING_DELIVERY
  // la orden ya había liberado la carga del técnico; al reabrirse el saldo hay
  // trabajo activo de nuevo y hay que devolvérsela.
  it('al revertir a READY le devuelve la carga al técnico asignado', async () => {
    const order = await makeOrder({
      status: 'PAID_PENDING_DELIVERY',
      budget: 30,
      technicianId: technician.id,
      finalPaymentConfirmed: true,
      finalPaymentConfirmedAt: new Date(),
      technicianCommission: 16,
    })

    const before = await prisma.user.findUniqueOrThrow({ where: { id: technician.id } })
    await addBudgetAdjustment(order.id, adminEmail, 5, 'Imprevisto tras el pago')
    const after = await prisma.user.findUniqueOrThrow({ where: { id: technician.id } })

    expect(after.activeOrderCount).toBe(before.activeOrderCount + 1)
  })

  // Finding 1 (re-revisión): el comprobante viejo también puede estar cargado
  // con la orden en READY (el cliente ya pagó el monto anterior y espera la
  // aprobación del admin). Ajustar el presupuesto ahí lo invalida: si no se
  // limpia, "Aprobar pago final" sigue habilitado y cobraría de menos.
  it('en READY con comprobante cargado lo limpia sin cambiar el status', async () => {
    const order = await makeOrder({
      status: 'READY',
      budget: 30,
      finalPaymentDetails: { banco: 'Banesco', referencia: '5555' },
      finalPaymentRejectionReason: 'Motivo viejo',
    })

    const updated = await addBudgetAdjustment(order.id, adminEmail, 5, 'Repuesto extra antes de entregar')

    expect(updated.status).toBe('READY')
    expect(Number(updated.budget)).toBe(35)

    const after = await prisma.order.findUniqueOrThrow({ where: { id: order.id } })
    expect(after.finalPaymentDetails).toBeNull()
    expect(after.finalPaymentRejectionReason).toBeNull()

    const history = await prisma.orderStatusHistory.findMany({ where: { orderId: order.id } })
    expect(
      history.some((h) => (h.comment ?? '').includes('invalidó el comprobante de pago final pendiente'))
    ).toBe(true)
  })

  it('en READY sin comprobante cargado no agrega la entrada de invalidación', async () => {
    const order = await makeOrder({ status: 'READY', budget: 30 })

    await addBudgetAdjustment(order.id, adminEmail, 5, 'Repuesto extra antes de entregar')

    const history = await prisma.orderStatusHistory.findMany({ where: { orderId: order.id } })
    expect(
      history.some((h) => (h.comment ?? '').includes('invalidó el comprobante de pago final pendiente'))
    ).toBe(false)
  })

  it('aborta si la orden cambia de estado mientras se procesa el ajuste', async () => {
    const order = await makeOrder({ status: 'REPAIRING', budget: 30 })

    const realTransaction = prisma.$transaction.bind(prisma)
    let interfered = false

    const spy = jest.spyOn(prisma, '$transaction').mockImplementation(((fn: any, options: any) => {
      if (typeof fn !== 'function') return realTransaction(fn, options)
      return realTransaction(async (tx: any) => {
        const proxiedTx = new Proxy(tx, {
          get(target, prop) {
            if (prop !== 'order') return target[prop]
            const orderDelegate = target.order
            return new Proxy(orderDelegate, {
              get(delegate, method) {
                if (method !== 'findUnique') return delegate[method]
                return async (...args: any[]) => {
                  const result = await delegate.findUnique(...args)
                  if (!interfered) {
                    interfered = true
                    await prisma.order.update({ where: { id: order.id }, data: { status: 'READY' } })
                  }
                  return result
                }
              },
            })
          },
        })
        return await fn(proxiedTx)
      }, options)
    }) as any)

    try {
      await expect(addBudgetAdjustment(order.id, adminEmail, 10, 'motivo')).rejects.toThrow(
        'La orden cambió de estado mientras se procesaba el ajuste'
      )
    } finally {
      spy.mockRestore()
    }

    const after = await prisma.order.findUniqueOrThrow({ where: { id: order.id } })
    expect(Number(after.budget)).toBe(30)
  }, 20000)

  it('rechaza si falta el reason', async () => {
    const order = await makeOrder({ status: 'REPAIRING' })
    await expect(addBudgetAdjustment(order.id, adminEmail, 10, '')).rejects.toThrow('reason es requerido')
  })

  it('rechaza en DELIVERED', async () => {
    const order = await makeOrder({ status: 'DELIVERED' })
    await expect(addBudgetAdjustment(order.id, adminEmail, 10, 'motivo')).rejects.toThrow(
      'Esta acción solo aplica a órdenes en reparación, listas o pagadas pendientes de entrega'
    )
  })

  it('rechaza si el actor TECHNICIAN no es el asignado a la orden', async () => {
    const order = await makeOrder({ status: 'REPAIRING', technicianId: technician.id })
    await expect(
      addBudgetAdjustment(order.id, otherTechnician.email, 10, 'motivo')
    ).rejects.toThrow('Solo el técnico asignado a esta orden puede ajustar su presupuesto')
  })
})

// Finding A (revisión final): el pago final tradicional no dejaba rastro en el
// pool de anticipos (kind BUDGET), así que el "saldo pendiente" que calculan el
// modal admin, la app del cliente, finishRepair y addBudgetAdjustment seguía
// mostrando el monto completo aunque ya se hubiera cobrado.
describe('orders.service — confirmFinalPayment registra el cobro', () => {
  const confirmedBudgetTotal = async (orderId: string) => {
    const submissions = await prisma.advancePaymentSubmission.findMany({
      where: { orderId, kind: 'BUDGET', status: 'CONFIRMED' },
    })
    return submissions.reduce((sum, s) => sum + Number(s.amount), 0)
  }

  it('al aprobar crea un abono BUDGET CONFIRMED por el saldo que faltaba', async () => {
    // budget 50, revisión 20 → base 30; sin anticipos previos, se cobran los 30.
    const order = await makeOrder({
      status: 'READY',
      budget: 50,
      revisionAmount: 20,
      finalPaymentDetails: { banco: 'Banesco', referencia: '9876' },
    })

    await confirmFinalPayment(order.id, true)

    const submissions = await prisma.advancePaymentSubmission.findMany({
      where: { orderId: order.id, kind: 'BUDGET', status: 'CONFIRMED' },
    })
    expect(submissions).toHaveLength(1)
    expect(Number(submissions[0].amount)).toBe(30)
    expect(submissions[0].confirmedAt).not.toBeNull()
    expect(submissions[0].paymentDetails).toMatchObject({ banco: 'Banesco', referencia: '9876' })
  })

  it('descuenta lo ya confirmado como anticipo, sin duplicarlo', async () => {
    // budget 50, revisión 20 → base 30, con 18 ya abonados: solo faltaban 12.
    const order = await makeOrder({ status: 'READY', budget: 50, revisionAmount: 20 })
    await prisma.advancePaymentSubmission.create({
      data: {
        orderId: order.id,
        amount: 18,
        paymentDetails: { banco: 'Bancaribe' },
        status: 'CONFIRMED',
        kind: 'BUDGET',
        confirmedAt: new Date(),
      },
    })

    await confirmFinalPayment(order.id, true)

    // 18 del anticipo + 12 del pago final = 30 = la base completa, sin pasarse.
    expect(await confirmedBudgetTotal(order.id)).toBe(30)
  })

  it('no crea ningún abono si el anticipo ya cubría el 100%', async () => {
    const order = await makeOrder({ status: 'READY', budget: 50, revisionAmount: 20 })
    await prisma.advancePaymentSubmission.create({
      data: {
        orderId: order.id,
        amount: 30,
        paymentDetails: { banco: 'Bancaribe' },
        status: 'CONFIRMED',
        kind: 'BUDGET',
        confirmedAt: new Date(),
      },
    })

    await confirmFinalPayment(order.id, true)

    const submissions = await prisma.advancePaymentSubmission.findMany({
      where: { orderId: order.id, kind: 'BUDGET' },
    })
    expect(submissions).toHaveLength(1)
  })

  it('al rechazar no registra ningún cobro', async () => {
    const order = await makeOrder({
      status: 'READY',
      budget: 50,
      revisionAmount: 20,
      finalPaymentDetails: { banco: 'Banesco', referencia: '9876' },
    })

    await confirmFinalPayment(order.id, false, 'Referencia no encontrada')

    expect(await confirmedBudgetTotal(order.id)).toBe(0)
  })

  // Finding 2 (re-revisión): la lectura vivía fuera de la transacción y el
  // update no verificaba nada, así que un ajuste al presupuesto concurrente
  // dejaba la comisión y el abono registrado calculados sobre el budget viejo.
  // Se interfiere el budget justo después de la lectura que hace la función
  // dentro de su transacción, envolviendo el cliente transaccional.
  it('aborta si el budget cambia entre la lectura y la escritura', async () => {
    const order = await makeOrder({
      status: 'READY',
      budget: 50,
      revisionAmount: 20,
      deliveryAmount: 10,
      finalPaymentDetails: { banco: 'Banesco', referencia: '9876' },
    })

    const realTransaction = prisma.$transaction.bind(prisma)
    let interfered = false

    const spy = jest.spyOn(prisma, '$transaction').mockImplementation(((fn: any, options: any) => {
      if (typeof fn !== 'function') return realTransaction(fn, options)
      return realTransaction(async (tx: any) => {
        const proxiedTx = new Proxy(tx, {
          get(target, prop) {
            if (prop !== 'order') return target[prop]
            const orderDelegate = target.order
            return new Proxy(orderDelegate, {
              get(delegate, method) {
                if (method !== 'findUnique') return delegate[method]
                return async (...args: any[]) => {
                  const result = await delegate.findUnique(...args)
                  if (!interfered) {
                    interfered = true
                    // Ajuste al presupuesto ya commiteado desde otra conexión.
                    await prisma.order.update({ where: { id: order.id }, data: { budget: 70 } })
                  }
                  return result
                }
              },
            })
          },
        })
        return await fn(proxiedTx)
      }, options)
    }) as any)

    try {
      await expect(confirmFinalPayment(order.id, true)).rejects.toThrow(CONCURRENT_FINAL_PAYMENT_ERROR)
    } finally {
      spy.mockRestore()
    }

    expect(interfered).toBe(true)

    const after = await prisma.order.findUniqueOrThrow({ where: { id: order.id } })
    // Nada se escribió sobre el presupuesto viejo: ni transición, ni comisión,
    // ni el abono que registra el cobro.
    expect(after.status).toBe('READY')
    expect(Number(after.budget)).toBe(70)
    expect(after.finalPaymentConfirmed).toBe(false)
    expect(after.technicianCommission).toBeNull()
    expect(await confirmedBudgetTotal(order.id)).toBe(0)
  }, 20000)

  it('aborta si la orden ya no está en READY', async () => {
    const order = await makeOrder({ status: 'PAID_PENDING_DELIVERY', budget: 50, revisionAmount: 20 })

    await expect(confirmFinalPayment(order.id, true)).rejects.toThrow(CONCURRENT_FINAL_PAYMENT_ERROR)
    expect(await confirmedBudgetTotal(order.id)).toBe(0)
  })
})
