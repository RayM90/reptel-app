import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../services/api'
import { useToastStore } from '../../store/toast.store'
import { useConfirm } from '../../hooks/useConfirm'
import { POLL_INTERVAL_MS } from '../../config/constants'

interface Order {
  id: string
  orderNumber: string
  status: string
  problem: string
  budget: string | null
  deliveredAt: string | null
  client: { name: string; lastName: string }
  technician: { id: string; name: string } | null
  advancePaymentDetails: Record<string, string> | null
  finalPaymentDetails: Record<string, string> | null
  technicianCommission: string | null
}

interface ProductOrderItem {
  product: { name: string }
  quantity: number
}

interface PaymentSubmission {
  id: string
  amount: string
  paymentDetails: Record<string, string>
  status: 'PENDING' | 'CONFIRMED' | 'REJECTED'
  rejectionReason: string | null
  createdAt: string
}

interface ProductOrder {
  id: string
  status: string
  total: string
  client: { name: string; lastName: string }
  items: ProductOrderItem[]
  delivery: {
    agent: { name: string }
    deliveryCommission: string | null
    deliveredAt: string | null
  } | null
  paymentSubmissions: PaymentSubmission[]
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

const SUBMISSION_STATUS_LABEL: Record<PaymentSubmission['status'], string> = {
  PENDING: 'Pendiente',
  CONFIRMED: 'Confirmado',
  REJECTED: 'Rechazado',
}

function PaymentSubmissionsView({
  submissions,
  total,
  onApprove,
  onReject,
}: {
  submissions: PaymentSubmission[]
  total: string
  onApprove: (submissionId: string) => void
  onReject: (submissionId: string) => void
}) {
  if (submissions.length === 0) return <span>—</span>

  const confirmedTotal = submissions
    .filter((s) => s.status === 'CONFIRMED')
    .reduce((sum, s) => sum + Number(s.amount), 0)

  return (
    <div>
      <p className="form-hint" style={{ marginBottom: 8 }}>
        <strong>Recibido: ${confirmedTotal.toFixed(2)} de ${Number(total).toFixed(2)}</strong>
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
            <span className="badge">{SUBMISSION_STATUS_LABEL[s.status]}</span>
            <strong>${Number(s.amount).toFixed(2)}</strong>
          </div>
          <PaymentDetailsView details={s.paymentDetails} />
          {s.status === 'REJECTED' && s.rejectionReason && (
            <p className="form-hint">Motivo: {s.rejectionReason}</p>
          )}
          {s.status === 'PENDING' && (
            <div style={{ marginTop: 6 }}>
              <button className="btn btn-primary" onClick={() => onApprove(s.id)}>
                Aprobar abono
              </button>{' '}
              <button className="btn btn-danger" onClick={() => onReject(s.id)}>
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
  backgroundColor: '#f59e0b',
  color: '#fff',
  marginLeft: 8,
}

export default function Dashboard() {
  const [orders, setOrders] = useState<Order[]>([])
  const [productOrders, setProductOrders] = useState<ProductOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [newOrderIds, setNewOrderIds] = useState<Set<string>>(new Set())
  const [newProductOrderIds, setNewProductOrderIds] = useState<Set<string>>(new Set())
  const [view, setView] = useState<'activos' | 'entregados'>('activos')
  const showToast = useToastStore((state) => state.showToast)
  const confirmDialog = useConfirm()

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
      const [ordersRes, productOrdersRes] = await Promise.all([
        api.get('/api/orders'),
        api.get('/api/product-orders'),
      ])
      const freshOrders: Order[] = ordersRes.data.data
      const freshProductOrders: ProductOrder[] = productOrdersRes.data.data

      if (isPoll) {
        setOrders((prev) => {
          const prevIds = new Set(prev.map((o) => o.id))
          const freshIds = freshOrders.filter((o) => !prevIds.has(o.id)).map((o) => o.id)
          if (freshIds.length > 0) {
            setNewOrderIds((prevNew) => new Set([...prevNew, ...freshIds]))
          }
          return freshOrders
        })
        setProductOrders((prev) => {
          const prevIds = new Set(prev.map((po) => po.id))
          const freshIds = freshProductOrders.filter((po) => !prevIds.has(po.id)).map((po) => po.id)
          if (freshIds.length > 0) {
            setNewProductOrderIds((prevNew) => new Set([...prevNew, ...freshIds]))
          }
          return freshProductOrders
        })
      } else {
        setOrders(freshOrders)
        setProductOrders(freshProductOrders)
      }
    } catch (err) {
      // En polling silencioso no mostramos el error de página completa —
      // los datos ya cargados siguen visibles, solo se reintenta en el próximo ciclo.
      if (!isPoll) setError('Error al cargar los datos del panel')
    } finally {
      if (!isPoll) setLoading(false)
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

  const clearNewProductOrder = (id: string) => {
    setNewProductOrderIds((prev) => {
      if (!prev.has(id)) return prev
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }

  // ── Pago anticipado (delivery + revisión) ──
  const handleApproveAdvancePayment = async (orderId: string) => {
    try {
      await api.post(`/api/orders/${orderId}/confirm-advance-payment`, { approved: true })
      showToast('✅ Pago anticipado aprobado. La orden pasó a "Recibida".', 'success')
      fetchData()
    } catch (err) {
      showToast('❌ Error al aprobar el pago', 'error')
    }
  }

  const handleRejectAdvancePayment = async (orderId: string) => {
    const reason = await confirmDialog({
      title: 'Rechazar pago anticipado',
      requireText: true,
      textLabel: 'Motivo del rechazo',
      confirmLabel: 'Rechazar',
    })
    if (!reason) return
    try {
      await api.post(`/api/orders/${orderId}/confirm-advance-payment`, {
        approved: false,
        rejectionReason: reason,
      })
      showToast('✅ Pago rechazado. Se notificó al cliente para que reenvíe sus datos.', 'success')
      fetchData()
    } catch (err) {
      showToast('❌ Error al rechazar el pago', 'error')
    }
  }

  // ── Pago final (saldo de mano de obra) ──
  const handleApproveFinalPayment = async (orderId: string) => {
    try {
      const response = await api.post(`/api/orders/${orderId}/confirm-final-payment`, { approved: true })
      const commission = response.data.data.technicianCommission
      showToast(`✅ Pago final aprobado. Orden completada. Comisión del técnico: $${commission}`, 'success')
      fetchData()
    } catch (err) {
      showToast('❌ Error al aprobar el pago final', 'error')
    }
  }

  const handleRejectFinalPayment = async (orderId: string) => {
    const reason = await confirmDialog({
      title: 'Rechazar pago final',
      requireText: true,
      textLabel: 'Motivo del rechazo',
      confirmLabel: 'Rechazar',
    })
    if (!reason) return
    try {
      await api.post(`/api/orders/${orderId}/confirm-final-payment`, {
        approved: false,
        rejectionReason: reason,
      })
      showToast('✅ Pago final rechazado. Se notificó al cliente para que reenvíe sus datos.', 'success')
      fetchData()
    } catch (err) {
      showToast('❌ Error al rechazar el pago final', 'error')
    }
  }

  // ── Pedidos de tienda — abonos individuales ──
  const handleApprovePartialPayment = async (submissionId: string) => {
    try {
      await api.patch(`/api/product-orders/payment-submissions/${submissionId}/confirm`, { approved: true })
      showToast('✅ Abono aprobado.', 'success')
      fetchData()
    } catch (err) {
      showToast('❌ Error al aprobar el abono', 'error')
    }
  }

  const handleRejectPartialPayment = async (submissionId: string) => {
    const reason = await confirmDialog({
      title: 'Rechazar abono de pago',
      requireText: true,
      textLabel: 'Motivo del rechazo',
      confirmLabel: 'Rechazar',
    })
    if (!reason) return
    try {
      await api.patch(`/api/product-orders/payment-submissions/${submissionId}/confirm`, {
        approved: false,
        rejectionReason: reason,
      })
      showToast('✅ Abono rechazado. Se notificó al cliente para que reenvíe sus datos.', 'success')
      fetchData()
    } catch (err) {
      showToast('❌ Error al rechazar el abono', 'error')
    }
  }

  const activeOrders = orders.filter(
    (o) => o.status !== 'DELIVERED' && o.status !== 'CANCELLED'
  )

  const activeProductOrders = productOrders.filter(
    (po) => po.status !== 'DELIVERED' && po.status !== 'CANCELLED'
  )

  // Total de presupuestos en curso — servicios activos aún no completados,
  // por eso no tienen comisión todavía (esa solo se calcula al entregar).
  const activeBudgetTotal = activeOrders.reduce(
    (sum, o) => sum + (o.budget ? Number(o.budget) : 0),
    0
  )

  // Historial — pedidos ya entregados o cancelados, para auditoría de quién
  // atendió cada uno (técnico o motorizado) y cuánto ganó de comisión.
  const completedOrders = orders.filter(
    (o) => o.status === 'DELIVERED' || o.status === 'CANCELLED'
  )

  const completedProductOrders = productOrders.filter(
    (po) => po.status === 'DELIVERED' || po.status === 'CANCELLED'
  )

  // Totales del historial — para ver de un vistazo cuánto se ha movido en
  // comisiones y ventas sin tener que sumar fila por fila.
  const totalTechnicianCommission = completedOrders.reduce(
    (sum, o) => sum + (o.technicianCommission ? Number(o.technicianCommission) : 0),
    0
  )
  const totalBudget = completedOrders.reduce(
    (sum, o) => sum + (o.budget ? Number(o.budget) : 0),
    0
  )
  const totalProductSales = completedProductOrders.reduce(
    (sum, po) => sum + Number(po.total),
    0
  )
  const totalDeliveryCommission = completedProductOrders.reduce(
    (sum, po) => sum + (po.delivery?.deliveryCommission ? Number(po.delivery.deliveryCommission) : 0),
    0
  )

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—'
    return new Date(dateStr).toLocaleDateString('es-VE', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (loading) return <div className="page-container"><p>Cargando...</p></div>
  if (error) return <div className="page-container"><p className="alert-error">{error}</p></div>

  return (
    <div className="page-container">
      <h1>Panel de Administrador</h1>
      <p><Link to="/admin/create-staff">➕ Crear usuario de personal</Link></p>
      <button className="btn btn-outline" onClick={() => fetchData()} style={{ marginBottom: 16 }}>
        ↻ Actualizar
      </button>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <button
          className={view === 'activos' ? 'btn btn-primary' : 'btn btn-outline'}
          onClick={() => setView('activos')}
        >
          Activos
        </button>
        <button
          className={view === 'entregados' ? 'btn btn-primary' : 'btn btn-outline'}
          onClick={() => setView('entregados')}
        >
          📦 Pedidos Entregados
        </button>
      </div>

      {view === 'activos' ? (
        <>
      <section className="card">
        <h2>Servicios Técnicos Activos ({activeOrders.length})</h2>
        {activeOrders.length === 0 ? (
          <p>No hay servicios activos</p>
        ) : (
          <div className="table-wrapper">
            <table className="styled-table">
              <thead>
                <tr>
                  <th>Orden</th>
                  <th>Cliente</th>
                  <th>Problema</th>
                  <th>Estado</th>
                  <th>Presupuesto</th>
                  <th>Técnico asignado</th>
                  <th>Pago anticipado</th>
                  <th>Pago final</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {activeOrders.map((order) => (
                  <tr
                    key={order.id}
                    onClick={() => clearNewOrder(order.id)}
                    style={newOrderIds.has(order.id) ? NEW_ROW_STYLE : undefined}
                  >
                    <td>
                      {order.orderNumber}
                      {newOrderIds.has(order.id) && (
                        <span className="badge" style={NEW_BADGE_STYLE}>🆕 Nuevo</span>
                      )}
                    </td>
                    <td>{order.client.name} {order.client.lastName}</td>
                    <td>{order.problem}</td>
                    <td><span className="badge">{order.status}</span></td>
                    <td>{order.budget ? `$${order.budget}` : '—'}</td>
                    <td>{order.technician?.name || 'Sin asignar'}</td>
                    <td><PaymentDetailsView details={order.advancePaymentDetails} /></td>
                    <td><PaymentDetailsView details={order.finalPaymentDetails} /></td>
                    <td>
                      {order.status === 'PENDING_PAYMENT' ? (
                        <>
                          <button
                            className="btn btn-primary"
                            onClick={() => handleApproveAdvancePayment(order.id)}
                            disabled={!order.advancePaymentDetails}
                          >
                            Aprobar anticipo
                          </button>{' '}
                          <button className="btn btn-danger" onClick={() => handleRejectAdvancePayment(order.id)}>
                            Rechazar
                          </button>
                        </>
                      ) : order.status === 'READY' ? (
                        <>
                          <button
                            className="btn btn-primary"
                            onClick={() => handleApproveFinalPayment(order.id)}
                            disabled={!order.finalPaymentDetails}
                          >
                            Aprobar pago final
                          </button>{' '}
                          <button className="btn btn-danger" onClick={() => handleRejectFinalPayment(order.id)}>
                            Rechazar
                          </button>
                        </>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={4} style={{ textAlign: 'right', fontWeight: 700 }}>Total presupuesto</td>
                  <td style={{ fontWeight: 700 }}>${activeBudgetTotal.toFixed(2)}</td>
                  <td colSpan={4}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>

      <section className="card">
        <h2>Pedidos de Tienda Activos ({activeProductOrders.length})</h2>
        {activeProductOrders.length === 0 ? (
          <p>No hay pedidos activos</p>
        ) : (
          <div className="table-wrapper">
            <table className="styled-table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Productos</th>
                  <th>Total</th>
                  <th>Estado</th>
                  <th>Motorizado asignado</th>
                  <th>Pagos recibidos</th>
                </tr>
              </thead>
              <tbody>
                {activeProductOrders.map((po) => (
                  <tr
                    key={po.id}
                    onClick={() => clearNewProductOrder(po.id)}
                    style={newProductOrderIds.has(po.id) ? NEW_ROW_STYLE : undefined}
                  >
                    <td>
                      {po.client.name} {po.client.lastName}
                      {newProductOrderIds.has(po.id) && (
                        <span className="badge" style={NEW_BADGE_STYLE}>🆕 Nuevo</span>
                      )}
                    </td>
                    <td>{po.items.map((i) => `${i.product.name} x${i.quantity}`).join(', ')}</td>
                    <td>${po.total}</td>
                    <td><span className="badge">{po.status}</span></td>
                    <td>{po.delivery?.agent.name || 'Sin asignar'}</td>
                    <td>
                      <PaymentSubmissionsView
                        submissions={po.paymentSubmissions}
                        total={po.total}
                        onApprove={handleApprovePartialPayment}
                        onReject={handleRejectPartialPayment}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
        </>
      ) : (
        <>
      <section className="card">
        <h2>Servicios Técnicos — Historial ({completedOrders.length})</h2>
        <div className="table-wrapper">
          <table className="styled-table">
            <thead>
              <tr>
                <th>Orden</th>
                <th>Cliente</th>
                <th>Estado</th>
                <th>Técnico</th>
                <th>Presupuesto</th>
                <th>Comisión técnico</th>
                <th>Fecha entrega</th>
              </tr>
            </thead>
            <tbody>
              {completedOrders.length === 0 ? (
                <tr>
                  <td colSpan={7}>Aún no hay servicios entregados o cancelados</td>
                </tr>
              ) : (
                completedOrders.map((order) => (
                  <tr key={order.id}>
                    <td>{order.orderNumber}</td>
                    <td>{order.client.name} {order.client.lastName}</td>
                    <td><span className="badge">{order.status}</span></td>
                    <td>{order.technician?.name || 'Sin asignar'}</td>
                    <td>{order.budget ? `$${order.budget}` : '—'}</td>
                    <td>{order.technicianCommission ? `$${order.technicianCommission}` : '—'}</td>
                    <td>{formatDate(order.deliveredAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={4} style={{ textAlign: 'right', fontWeight: 700 }}>Totales</td>
                <td style={{ fontWeight: 700 }}>${totalBudget.toFixed(2)}</td>
                <td style={{ fontWeight: 700 }}>${totalTechnicianCommission.toFixed(2)}</td>
                <td></td>
              </tr>
              <tr>
                <td colSpan={5} style={{ textAlign: 'right', fontWeight: 700 }}>
                  Total general (presupuesto + comisión)
                </td>
                <td colSpan={2} style={{ fontWeight: 700 }}>
                  ${(totalBudget + totalTechnicianCommission).toFixed(2)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      <section className="card">
        <h2>Pedidos de Tienda — Historial ({completedProductOrders.length})</h2>
        {completedProductOrders.length === 0 ? (
          <p>Aún no hay pedidos entregados o cancelados</p>
        ) : (
          <div className="table-wrapper">
            <table className="styled-table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Productos</th>
                  <th>Total</th>
                  <th>Estado</th>
                  <th>Motorizado</th>
                  <th>Comisión motorizado</th>
                  <th>Fecha entrega</th>
                </tr>
              </thead>
              <tbody>
                {completedProductOrders.map((po) => (
                  <tr key={po.id}>
                    <td>{po.client.name} {po.client.lastName}</td>
                    <td>{po.items.map((i) => `${i.product.name} x${i.quantity}`).join(', ')}</td>
                    <td>${po.total}</td>
                    <td><span className="badge">{po.status}</span></td>
                    <td>{po.delivery?.agent.name || 'Sin asignar'}</td>
                    <td>{po.delivery?.deliveryCommission ? `$${po.delivery.deliveryCommission}` : '—'}</td>
                    <td>{formatDate(po.delivery?.deliveredAt ?? null)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={2} style={{ textAlign: 'right', fontWeight: 700 }}>Totales</td>
                  <td style={{ fontWeight: 700 }}>${totalProductSales.toFixed(2)}</td>
                  <td></td>
                  <td></td>
                  <td style={{ fontWeight: 700 }}>${totalDeliveryCommission.toFixed(2)}</td>
                  <td></td>
                </tr>
                <tr>
                  <td colSpan={5} style={{ textAlign: 'right', fontWeight: 700 }}>
                    Total general (ventas + comisión)
                  </td>
                  <td colSpan={2} style={{ fontWeight: 700 }}>
                    ${(totalProductSales + totalDeliveryCommission).toFixed(2)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>
        </>
      )}
    </div>
  )
}