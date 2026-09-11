import { Fragment, useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../services/api'
import { useToastStore } from '../../store/toast.store'
import { useConfirm } from '../../hooks/useConfirm'
import { POLL_INTERVAL_MS } from '../../config/constants'
import { getStatusBadge, badgeClassName, hasPendingPayment } from '../../utils/statusBadge'

interface Order {
  id: string
  orderNumber: string
  status: string
  problem: string
  diagnosis: string | null
  budget: string | null
  deliveredAt: string | null
  client: { name: string; lastName: string }
  technician: { id: string; name: string } | null
  deliveryAmount: string | null
  revisionAmount: string | null
  advancePaymentSubmissions: PaymentSubmission[]
  finalPaymentDetails: Record<string, string> | null
  technicianCommission: string | null
}

interface PaymentSubmission {
  id: string
  amount: string
  paymentDetails: Record<string, string>
  status: 'PENDING' | 'CONFIRMED' | 'REJECTED'
  rejectionReason: string | null
  createdAt: string
}

function PaymentDetailsView({ details }: { details: Record<string, string> | null }) {
  if (!details) return <span>—</span>
  return (
    <div className="form-hint">
      {Object.entries(details).map(([key, value]) => (
        <div key={key}>
          <strong>{key}:</strong> {value}
        </div>
      ))}
    </div>
  )
}

function PaymentSubmissionsView({
  submissions,
  total,
  onApprove,
  onReject,
  pendingIds,
}: {
  submissions: PaymentSubmission[]
  total: string
  onApprove: (submissionId: string, amount: string) => void
  onReject: (submissionId: string, amount: string) => void
  pendingIds: Set<string>
}) {
  if (submissions.length === 0) return <span>—</span>

  const confirmedTotal = submissions
    .filter((s) => s.status === 'CONFIRMED')
    .reduce((sum, s) => sum + Number(s.amount), 0)
  const remaining = Number(total) - confirmedTotal

  return (
    <div>
      <p className="form-hint" style={{ marginBottom: 8 }}>
        <strong>Recibido: ${confirmedTotal.toFixed(2)} de ${Number(total).toFixed(2)}</strong>
        {remaining > 0.009 && <span> · Restante: ${remaining.toFixed(2)}</span>}
      </p>
      {submissions.map((s) => (
        <div
          key={s.id}
          style={{
            marginBottom: 8,
            paddingBottom: 8,
            borderBottom: '1px solid var(--color-border)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span className={badgeClassName(getStatusBadge('partialPayment', s.status).variant)}>
              {getStatusBadge('partialPayment', s.status).label}
            </span>
            <strong>${Number(s.amount).toFixed(2)}</strong>
          </div>
          <PaymentDetailsView details={s.paymentDetails} />
          {s.status === 'REJECTED' && s.rejectionReason && (
            <p className="form-hint">Motivo: {s.rejectionReason}</p>
          )}
          {s.status === 'PENDING' && (
            <div style={{ marginTop: 6 }}>
              <button className="btn btn-primary" disabled={pendingIds.has(s.id)} onClick={() => onApprove(s.id, s.amount)}>
                Aprobar abono
              </button>{' '}
              <button className="btn btn-danger" disabled={pendingIds.has(s.id)} onClick={() => onReject(s.id, s.amount)}>
                Rechazar
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

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
  const [expandedId, setExpandedId] = useState<string | null>(null)
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

  // Self-service + delivery: RECEIVED solo significa "pago confirmado", no que el
  // técnico ya fue a buscar el equipo. Hasta que haya diagnóstico, el recibo de
  // intake se etiqueta como "anticipo" en vez de "recepción".
  const isIntakePendingPickup = (order: Order) => order.deliveryAmount != null && !order.diagnosis

  const downloadReceipt = async (order: Order, type: 'intake' | 'final') => {
    try {
      const response = await api.get(`/api/orders/${order.id}/receipt/${type}`, { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }))
      const link = document.createElement('a')
      link.href = url
      const pendingPickup = type === 'intake' && isIntakePendingPickup(order)
      link.download = `recibo-${type === 'final' ? 'entrega' : pendingPickup ? 'anticipo' : 'recepcion'}-${order.orderNumber}.pdf`
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

  const activeOrders = orders.filter(
    (o) => o.status !== 'DELIVERED' && o.status !== 'CANCELLED'
  )

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
                {activeOrders.map((order) => {
                  const isExpanded = expandedId === order.id
                  return (
                    <Fragment key={order.id}>
                      <tr
                        key={order.id}
                        onClick={() => {
                          setExpandedId((prev) => (prev === order.id ? null : order.id))
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
                        <td data-label="Técnico">{order.technician?.name || 'Sin asignar'}</td>
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
                          <button className="btn btn-outline">{isExpanded ? '▲ Cerrar' : '▼ Detalles'}</button>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr key={`${order.id}-detail`}>
                          <td colSpan={6}>
                            <p><strong>Problema:</strong> {order.problem}</p>
                            <p><strong>Presupuesto:</strong> {order.budget ? `$${order.budget}` : '—'}</p>

                            <div className="card">
                              <h4>Pago anticipado</h4>
                              <PaymentSubmissionsView
                                submissions={order.advancePaymentSubmissions ?? []}
                                total={String(
                                  order.deliveryAmount != null
                                    ? Number(order.deliveryAmount) + Number(order.revisionAmount ?? 15)
                                    : Number(order.revisionAmount ?? 15)
                                )}
                                onApprove={handleApproveAdvanceInstallment}
                                onReject={handleRejectAdvanceInstallment}
                                pendingIds={pendingIds}
                              />
                            </div>

                            <div className="card">
                              <h4>Pago final</h4>
                              <PaymentDetailsView details={order.finalPaymentDetails} />
                            </div>

                            <p>
                              <strong>Recibo:</strong>{' '}
                              {order.status === 'PENDING_PAYMENT' ? (
                                '—'
                              ) : (
                                <button className="btn btn-outline" onClick={() => downloadReceipt(order, 'intake')}>
                                  📄 {isIntakePendingPickup(order) ? 'Anticipo' : 'Recepción'}
                                </button>
                              )}
                            </p>

                            <p>
                              <strong>Acciones:</strong>{' '}
                              {(order.status === 'READY' || order.status === 'WAITING_APPROVAL') && order.budget != null && Number(order.budget) === 0 ? (
                                <button className="btn btn-primary" disabled={pendingIds.has(order.id)} onClick={() => handleCloseZeroBudgetOrder(order)}>
                                  Marcar como entregada
                                </button>
                              ) : order.status === 'READY' ? (
                                <>
                                  <button
                                    className="btn btn-primary"
                                    onClick={() => handleApproveFinalPayment(order)}
                                    disabled={!order.finalPaymentDetails || pendingIds.has(order.id)}
                                  >
                                    Aprobar pago final
                                  </button>{' '}
                                  <button className="btn btn-danger" disabled={pendingIds.has(order.id)} onClick={() => handleRejectFinalPayment(order)}>
                                    Rechazar
                                  </button>
                                </>
                              ) : (
                                '—'
                              )}
                            </p>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
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
    </div>
  )
}