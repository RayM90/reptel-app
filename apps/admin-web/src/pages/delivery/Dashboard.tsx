import { useEffect, useState } from 'react'
import { api } from '../../services/api'
import { useAuthStore } from '../../store/auth.store'
import { useToastStore } from '../../store/toast.store'
import { useConfirm } from '../../hooks/useConfirm'

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
  deliveryCommission: string | null
  productOrder: ProductOrder
}

const PAYMENT_LABEL: Record<string, string> = {
  MOBILE_PAYMENT: '📱 Pago Móvil',
  TRANSFER: '🏦 Transferencia',
  BINANCE: '₿ Binance',
}

function getWeekRange(date = new Date()) {
  const day = date.getDay()
  const diffToMonday = day === 0 ? -6 : 1 - day
  const monday = new Date(date)
  monday.setDate(date.getDate() + diffToMonday)
  monday.setHours(0, 0, 0, 0)
  const saturday = new Date(monday)
  saturday.setDate(monday.getDate() + 5)
  saturday.setHours(23, 59, 59, 999)
  return { monday, saturday }
}

export default function DeliveryDashboard() {
  const user = useAuthStore((state) => state.user)
  const showToast = useToastStore((state) => state.showToast)
  const confirmDialog = useConfirm()
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
    const confirmed = await confirmDialog({
      title: '¿Confirmas que este pedido fue entregado?',
      confirmLabel: 'Confirmar entrega',
    })
    if (!confirmed) return

    try {
      await api.patch(`/api/product-orders/${productOrderId}/deliver`)
      showToast('✅ Pedido marcado como entregado', 'success')
      fetchData()
    } catch (err) {
      showToast('❌ Error al marcar el pedido como entregado', 'error')
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

  const completedWithCommission = completedDeliveries.filter((d) => d.deliveryCommission != null)
  const totalCommission = completedWithCommission.reduce(
    (sum, d) => sum + Number(d.deliveryCommission),
    0
  )

  const { monday, saturday } = getWeekRange()
  const weeklyDeliveries = completedWithCommission.filter((d) => {
    if (!d.deliveredAt) return false
    const dDate = new Date(d.deliveredAt)
    return dDate >= monday && dDate <= saturday
  })
  const weeklyCommission = weeklyDeliveries.reduce(
    (sum, d) => sum + Number(d.deliveryCommission),
    0
  )

  if (loading) return <div className="page-container"><p>Cargando...</p></div>
  if (error) return <div className="page-container"><p className="alert-error">{error}</p></div>

  return (
    <div className="page-container">
      <h1>Panel de Motorizado</h1>
      <p>Hola, {user?.name}</p>

      <div className="card">
        <h2>Mis Entregas Pendientes ({pendingDeliveries.length})</h2>

        {pendingDeliveries.length === 0 ? (
          <p>No tienes entregas pendientes</p>
        ) : (
          pendingDeliveries.map((delivery) => {
            const isExpanded = expandedId === delivery.id
            const order = delivery.productOrder

            return (
              <div key={delivery.id} className="card">
                <div
                  style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}
                  onClick={() => toggleExpand(delivery.id)}
                >
                  <div>
                    <strong>Pedido #{order.id.slice(0, 8)}</strong> — {order.client.name} {order.client.lastName}
                    <br />
                    <span className="badge">{delivery.status}</span> · Total: ${order.total}
                  </div>
                  <span>{isExpanded ? '▲' : '▼'}</span>
                </div>

                {isExpanded && (
                  <div style={{ marginTop: 12, borderTop: '1px solid var(--color-border)', paddingTop: 12 }}>
                    <p><strong>Dirección de entrega:</strong> {order.address || 'No especificada'}</p>
                    <p><strong>Método de pago:</strong> {PAYMENT_LABEL[order.paymentMethod] ?? order.paymentMethod}</p>

                    <h4>Productos</h4>
                    <ul>
                      {order.items.map((item, idx) => (
                        <li key={idx}>
                          {item.quantity}x {item.product.name}
                        </li>
                      ))}
                    </ul>

                    <p className="form-hint">
                      Asignado: {formatDate(delivery.createdAt)}
                    </p>

                    <button className="btn btn-primary" onClick={() => handleMarkDelivered(order.id)}>
                      Marcar como entregado
                    </button>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      <div className="card" style={{ marginTop: 32 }}>
        <h3>Entregas completadas ({completedDeliveries.length})</h3>
        {completedDeliveries.map((delivery) => (
          <div key={delivery.id} className="form-hint">
            <strong>Pedido #{delivery.productOrder.id.slice(0, 8)}</strong> — {delivery.productOrder.client.name}{' '}
            {delivery.productOrder.client.lastName} — entregado {delivery.deliveredAt && formatDate(delivery.deliveredAt)}
            {delivery.deliveryCommission != null && <span> · Comisión: ${delivery.deliveryCommission}</span>}
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 20, marginTop: 32, flexWrap: 'wrap' }}>
        <div className="card">
          <h3>Resumen histórico</h3>
          <p>Entregas completadas: {completedDeliveries.length}</p>
          <p>Comisión total ganada: ${totalCommission.toFixed(2)}</p>
        </div>
        <div className="card">
          <h3>Corte semanal (lun. a sáb.)</h3>
          <p>{monday.toLocaleDateString('es-VE')} — {saturday.toLocaleDateString('es-VE')}</p>
          <p>Entregas esta semana: {weeklyDeliveries.length}</p>
          <p>Comisión de esta semana: ${weeklyCommission.toFixed(2)}</p>
        </div>
      </div>
    </div>
  )
}