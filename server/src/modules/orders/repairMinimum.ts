// ─────────────────────────────────────────────
// MÍNIMO PARA INICIAR LA REPARACIÓN
// El cliente debe tener pagado (del presupuesto, sin contar la revisión ya
// cobrada) al menos este monto para que el técnico repare. Por defecto es el
// 50%; si los repuestos cuestan más, sube hasta cubrirlos completos y se
// redondea hacia arriba de 10 en 10 — así el porcentaje no deja ver el costo
// exacto del repuesto. Tope: 100%.
// ─────────────────────────────────────────────

export const MIN_REPAIR_PERCENT = 50

const round2 = (n: number) => Math.round(n * 100) / 100

export const computeRepairMinimum = (base: number, partsCost: number): { percent: number; amount: number } => {
  if (base <= 0) return { percent: 0, amount: 0 }
  const partsPercent = (partsCost / base) * 100
  // El -1e-9 evita que 60.0000001 (error de coma flotante) suba a 70.
  const roundedUp = Math.ceil(partsPercent / 10 - 1e-9) * 10
  const percent = Math.min(100, Math.max(MIN_REPAIR_PERCENT, roundedUp))
  return { percent, amount: round2((base * percent) / 100) }
}

// ─────────────────────────────────────────────
// PAUSA POR REPUESTO ADICIONAL (durante la reparación)
// La reparación se pausa solo si lo confirmado del presupuesto no cubre el
// costo total de los repuestos activos. No usa el mínimo de arriba: ese rige
// solo para aprobar (WAITING_APPROVAL → REPAIRING). Los ajustes de
// presupuesto no suben los repuestos, así que nunca pausan.
// ─────────────────────────────────────────────

export const computeExtraPartsPending = (partsCost: number, confirmedBudgetPaid: number): { covered: boolean; pending: number } => ({
  covered: confirmedBudgetPaid + 0.009 >= partsCost,
  pending: round2(Math.max(0, partsCost - confirmedBudgetPaid)),
})

export const sumPartsCost = (parts: { quantity: number; unitPriceAtUse: unknown }[]): number =>
  round2(parts.reduce((sum, p) => sum + p.quantity * Number(p.unitPriceAtUse ?? 0), 0))

export interface PaymentSummary {
  budget: number
  // Revisión + abonos del presupuesto ya confirmados (el delivery va aparte).
  paid: number
  remaining: number
  minimumPercent: number
  minimumAmount: number
  // Lo que falta confirmar del presupuesto para llegar al mínimo — o, con la
  // orden en pausa por un repuesto adicional, para cubrir los repuestos.
  pendingForMinimum: number
  // Abonos del presupuesto enviados que el local todavía no revisó.
  pendingReview: number
}

export const buildPaymentSummary = (input: {
  budget: unknown
  revisionAmount: number
  confirmedBudgetPaid: number
  partsCost: number
  // Abonos BUDGET en PENDING (opcional, 0 por defecto).
  pendingBudgetPaid?: number
  // La orden está en WAITING_EXTRA_PAYMENT: el pendiente es el de los repuestos.
  awaitingExtraPayment?: boolean
}): PaymentSummary | null => {
  if (input.budget == null) return null
  const budget = Number(input.budget)
  const base = budget - input.revisionAmount
  const { percent, amount } = computeRepairMinimum(base, input.partsCost)
  const paid = round2(input.revisionAmount + input.confirmedBudgetPaid)
  return {
    budget: round2(budget),
    paid,
    remaining: round2(Math.max(0, budget - paid)),
    minimumPercent: percent,
    minimumAmount: amount,
    pendingForMinimum: input.awaitingExtraPayment
      ? computeExtraPartsPending(input.partsCost, input.confirmedBudgetPaid).pending
      : round2(Math.max(0, amount - input.confirmedBudgetPaid)),
    pendingReview: round2(input.pendingBudgetPaid ?? 0),
  }
}
