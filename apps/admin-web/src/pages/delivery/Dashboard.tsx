import { useEffect, useState } from 'react'
import { api } from '../../services/api'
import { useAuthStore } from '../../store/auth.store'

type DeliveryStatus =
  | 'ASSIGNED'
  | 'LEAVING_STORE'
  | 'ON_THE_WAY'
  | 'AT_LOCATION'
  | 'DIAGNOSING_ON_SITE'
  | 'EQUIPMENT_PICKED_UP'
  | 'AT_THE_SHOP'
  | 'RETURNING'
  | 'DELIVERED'
  | 'CANCELLED'

interface ProductInOrder {
  quantity: number
  product: { name: string }
}

interface ProductOrder {
  id: string
  address: string | null
  total: string
  paymentMethod: string
  client: { name: string; lastName: string }
  items: ProductInOrder[]
}

interface Delivery {
  id: string
  status: DeliveryStatus
  deliveredAt: string | null
  createdAt: string
  productOrder: ProductOrder
}

export default function DeliveryDashboard() {
  const user = useAuthStore((state) => state.user)
  const [deliveries, setDeliveries] = useState<Delivery[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api.get('/api/product-orders/my-deliveries')
      setDeliveries(res.data.data)
    } catch (err) {
      setError('Error al cargar tus entregas')
    } finally {
      setLoading(false)
    }
  }

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id))
  }

  const handleMarkDelivered = async (productOrderId: string) => {
    if (!confirm('¿Confirmas que este pedido fue entregado?')) return

    try {
      await api.patch(`/api/product-orders/${productOrderId}/deliver`)
      alert('✅ Pedido marcado como entregado')
      fetchData()
    } catch (err) {
      alert('❌ Error al marcar el pedido como entregado')
    }
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('es-VE', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const pendingDeliveries = deliveries.filter((d) => d.status !== 'DELIVERED')
  const completedDeliveries = deliveries.filter((d) => d.status === 'DELIVERED')

  if (loading) return <p>Cargando...</p>
  if (error) return <p>{error}</p>

  return (
    <div>
      <h1>Panel de Motorizado</h1>
      <p>Hola, {user?.name}</p>

      <h2>Mis Entregas Pendientes ({pendingDeliveries.length})</h2>

      {pendingDeliveries.length === 0 ? (
        <p>No tienes entregas pendientes</p>
      ) : (
        pendingDeliveries.map((delivery) => {
          const isExpanded = expandedId === delivery.id
          const order = delivery.productOrder

          return (
            <div
              key={delivery.id}
              style={{
                border: '1px solid #ccc',
                borderRadius: 8,
                padding: 16,
                marginBottom: 12,
              }}
            >
              <div
                style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}
                onClick={() => toggleExpand(delivery.id)}
              >
                <div>
                  <strong>Pedido #{order.id.slice(0, 8)}</strong> — {order.client.name} {order.client.lastName}
                  <br />
                  {delivery.status} · Total: ${order.total}
                </div>
                <span>{isExpanded ? '▲' : '▼'}</span>
              </div>

              {isExpanded && (
                <div style={{ marginTop: 12, borderTop: '1px solid #eee', paddingTop: 12 }}>
                  <p><strong>Dirección de entrega:</strong> {order.address || 'No especificada'}</p>
                  <p><strong>Método de pago:</strong> {order.paymentMethod}</p>

                  <h4>Productos</h4>
                  <ul>
                    {order.items.map((item, idx) => (
                      <li key={idx}>
                        {item.quantity}x {item.product.name}
                      </li>
                    ))}
                  </ul>

                  <p style={{ fontSize: '0.9em', color: '#666' }}>
                    Asignado: {formatDate(delivery.createdAt)}
                  </p>

                  <button onClick={() => handleMarkDelivered(order.id)}>
                    Marcar como entregado
                  </button>
                </div>
              )}
            </div>
          )
        })
      )}

      <div style={{ marginTop: 32 }}>
        <h3>Entregas completadas ({completedDeliveries.length})</h3>
        {completedDeliveries.map((delivery) => (
          <div key={delivery.id} style={{ fontSize: '0.9em', marginBottom: 6 }}>
            <strong>Pedido #{delivery.productOrder.id.slice(0, 8)}</strong> — {delivery.productOrder.client.name}{' '}
            {delivery.productOrder.client.lastName} — entregado {delivery.deliveredAt && formatDate(delivery.deliveredAt)}
          </div>
        ))}
      </div>
    </div>
  )
}