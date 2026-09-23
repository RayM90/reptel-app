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
  statusHistory: { status: string; createdAt: string }[]
}

interface StepDef {
  label: string
  // Status que marcan el inicio de este paso — de ahí sale la fecha.
  statuses: string[]
  rejected?: boolean
}

// Orden de la app: el técnico va a buscar el equipo — no hay un estado
// propio para eso, DIAGNOSING cubre ir a buscarlo y revisarlo.
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
  const intake: StepDef[] = app
    ? [
        { label: 'Pago del anticipo', statuses: ['PENDING_PAYMENT'] },
        { label: 'Técnico en camino / en revisión', statuses: ['DIAGNOSING'] },
      ]
    : [
        { label: 'Equipo recibido en tienda', statuses: ['RECEIVED'] },
        { label: 'En revisión', statuses: ['DIAGNOSING'] },
      ]

  const diagnosisDone = order.budget != null
  const diagnosis: StepDef = {
    label: diagnosisDone && !hasRepair(order)
      ? 'Diagnóstico listo — sin costo de reparación'
      : 'Diagnóstico listo — revisa tu presupuesto',
    statuses: ['WAITING_APPROVAL'],
  }

  const { status } = order

  if (status === 'REJECTED_PENDING_PICKUP' || (status === 'CANCELLED' && order.budgetRejectionReason)) {
    const steps: StepDef[] = [
      ...intake,
      diagnosis,
      { label: 'Presupuesto rechazado', statuses: ['REJECTED_PENDING_PICKUP'], rejected: true },
      { label: 'Equipo devuelto sin reparar', statuses: ['CANCELLED'] },
    ]
    return { steps, currentIndex: status === 'CANCELLED' ? steps.length : 4 }
  }

  if (status === 'CANCELLED') {
    const steps: StepDef[] = [intake[0], { label: 'Orden cancelada', statuses: ['CANCELLED'], rejected: true }]
    return { steps, currentIndex: steps.length }
  }

  // Diagnóstico sin costo: no hay reparación ni saldo — salta a entregado.
  if (diagnosisDone && !hasRepair(order)) {
    const steps: StepDef[] = [...intake, diagnosis, { label: 'Entregado', statuses: ['DELIVERED'] }]
    return { steps, currentIndex: status === 'DELIVERED' ? steps.length : 2 }
  }

  const steps: StepDef[] = [
    ...intake,
    diagnosis,
    { label: 'En reparación', statuses: ['APPROVED', 'REPAIRING', 'WAITING_PART'] },
    { label: 'Listo — paga el saldo', statuses: ['READY'] },
    { label: 'Entregado', statuses: ['DELIVERED'] },
  ]
  const CURRENT_BY_STATUS: Record<string, number> = {
    PENDING_PAYMENT: 0,
    RECEIVED: 1,
    DIAGNOSING: 1,
    WAITING_APPROVAL: 2,
    APPROVED: 3,
    REPAIRING: 3,
    WAITING_PART: 3,
    READY: 4,
    PAID_PENDING_DELIVERY: 5,
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

// Etiqueta del status para el cliente — en órdenes de la app, "En
// diagnóstico" confunde: primero el técnico tiene que ir a buscar el equipo.
export const clientStatusLabel = (
  status: string,
  order: { deliveryAmount?: number | string | null },
  labels: Record<string, string>
): string => (status === 'DIAGNOSING' && isAppOrder(order) ? '🛵 Técnico en camino / en revisión' : labels[status])

// Los comentarios del historial son los mismos que ve el admin; la comisión
// del técnico es información interna del taller y no se le muestra al cliente.
export const clientHistoryComment = (comment: string): string =>
  comment.replace(/\s*Comisión del técnico:[\s\S]*$/, '').trim()
