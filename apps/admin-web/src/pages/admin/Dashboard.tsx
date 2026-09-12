import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../services/api'
import { useToastStore } from '../../store/toast.store'
import { useConfirm } from '../../hooks/useConfirm'
import { POLL_INTERVAL_MS } from '../../config/constants'
import { getStatusBadge, badgeClassName, hasPendingPayment, isQueuedForTechnician } from '../../utils/statusBadge'
import OrderDetailModal from '../../components/OrderDetailModal'
import { isIntakePendingPickup, type Order } from './dashboard.types'

// Estilo del resaltado para filas nuevas — mismo criterio en los 3 paneles internos.
const NEW_ROW_STYLE: CSSProperties = {
  backgroundColor: '#fff8e1',
  borderLeft: '4px solid #f59e0b',
}

const NEW_BADGE_STYLE: CSSProperties = {
  backgroundColor: 'var(--color-secondary)',
  color: '#fff',
  marginLeft: 8,
}

export default function Dashboard() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [newOrderIds, setNewOrderIds] = useState<Set<string>>(new Set())
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set())
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)
  const showToast = useToastStore((state) => state.showToast)
  const confirmDialog = useConfirm()

  const setBusy = (id: string, busy: boolean) => {
    setPendingIds((prev) => {
      const next = new Set(prev)
      if (busy) next.add(id)
      else next.delete(id)
      return next
    })
  }

  useEffect(() => {
    fetchData()
    // Polling automático — mismo intervalo que Motorizado y Técnico, para que
    // los 3 paneles internos se mantengan coordinados entre sí.
    const interval = setInterval(() => fetchData(true), POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [])

  const fetchData = async (isPoll = false) => {
    if (!isPoll) {
      setLoading(true)
      setError('')
    }
    try {
      const ordersRes = await api.get('/api/orders')
      const freshOrders: Order[] = ordersRes.data.data

      if (isPoll) {
        setOrders((prev) => {
          const prevIds = new Set(prev.map((o) => o.id))
          const freshIds = freshOrders.filter((o) => !prevIds.has(o.id)).map((o) => o.id)
          if (freshIds.length > 0) {
            setNewOrderIds((prevNew) => new Set([...prevNew, ...freshIds]))
          }
          return freshOrders
        })
      } else {
        setOrders(freshOrders)
      }
    } catch (err) {
      // En polling silencioso no mostramos el error de página completa —
      // los datos ya cargados siguen visibles, solo se reintenta en el próximo ciclo.
      if (!isPoll) setError('Error al cargar los datos del panel')
    } finally {
      if (!isPoll) setLoading(false)
    }
  }

  const downloadReceipt = async (order: Order, type: 'intake' | 'payment' | 'final' | 'closure') => {
    try {
      const response = await api.get(`/api/orders/${order.id}/receipt/${type}`, { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }))
      const link = document.createElement('a')
      link.href = url
      const pendingPickup = type === 'intake' && isIntakePendingPickup(order)
      const filenames: Record<'intake' | 'payment' | 'final' | 'closure', string> = {
        intake: pendingPickup ? 'anticipo' : 'recepcion',
        payment: 'pago',
        final: 'entrega',
        closure: 'cierre',
      }
      link.download = `recibo-${filenames[type]}-${order.orderNumber}.pdf`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      showToast('Error al descargar el recibo', 'error')
    }
  }

  const clearNewOrder = (id: string) => {
    setNewOrderIds((prev) => {
      if (!prev.has(id)) return prev
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }

  // ── Anticipo de servicio técnico — abonos individuales (pago en partes) ──
  const handleApproveAdvanceInstallment = async (submissionId: string, amount: string) => {
    if (pendingIds.has(submissionId)) return
    const confirmed = await confirmDialog({
      title: 'Aprobar abono del anticipo',
      message: `Monto: $${Number(amount).toFixed(2)}. Esta acción no se puede deshacer.`,
      confirmLabel: 'Aprobar',
      amount: Number(amount),
    })
    if (!confirmed) return
    setBusy(submissionId, true)
    try {
      await api.post(`/api/orders/advance-payment-installment/${submissionId}/confirm`, { approved: true })
      showToast('✅ Abono aprobado.', 'success')
      fetchData()
    } catch (err) {
      showToast('❌ Error al aprobar el abono', 'error')
    } finally {
      setBusy(submissionId, false)
    }
  }

  const handleRejectAdvanceInstallment = async (submissionId: string, amount: string) => {
    if (pendingIds.has(submissionId)) return
    const reason = await confirmDialog({
      title: 'Rechazar abono del anticipo',
      requireText: true,
      textLabel: 'Motivo del rechazo',
      confirmLabel: 'Rechazar',
      amount: Number(amount),
    })
    if (!reason) return
    setBusy(submissionId, true)
    try {
      await api.post(`/api/orders/advance-payment-installment/${submissionId}/confirm`, {
        approved: false,
        rejectionReason: reason,
      })
      showToast('✅ Abono rechazado. Se notificó al cliente para que reenvíe sus datos.', 'success')
      fetchData()
    } catch (err) {
      showToast('❌ Error al rechazar el abono', 'error')
    } finally {
      setBusy(submissionId, false)
    }
  }

  // ── Pago final (saldo de mano de obra) ──
  const handleApproveFinalPayment = async (order: Order) => {
    if (pendingIds.has(order.id)) return
    const confirmed = await confirmDialog({
      title: 'Aprobar pago final',
      message: `Orden ${order.orderNumber} — ${order.client.name} ${order.client.lastName}. Calcula y fija la comisión del técnico. Esta acción no se puede deshacer.`,
      confirmLabel: 'Aprobar',
      amount: order.finalPaymentDetails?.monto ? Number(order.finalPaymentDetails.monto) : undefined,
    })
    if (!confirmed) return
    setBusy(order.id, true)
    try {
      const response = await api.post(`/api/orders/${order.id}/confirm-final-payment`, { approved: true })
      const commission = response.data.data.technicianCommission
      showToast(`✅ Pago final aprobado. Orden completada. Comisión del técnico: $${commission}`, 'success')
      fetchData()
    } catch (err) {
      showToast('❌ Error al aprobar el pago final', 'error')
    } finally {
      setBusy(order.id, false)
    }
  }

  const handleRejectFinalPayment = async (order: Order) => {
    const orderId = order.id
    if (pendingIds.has(orderId)) return
    const reason = await confirmDialog({
      title: 'Rechazar pago final',
      requireText: true,
      textLabel: 'Motivo del rechazo',
      confirmLabel: 'Rechazar',
      amount: order.finalPaymentDetails?.monto ? Number(order.finalPaymentDetails.monto) : undefined,
    })
    if (!reason) return
    setBusy(orderId, true)
    try {
      await api.post(`/api/orders/${orderId}/confirm-final-payment`, {
        approved: false,
        rejectionReason: reason,
      })
      showToast('✅ Pago final rechazado. Se notificó al cliente para que reenvíe sus datos.', 'success')
      fetchData()
    } catch (err) {
      showToast('❌ Error al rechazar el pago final', 'error')
    } finally {
      setBusy(orderId, false)
    }
  }

  // ── Cerrar orden con presupuesto $0 (diagnóstico sin costo, sin pago final) ──
  const handleCloseZeroBudgetOrder = async (order: Order) => {
    if (pendingIds.has(order.id)) return
    const confirmed = await confirmDialog({
      title: 'Marcar como entregada',
      message: `Orden ${order.orderNumber} — ${order.client.name} ${order.client.lastName}. Presupuesto $0, no hay saldo que cobrar. Se calculará la comisión del técnico (delivery + 40% de la revisión). Esta acción no se puede deshacer.`,
      confirmLabel: 'Marcar como entregada',
    })
    if (!confirmed) return
    setBusy(order.id, true)
    try {
      const response = await api.post(`/api/orders/${order.id}/close-zero-budget`)
      const commission = response.data.data.technicianCommission
      showToast(`✅ Orden completada sin costo. Comisión del técnico: $${commission}`, 'success')
      fetchData()
    } catch (err) {
      showToast('❌ Error al cerrar la orden', 'error')
    } finally {
      setBusy(order.id, false)
    }
  }

  // ── Marcar entrega física del equipo ya pagado ──
  const handleMarkDelivered = async (order: Order) => {
    if (pendingIds.has(order.id)) return
    const confirmed = await confirmDialog({
      title: 'Marcar como entregado',
      message: `Orden ${order.orderNumber} — ${order.client.name} ${order.client.lastName}. Confirma que el cliente ya recibió el equipo reparado.`,
      confirmLabel: 'Marcar como entregado',
    })
    if (!confirmed) return
    setBusy(order.id, true)
    try {
      await api.post(`/api/orders/${order.id}/mark-delivered`)
      showToast('✅ Orden marcada como entregada.', 'success')
      fetchData()
    } catch (err) {
      showToast('❌ Error al marcar la orden como entregada', 'error')
    } finally {
      setBusy(order.id, false)
    }
  }

  // ── Marcar retiro sin reparar (presupuesto rechazado) ──
  const handleMarkPickedUpUnrepaired = async (order: Order) => {
    if (pendingIds.has(order.id)) return
    const confirmed = await confirmDialog({
      title: 'Marcar como entregado sin reparar',
      message: `Orden ${order.orderNumber} — ${order.client.name} ${order.client.lastName}. Confirma que el cliente retiró su equipo sin reparar.`,
      confirmLabel: 'Marcar como entregado',
    })
    if (!confirmed) return
    setBusy(order.id, true)
    try {
      await api.post(`/api/orders/${order.id}/mark-picked-up-unrepaired`)
      showToast('✅ Orden cerrada — equipo retirado sin reparar.', 'success')
      fetchData()
    } catch (err) {
      showToast('❌ Error al cerrar la orden', 'error')
    } finally {
      setBusy(order.id, false)
    }
  }

  // ── Registrar pago final desde el mostrador (cliente pagó en persona) ──
  const handleSubmitCounterFinalPayment = async (order: Order, paymentDetails: Record<string, string>) => {
    if (pendingIds.has(order.id)) return
    setBusy(order.id, true)
    try {
      await api.post(`/api/orders/${order.id}/counter-final-payment`, { paymentDetails })
      showToast('✅ Pago final registrado — pendiente de aprobación.', 'success')
      fetchData()
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Error al registrar el pago final', 'error')
    } finally {
      setBusy(order.id, false)
    }
  }

  const activeOrders = orders.filter(
    (o) => o.status !== 'DELIVERED' && o.status !== 'CANCELLED'
  )

  // Deriva del array `orders` en cada render — el modal se actualiza solo con
  // cada ciclo de polling. Si la orden sale de `activeOrders` (se completó, se
  // canceló) `selectedOrder` pasa a `null` y el modal deja de renderizarse
  // sin necesitar un efecto separado que lo "cierre".
  const selectedOrder = activeOrders.find((o) => o.id === selectedOrderId) ?? null

  // Total de presupuestos en curso — servicios activos aún no completados,
  // por eso no tienen comisión todavía (esa solo se calcula al entregar).
  const activeBudgetTotal = activeOrders.reduce(
    (sum, o) => sum + (o.budget ? Number(o.budget) : 0),
    0
  )

  if (loading) return <div className="page-container"><p>Cargando…</p></div>
  if (error) return <div className="page-container"><p className="alert-error">{error}</p></div>

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Panel de Administrador</h1>
        <button className="btn btn-secondary" onClick={() => fetchData()}>
          ↻ Actualizar
        </button>
      </div>
      <p>
        <Link to="/admin/create-staff" className="btn btn-accent">➕ Crear usuario de personal</Link>{' '}
        <Link to="/admin/inventory" className="btn btn-secondary">📦 Inventario</Link>{' '}
        <Link to="/registro" className="btn btn-secondary">🧾 Registro (Recepción)</Link>{' '}
        <Link to="/admin/reportes" className="btn btn-secondary">📊 Reportes</Link>
      </p>

      <section className="card">
        <h2>Servicios Técnicos Activos ({activeOrders.length})</h2>
        {activeOrders.length === 0 ? (
          <p>No hay servicios activos</p>
        ) : (
          <div className="table-wrapper">
            <table className="styled-table">
              <thead>
                <tr>
                  <th scope="col">Orden</th>
                  <th scope="col">Origen</th>
                  <th scope="col">Cliente</th>
                  <th scope="col">Técnico</th>
                  <th scope="col">Estado</th>
                  <th scope="col"></th>
                </tr>
              </thead>
              <tbody>
                {activeOrders.map((order) => (
                  <tr
                    key={order.id}
                    onClick={() => {
                      setSelectedOrderId(order.id)
                      clearNewOrder(order.id)
                    }}
                    style={newOrderIds.has(order.id) ? NEW_ROW_STYLE : undefined}
                  >
                    <td data-label="Orden">
                      {order.orderNumber}
                      {newOrderIds.has(order.id) && (
                        <span className="badge" style={NEW_BADGE_STYLE} role="img" aria-label="Orden nueva, no revisada todavía">🆕 Nuevo</span>
                      )}
                    </td>
                    <td data-label="Origen">{order.deliveryAmount != null ? '📱 App' : '🏢 Recepción'}</td>
                    <td data-label="Cliente">{order.client.name} {order.client.lastName}</td>
                    <td data-label="Técnico">
                      {order.technician?.name || 'Sin asignar'}
                      {isQueuedForTechnician(order) && (
                        <span className={badgeClassName('warning')} style={{ marginLeft: 6 }}>
                          🕐 En cola
                        </span>
                      )}
                    </td>
                    <td data-label="Estado">
                      <span className={badgeClassName(getStatusBadge('order', order.status).variant)}>
                        {getStatusBadge('order', order.status).label}
                      </span>
                      {hasPendingPayment(order) && (
                        <span className={badgeClassName('warning')} style={{ marginLeft: 6 }}>
                          💰 Pago pendiente
                        </span>
                      )}
                    </td>
                    <td data-label="">
                      <button
                        className="btn btn-outline"
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedOrderId(order.id)
                          clearNewOrder(order.id)
                        }}
                      >
                        Detalles
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={5} style={{ textAlign: 'right', fontWeight: 700 }}>Total presupuesto</td>
                  <td style={{ fontWeight: 700 }}>${activeBudgetTotal.toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>

      {selectedOrder && (
        <OrderDetailModal
          order={selectedOrder}
          pendingIds={pendingIds}
          onClose={() => setSelectedOrderId(null)}
          onApproveAdvanceInstallment={handleApproveAdvanceInstallment}
          onRejectAdvanceInstallment={handleRejectAdvanceInstallment}
          onApproveFinalPayment={handleApproveFinalPayment}
          onRejectFinalPayment={handleRejectFinalPayment}
          onCloseZeroBudgetOrder={handleCloseZeroBudgetOrder}
          onMarkDelivered={handleMarkDelivered}
          onMarkPickedUpUnrepaired={handleMarkPickedUpUnrepaired}
          onSubmitCounterFinalPayment={handleSubmitCounterFinalPayment}
          onDownloadReceipt={downloadReceipt}
        />
      )}
    </div>
  )
}