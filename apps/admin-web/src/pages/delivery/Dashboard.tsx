import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { api } from '../../services/api'
import { useAuthStore } from '../../store/auth.store'
import { useToastStore } from '../../store/toast.store'
import { useConfirm } from '../../hooks/useConfirm'
import { POLL_INTERVAL_MS } from '../../config/constants'
import { getStatusBadge, badgeClassName } from '../../utils/statusBadge'

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
  notes: string | null
  client: { name: string; lastName: string; phone: string }
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

// Estilo del resaltado para entregas nuevas — mismo criterio en los 3 paneles internos.
const NEW_CARD_STYLE: CSSProperties = {
  backgroundColor: '#fff8e1',
  borderLeft: '4px solid #f59e0b',
}

const NEW_BADGE_STYLE: CSSProperties = {
  backgroundColor: 'var(--color-secondary)',
  color: '#fff',
  marginLeft: 8,
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

function getMonthRange(date = new Date()) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0)
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999)
  return { start, end }
}

export default function DeliveryDashboard() {
  const user = useAuthStore((state) => state.user)
  const showToast = useToastStore((state) => state.showToast)
  const confirmDialog = useConfirm()
  const [deliveries, setDeliveries] = useState<Delivery[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [newIds, setNewIds] = useState<Set<string>>(new Set())
  const [tab, setTab] = useState<'entregas' | 'resumen'>('entregas')

  useEffect(() => {
    fetchData()
    // Polling automático — mismo intervalo que Admin y Técnico, para que los
    // 3 paneles internos se mantengan coordinados entre sí.
    const interval = setInterval(() => fetchData(true), POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [])

  const fetchData = async (isPoll = false) => {
    if (!isPoll) {
      setLoading(true)
      setError('')
    }
    try {
      const res = await api.get('/api/product-orders/my-deliveries')
      const freshDeliveries: Delivery[] = res.data.data

      if (isPoll) {
        setDeliveries((prev) => {
          const prevIds = new Set(prev.map((d) => d.id))
          const freshIds = freshDeliveries
            .filter((d) => !prevIds.has(d.id))
            .map((d) => d.id)
          if (freshIds.length > 0) {
            setNewIds((prevNew) => new Set([...prevNew, ...freshIds]))
          }
          return freshDeliveries
        })
      } else {
        setDeliveries(freshDeliveries)
      }
    } catch (err) {
      // En polling silencioso no mostramos el error de página completa —
      // los datos ya cargados siguen visibles, solo se reintenta en el próximo ciclo.
      if (!isPoll) setError('Error al cargar tus entregas')
    } finally {
      if (!isPoll) setLoading(false)
    }
  }

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id))
    if (newIds.has(id)) {
      setNewIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
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

  const { start: monthStart, end: monthEnd } = getMonthRange()
  const monthlyDeliveries = completedWithCommission.filter((d) => {
    if (!d.deliveredAt) return false
    const dDate = new Date(d.deliveredAt)
    return dDate >= monthStart && dDate <= monthEnd
  })
  const monthlyCommission = monthlyDeliveries.reduce(
    (sum, d) => sum + Number(d.deliveryCommission),
    0
  )
  const monthLabel = monthStart.toLocaleDateString('es-VE', { month: 'long', year: 'numeric' })

  if (loading) return <div className="page-container"><p>Cargando…</p></div>
  if (error) return <div className="page-container"><p className="alert-error">{error}</p></div>

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>Panel de Motorizado</h1>
          <p>Hola, {user?.name}</p>
        </div>
        <button className="btn btn-secondary" onClick={() => fetchData()}>
          ↻ Actualizar
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <button
          className={tab === 'entregas' ? 'btn btn-primary' : 'btn btn-outline'}
          onClick={() => setTab('entregas')}
        >
          Entregas
        </button>
        <button
          className={tab === 'resumen' ? 'btn btn-primary' : 'btn btn-outline'}
          onClick={() => setTab('resumen')}
        >
          📊 Resumen y Comisiones
        </button>
      </div>

      {tab === 'entregas' && (
        <>
      <div className="card">
        <h2>Mis Entregas Pendientes ({pendingDeliveries.length})</h2>

        {pendingDeliveries.length === 0 ? (
          <p>No tienes entregas pendientes</p>
        ) : (
          pendingDeliveries.map((delivery) => {
            const isExpanded = expandedId === delivery.id
            const isNew = newIds.has(delivery.id)
            const order = delivery.productOrder

            return (
              <div key={delivery.id} className="card" style={isNew ? NEW_CARD_STYLE : undefined}>
                <div
                  className="accordion-card-header"
                  onClick={() => toggleExpand(delivery.id)}
                >
                  <div className="accordion-card-header__summary">
                    <strong>Pedido #{order.id.slice(0, 8)}</strong> — {order.client.name} {order.client.lastName}
                    {isNew && <span className="badge" style={NEW_BADGE_STYLE}>🆕 Nuevo</span>}
                    <br />
                    <span className={badgeClassName(getStatusBadge('delivery', delivery.status).variant)}>
                      {getStatusBadge('delivery', delivery.status).label}
                    </span> · Total: ${order.total}
                  </div>
                  <span>{isExpanded ? '▲' : '▼'}</span>
                </div>

                {isExpanded && (
                  <div style={{ marginTop: 12, borderTop: '1px solid var(--color-border)', paddingTop: 12 }}>
                    <p><strong>Cliente:</strong> {order.client.name} {order.client.lastName}</p>
                    <p><strong>Teléfono:</strong> {order.client.phone ? (
                      <a href={`tel:${order.client.phone}`}>{order.client.phone}</a>
                    ) : 'No registrado'}</p>
                    <p><strong>Dirección de entrega:</strong> {order.address || 'No especificada'}</p>
                    <p><strong>Método de pago:</strong> {PAYMENT_LABEL[order.paymentMethod] ?? order.paymentMethod}</p>
                    {order.notes && (
                      <p><strong>Notas del cliente:</strong> {order.notes}</p>
                    )}

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
          <div key={delivery.id} className="history-row">
            <strong>Pedido #{delivery.productOrder.id.slice(0, 8)}</strong> — {delivery.productOrder.client.name}{' '}
            {delivery.productOrder.client.lastName} — entregado {delivery.deliveredAt && formatDate(delivery.deliveredAt)}
            {delivery.deliveryCommission != null && <span className="history-amount"> · Comisión: ${delivery.deliveryCommission}</span>}
          </div>
        ))}
        {completedDeliveries.length === 0 && <p>Aún no tienes entregas completadas</p>}
        <p style={{ textAlign: 'right', fontWeight: 700, marginTop: 12 }}>
          Total comisiones: ${totalCommission.toFixed(2)}
        </p>
      </div>
        </>
      )}

      {tab === 'resumen' && (
      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
        <div className="card">
          <h3>Resumen mensual — {monthLabel}</h3>
          <p>Entregas completadas: {monthlyDeliveries.length}</p>
          <p>Comisión ganada: ${monthlyCommission.toFixed(2)}</p>
        </div>
        <div className="card">
          <h3>Corte semanal (lun. a sáb.)</h3>
          <p>{monday.toLocaleDateString('es-VE')} — {saturday.toLocaleDateString('es-VE')}</p>
          <p>Entregas esta semana: {weeklyDeliveries.length}</p>
          <p>Comisión de esta semana: ${weeklyCommission.toFixed(2)}</p>
        </div>
      </div>
      )}
    </div>
  )
}