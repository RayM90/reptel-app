import { useEffect, useState } from 'react'
import { api } from '../../services/api'

interface Order {
  id: string
  orderNumber: string
  status: string
  problem: string
  budget: string | null
  client: { name: string; lastName: string }
  technician: { id: string; name: string } | null
  advancePaymentDetails: Record<string, string> | null
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
    <div style={{ fontSize: '0.85em', lineHeight: 1.5 }}>
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

  const handleApproveAdvancePayment = async (orderId: string) => {
    try {
      await api.post(`/api/orders/${orderId}/confirm-advance-payment`, { approved: true })
      alert('✅ Pago aprobado. La orden pasó a "Recibida".')
      fetchData()
    } catch (err) {
      alert('❌ Error al aprobar el pago')
    }
  }

  const handleRejectAdvancePayment = async (orderId: string) => {
    const reason = window.prompt('Motivo del rechazo:')
    if (!reason) return
    try {
      await api.post(`/api/orders/${orderId}/confirm-advance-payment`, {
        approved: false,
        rejectionReason: reason,
      })
      alert('✅ Pago rechazado. Se notificó al cliente para que reenvíe sus datos.')
      fetchData()
    } catch (err) {
      alert('❌ Error al rechazar el pago')
    }
  }

  const handleApproveProductPayment = async (id: string) => {
    try {
      await api.patch(`/api/product-orders/${id}/confirm-payment`, { approved: true })
      alert('✅ Pago aprobado. Se asignó un motorizado automáticamente.')
      fetchData()
    } catch (err) {
      alert('❌ Error al aprobar el pago')
    }
  }

  const handleRejectProductPayment = async (id: string) => {
    const reason = window.prompt('Motivo del rechazo:')
    if (!reason) return
    try {
      await api.patch(`/api/product-orders/${id}/confirm-payment`, {
        approved: false,
        rejectionReason: reason,
      })
      alert('✅ Pago rechazado. Se notificó al cliente para que reenvíe sus datos.')
      fetchData()
    } catch (err) {
      alert('❌ Error al rechazar el pago')
    }
  }

  const activeOrders = orders.filter(
    (o) => o.status !== 'DELIVERED' && o.status !== 'CANCELLED'
  )

  const activeProductOrders = productOrders.filter(
    (po) => po.status !== 'DELIVERED' && po.status !== 'CANCELLED'
  )

  if (loading) return <p>Cargando...</p>
  if (error) return <p>{error}</p>

  return (
    <div>
      <h1>Panel de Administrador</h1>

      <section>
        <h2>Servicios Técnicos Activos ({activeOrders.length})</h2>
        {activeOrders.length === 0 ? (
          <p>No hay servicios activos</p>
        ) : (
          <table border={1} cellPadding={8}>
            <thead>
              <tr>
                <th>Orden</th>
                <th>Cliente</th>
                <th>Problema</th>
                <th>Estado</th>
                <th>Presupuesto</th>
                <th>Técnico asignado</th>
                <th>Datos de pago</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {activeOrders.map((order) => (
                <tr key={order.id}>
                  <td>{order.orderNumber}</td>
                  <td>{order.client.name} {order.client.lastName}</td>
                  <td>{order.problem}</td>
                  <td>{order.status}</td>
                  <td>{order.budget ? `$${order.budget}` : '—'}</td>
                  <td>{order.technician?.name || 'Sin asignar'}</td>
                  <td><PaymentDetailsView details={order.advancePaymentDetails} /></td>
                  <td>
                    {order.status === 'PENDING_PAYMENT' ? (
                      <>
                        <button
                          onClick={() => handleApproveAdvancePayment(order.id)}
                          disabled={!order.advancePaymentDetails}
                        >
                          Aprobar pago
                        </button>{' '}
                        <button onClick={() => handleRejectAdvancePayment(order.id)}>
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
        )}
      </section>

      <section>
        <h2>Pedidos de Tienda Activos ({activeProductOrders.length})</h2>
        {activeProductOrders.length === 0 ? (
          <p>No hay pedidos activos</p>
        ) : (
          <table border={1} cellPadding={8}>
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
                  <td>{po.status}</td>
                  <td>{po.delivery?.agent.name || 'Sin asignar'}</td>
                  <td><PaymentDetailsView details={po.paymentDetails} /></td>
                  <td>
                    {po.status === 'PENDING' ? (
                      <>
                        <button
                          onClick={() => handleApproveProductPayment(po.id)}
                          disabled={!po.paymentDetails}
                        >
                          Aprobar pago
                        </button>{' '}
                        <button onClick={() => handleRejectProductPayment(po.id)}>
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
        )}
      </section>
    </div>
  )
}