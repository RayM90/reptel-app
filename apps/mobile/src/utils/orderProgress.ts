// Seguimiento por pasos de una orden de servicio, pensado para el cliente
// (como el seguimiento de un envío). Traduce el status interno y el
// historial a una lista fija de pasos: hechos (con fecha), el actual y los
// pendientes. El historial detallado sigue disponible aparte.

export type ProgressStepState = 'done' | 'current' | 'pending' | 'rejected'

export interface ProgressStep {
  label: string
  state: ProgressStepState
  date: string | null
}

interface ProgressOrder {
  status: string
  receivedAt: string
  deliveryAmount?: number | string | null
  revisionAmount?: number | string | null
  budget?: number | string | null
  budgetRejectionReason?: string | null
  technician?: unknown | null
  statusHistory: { status: string; createdAt: string }[]
}

interface StepDef {
  label: string
  // Status que marcan el inicio de este paso — de ahí sale la fecha.
  statuses: string[]
  rejected?: boolean
}

// Nombre de cada estado para el cliente — mismo significado que en el
// panel (apps/admin-web/src/utils/statusBadge.ts), redactado para el cliente.
export const CLIENT_STATUS_LABEL: Record<string, string> = {
  PENDING_PAYMENT: '💳 Revisando tu pago',
  RECEIVED: '🏪 Equipo recibido en tienda',
  ON_THE_WAY: '🛵 Técnico en camino',
  DIAGNOSING: '🔍 Técnico revisando tu equipo',
  WAITING_APPROVAL: '📋 Diagnóstico listo — revisa tu presupuesto',
  APPROVED: '✅ Presupuesto aprobado',
  REPAIRING: '🔧 En reparación',
  WAITING_EXTRA_PAYMENT: '⚠️ Esperando pago de repuesto adicional',
  READY: '🎉 Reparado — paga el saldo para retirar',
  PAID_PENDING_DELIVERY: '✅ Listo para retirar',
  REJECTED_PENDING_PICKUP: '❌ Presupuesto rechazado — retira tu equipo',
  DELIVERED: '📱 Equipo entregado',
  CANCELLED: '❌ Orden cancelada',
}

// Orden de la app: el técnico va a buscar el equipo (ON_THE_WAY).
export const isAppOrder = (order: { deliveryAmount?: number | string | null }) => order.deliveryAmount != null

const hasRepair = (order: ProgressOrder) =>
  order.budget != null && Number(order.budget) > Number(order.revisionAmount ?? 15)

const firstDate = (order: ProgressOrder, statuses: string[]): string | null => {
  const dates = order.statusHistory
    .filter((h) => statuses.includes(h.status))
    .map((h) => h.createdAt)
    .sort()
  return dates[0] ?? null
}

