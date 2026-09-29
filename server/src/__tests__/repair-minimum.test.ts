import { computeRepairMinimum, sumPartsCost, buildPaymentSummary } from '../modules/orders/repairMinimum'

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
