import { computeRepairMinimum, sumPartsCost, buildPaymentSummary, computeExtraPartsPending } from '../modules/orders/repairMinimum'

describe('computeRepairMinimum', () => {
  it.each([
    // [base, repuestos, % esperado, monto esperado]
    [100, 0, 50, 50],
    [100, 20, 50, 50],
    [100, 50, 50, 50],
    [100, 60, 60, 60],
    [100, 63, 70, 70],
    [100, 95, 100, 100],
    [100, 150, 100, 100],
    [80, 41, 60, 48], // 51.25% → 60%
  ])('base %d con repuestos $%d → %d%% ($%d)', (base, parts, percent, amount) => {
    expect(computeRepairMinimum(base, parts)).toEqual({ percent, amount })
  })

  it('base <= 0 no exige nada (diagnóstico sin costo)', () => {
    expect(computeRepairMinimum(0, 10)).toEqual({ percent: 0, amount: 0 })
    expect(computeRepairMinimum(-5, 0)).toEqual({ percent: 0, amount: 0 })
  })
})

describe('sumPartsCost', () => {
  it('suma cantidad × precio al usarlo, tratando null como 0', () => {
    expect(sumPartsCost([
      { quantity: 2, unitPriceAtUse: '20.00' },
      { quantity: 1, unitPriceAtUse: 5 },
      { quantity: 3, unitPriceAtUse: null },
    ])).toBe(45)
  })
})

describe('buildPaymentSummary', () => {
  it('sin presupuesto devuelve null', () => {
    expect(buildPaymentSummary({ budget: null, revisionAmount: 15, confirmedBudgetPaid: 0, partsCost: 0 })).toBeNull()
  })

  it('presupuesto $115, revisión $15, repuestos $63, nada pagado del presupuesto', () => {
    expect(buildPaymentSummary({ budget: 115, revisionAmount: 15, confirmedBudgetPaid: 0, partsCost: 63 })).toEqual({
      budget: 115,
      paid: 15,
      remaining: 100,
      minimumPercent: 70,
      minimumAmount: 70,
      pendingForMinimum: 70,
      pendingReview: 0,
    })
  })

  it('con $50 ya confirmado le faltan $20 para el mínimo', () => {
    const s = buildPaymentSummary({ budget: 115, revisionAmount: 15, confirmedBudgetPaid: 50, partsCost: 63 })!
    expect(s.paid).toBe(65)
    expect(s.remaining).toBe(50)
    expect(s.pendingForMinimum).toBe(20)
  })

  it('presupuesto menor o igual a la revisión: no falta nada', () => {
    const s = buildPaymentSummary({ budget: 15, revisionAmount: 15, confirmedBudgetPaid: 0, partsCost: 0 })!
    expect(s.remaining).toBe(0)
    expect(s.minimumAmount).toBe(0)
    expect(s.pendingForMinimum).toBe(0)
  })
})

describe('computeExtraPartsPending (pausa por repuesto durante la reparación)', () => {
  it.each([
    // [repuestos, confirmado, pendiente, cubierto]
    [30, 50, 0, true],
    [50, 50, 0, true],
    [60, 50, 10, false],
    [0, 0, 0, true],
  ])('repuestos $%d con $%d confirmado → falta $%d', (parts, confirmed, pending, covered) => {
    const r = computeExtraPartsPending(parts, confirmed)
    expect(r.covered).toBe(covered)
    expect(r.pending).toBeCloseTo(pending, 2)
  })

  it('tolera diferencias de coma flotante por debajo del centavo', () => {
    expect(computeExtraPartsPending(60, 59.995).covered).toBe(true)
  })
})

describe('buildPaymentSummary — pendiente en pausa y abonos en revisión', () => {
  it('en WAITING_EXTRA_PAYMENT el pendiente es repuestos − confirmado, no el mínimo', () => {
    // presupuesto $175, revisión $15 → base $160; repuestos $60 → mínimo 50% = $80
    const s = buildPaymentSummary({
      budget: 175, revisionAmount: 15, confirmedBudgetPaid: 50, partsCost: 60, awaitingExtraPayment: true,
    })!
    expect(s.minimumAmount).toBe(80)
    expect(s.pendingForMinimum).toBe(10)
  })

  it('fuera de la pausa el pendiente sigue siendo el del mínimo', () => {
    const s = buildPaymentSummary({ budget: 175, revisionAmount: 15, confirmedBudgetPaid: 50, partsCost: 60 })!
    expect(s.pendingForMinimum).toBe(30)
  })

  it('pendingReview suma los abonos del presupuesto aún sin revisar', () => {
    const s = buildPaymentSummary({
      budget: 115, revisionAmount: 15, confirmedBudgetPaid: 0, partsCost: 0, pendingBudgetPaid: 20.5,
    })!
    expect(s.pendingReview).toBe(20.5)
    // Lo que está en revisión no cuenta como pagado.
    expect(s.paid).toBe(15)
  })
})
