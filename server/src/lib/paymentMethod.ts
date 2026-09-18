// ─────────────────────────────────────────────
// MAPEO DE MÉTODOS DE PAGO (frontend → enum Prisma)
// ─────────────────────────────────────────────

const PAYMENT_METHOD_MAP: Record<string, string> = {
  PAGO_MOVIL: 'MOBILE_PAYMENT',
  TRANSFERENCIA: 'TRANSFER',
  BINANCE: 'BINANCE',
  EFECTIVO: 'CASH',
}

export const mapPaymentMethod = (frontendMethod: string): string | null => {
  return PAYMENT_METHOD_MAP[frontendMethod] ?? null
}