const buildSteps = (order: ProgressOrder): { steps: StepDef[]; currentIndex: number } => {
  const app = isAppOrder(order)
  const hasTechnician = order.technician != null
  const { status } = order

  const payment: StepDef = { label: '💳 Revisando tu pago', statuses: ['PENDING_PAYMENT'] }
  const assigned: StepDef = app
    ? {
        label: hasTechnician ? '✅ Pago confirmado — técnico asignado' : '✅ Pago confirmado — buscando técnico disponible',
        statuses: ['ON_THE_WAY'],
      }
    : {
        label: hasTechnician ? '🏪 Equipo recibido en tienda — técnico asignado' : '🏪 Equipo recibido en tienda — buscando técnico disponible',
        statuses: ['RECEIVED'],
      }
  const review: StepDef = { label: '🔍 Técnico revisando tu equipo', statuses: ['DIAGNOSING'] }
  // App: pago → asignado → en camino → revisando. Mostrador: sin "en camino".
  const intake: StepDef[] = app
    ? [payment, assigned, { label: '🛵 Técnico en camino', statuses: ['ON_THE_WAY'] }, review]
    : [payment, assigned, review]

  const diagnosisDone = order.budget != null
  const diagnosis: StepDef = {
    label: diagnosisDone && !hasRepair(order)
      ? '📋 Diagnóstico listo — sin costo de reparación'
      : '📋 Diagnóstico listo — revisa tu presupuesto',
    statuses: ['WAITING_APPROVAL'],
  }

  if (status === 'REJECTED_PENDING_PICKUP' || (status === 'CANCELLED' && order.budgetRejectionReason)) {
    const steps: StepDef[] = [
      ...intake,
      diagnosis,
      { label: '❌ Presupuesto rechazado', statuses: ['REJECTED_PENDING_PICKUP'], rejected: true },
      { label: '📱 Equipo devuelto sin reparar', statuses: ['CANCELLED'] },
    ]
    return { steps, currentIndex: status === 'CANCELLED' ? steps.length : steps.length - 1 }
  }

  if (status === 'CANCELLED') {
    const steps: StepDef[] = [payment, { label: '❌ Orden cancelada', statuses: ['CANCELLED'], rejected: true }]
    return { steps, currentIndex: steps.length }
  }

  // Diagnóstico sin costo: no hay reparación ni saldo — salta a entregado.
  if (diagnosisDone && !hasRepair(order)) {
    const steps: StepDef[] = [...intake, diagnosis, { label: '📱 Equipo entregado', statuses: ['DELIVERED'] }]
    return { steps, currentIndex: status === 'DELIVERED' ? steps.length : intake.length }
  }

  const paidInFull = status === 'PAID_PENDING_DELIVERY' || status === 'DELIVERED'
  const steps: StepDef[] = [
    ...intake,
    diagnosis,
    { label: '✅ Presupuesto aprobado', statuses: ['APPROVED', 'REPAIRING'] },
    {
      label: status === 'WAITING_EXTRA_PAYMENT' ? '⚠️ En reparación — esperando pago de repuesto adicional' : '🔧 En reparación',
      statuses: ['REPAIRING'],
    },
    {
      label: paidInFull ? '✅ Listo para retirar' : '🎉 Reparado — paga el saldo para retirar',
      statuses: ['READY', 'PAID_PENDING_DELIVERY'],
    },
    { label: '📱 Equipo entregado', statuses: ['DELIVERED'] },
  ]

  const o = app ? 1 : 0 // desplazamiento por el paso "en camino"
  const CURRENT_BY_STATUS: Record<string, number> = {
    PENDING_PAYMENT: 0,
    RECEIVED: 1,
    // En camino es el paso actual solo si ya hay técnico; si no, sigue
    // "buscando técnico disponible".
    ON_THE_WAY: app && hasTechnician ? 2 : 1,
    DIAGNOSING: 2 + o,
    WAITING_APPROVAL: 3 + o,
    APPROVED: 5 + o,
    REPAIRING: 5 + o,
    WAITING_EXTRA_PAYMENT: 5 + o,
    READY: 6 + o,
    PAID_PENDING_DELIVERY: 6 + o,
    DELIVERED: steps.length,
  }
  return { steps, currentIndex: CURRENT_BY_STATUS[status] ?? 0 }
}

export const getOrderProgress = (order: ProgressOrder): ProgressStep[] => {
  const { steps, currentIndex } = buildSteps(order)
  return steps.map((step, i) => {
    const state: ProgressStepState =
      i < currentIndex ? (step.rejected ? 'rejected' : 'done') : i === currentIndex ? 'current' : 'pending'
    const date = i <= currentIndex ? firstDate(order, step.statuses) ?? (i === 0 ? order.receivedAt : null) : null
    return { label: step.label, state, date }
  })
}

// Los comentarios del historial son los mismos que ve el admin; la comisión
// del técnico es información interna del taller y no se le muestra al cliente.
export const clientHistoryComment = (comment: string): string =>
  comment.replace(/\s*Comisión del técnico:[\s\S]*$/, '').trim()
