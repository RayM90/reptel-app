import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../services/api'
import { useToastStore } from '../../store/toast.store'
import { useConfirm } from '../../hooks/useConfirm'

interface Order {
  id: string
  orderNumber: string
  status: string
  problem: string
  budget: string | null
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

interface ProductOrder {
  id: string
  status: string
  total: string
  client: { name: string; lastName: string }
  items: ProductOrderItem[]
  delivery: { agent: { name: string } } | null
  paymentDetails: Record<string, string> | null
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

export default function Dashboard() {
  const [orders, setOrders] = useState<Order[]>([])
  const [productOrders, setProductOrders] = useState<ProductOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const showToast = useToastStore((state) => state.showToast)
  const confirmDialog = useConfirm()

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    setError('')
    try {
      const [ordersRes, productOrdersRes] = await Promise.all([
        api.get('/api/orders'),
        api.get('/api/product-orders'),
      ])
      setOrders(ordersRes.data.data)
      setProductOrders(productOrdersRes.data.data)
    } catch (err) {
      setError('Error al cargar los datos del panel')
    } finally {
      setLoading(false)
    }
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

  // ── Pedidos de tienda ──
  const handleApproveProductPayment = async (id: string) => {
    try {
      await api.patch(`/api/product-orders/${id}/confirm-payment`, { approved: true })
      showToast('✅ Pago aprobado. Se asignó un motorizado automáticamente.', 'success')
      fetchData()
    } catch (err) {
      showToast('❌ Error al aprobar el pago', 'error')
    }
  }

  const handleRejectProductPayment = async (id: string) => {
    const reason = await confirmDialog({
      title: 'Rechazar pago de pedido',
      requireText: true,
      textLabel: 'Motivo del rechazo',
      confirmLabel: 'Rechazar',
    })
    if (!reason) return
    try {
      await api.patch(`/api/product-orders/${id}/confirm-payment`, {
        approved: false,
        rejectionReason: reason,
      })
      showToast('✅ Pago rechazado. Se notificó al cliente para que reenvíe sus datos.', 'success')
      fetchData()
    } catch (err) {
      showToast('❌ Error al rechazar el pago', 'error')
    }
  }

  const activeOrders = orders.filter(
    (o) => o.status !== 'DELIVERED' && o.status !== 'CANCELLED'
  )

  const activeProductOrders = productOrders.filter(
    (po) => po.status !== 'DELIVERED' && po.status !== 'CANCELLED'
  )

  if (loading) return <div className="page-container"><p>Cargando...</p></div>
  if (error) return <div className="page-container"><p className="alert-error">{error}</p></div>

  return (
    <div className="page-container">
      <h1>Panel de Administrador</h1>
      <p><Link to="/admin/create-staff">➕ Crear usuario de personal</Link></p>

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
                  <tr key={order.id}>
                    <td>{order.orderNumber}</td>
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
                  <th>Datos de pago</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {activeProductOrders.map((po) => (
                  <tr key={po.id}>
                    <td>{po.client.name} {po.client.lastName}</td>
                    <td>{po.items.map((i) => `${i.product.name} x${i.quantity}`).join(', ')}</td>
                    <td>${po.total}</td>
                    <td><span className="badge">{po.status}</span></td>
                    <td>{po.delivery?.agent.name || 'Sin asignar'}</td>
                    <td><PaymentDetailsView details={po.paymentDetails} /></td>
                    <td>
                      {po.status === 'PENDING' ? (
                        <>
                          <button
                            className="btn btn-primary"
                            onClick={() => handleApproveProductPayment(po.id)}
                            disabled={!po.paymentDetails}
                          >
                            Aprobar pago
                          </button>{' '}
                          <button className="btn btn-danger" onClick={() => handleRejectProductPayment(po.id)}>
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
            </table>
          </div>
        )}
      </section>
    </div>
  )
}