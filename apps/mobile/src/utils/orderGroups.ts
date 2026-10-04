// Una orden está "en curso" hasta que se entrega o se cancela (una orden con
// presupuesto rechazado sigue en curso: falta retirar el equipo).
const FINISHED_STATUSES = ['DELIVERED', 'CANCELLED']

export const isActiveOrder = (order: { status: string }): boolean => !FINISHED_STATUSES.includes(order.status)

export const splitOrders = <T extends { status: string; receivedAt: string }>(orders: T[]) => {
  const byNewest = [...orders].sort((a, b) => b.receivedAt.localeCompare(a.receivedAt))
  return {
    active: byNewest.filter(isActiveOrder),
    history: byNewest.filter((o) => !isActiveOrder(o)),
  }
}
