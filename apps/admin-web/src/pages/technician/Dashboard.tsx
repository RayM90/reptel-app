import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { api } from '../../services/api'
import { useAuthStore } from '../../store/auth.store'
import { useToastStore } from '../../store/toast.store'
import { POLL_INTERVAL_MS } from '../../config/constants'
import { getStatusBadge, badgeClassName } from '../../utils/statusBadge'

type OrderStatus =
  | 'PENDING_PAYMENT'
  | 'RECEIVED'
  | 'DIAGNOSING'
  | 'WAITING_APPROVAL'
  | 'APPROVED'
  | 'REPAIRING'
  | 'WAITING_PART'
  | 'READY'
  | 'DELIVERED'
  | 'CANCELLED'

const STATUS_OPTIONS: OrderStatus[] = [
  'RECEIVED',
  'DIAGNOSING',
  'WAITING_APPROVAL',
  'APPROVED',
  'REPAIRING',
  'WAITING_PART',
  'READY',
  'DELIVERED',
  'CANCELLED',
]

interface StatusHistoryEntry {
  id: string
  status: OrderStatus
  comment: string | null
  createdAt: string
}

interface CatalogItem {
  id: string
  name: string
  basePrice: string
}

interface TechOrder {
  id: string
  orderNumber: string
  status: OrderStatus
  problem: string
  diagnosis: string | null
  budget: string | null
  deliveryAmount: string | null
  revisionAmount: string | null
  technicianCommission: string | null
  finalPaymentConfirmedAt: string | null
  client: { name: string; lastName: string }
  device: { type: string; brand: string; model: string; color: string }
  serviceCatalog: { id: string; name: string } | null
  statusHistory: StatusHistoryEntry[]
}

// Estilo del resaltado para órdenes nuevas — mismo criterio en los 3 paneles internos.
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

export default function TechnicianDashboard() {
  const user = useAuthStore((state) => state.user)
  const showToast = useToastStore((state) => state.showToast)
  const [orders, setOrders] = useState<TechOrder[]>([])
  const [catalog, setCatalog] = useState<CatalogItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [newIds, setNewIds] = useState<Set<string>>(new Set())
  const [tab, setTab] = useState<'ordenes' | 'resumen'>('ordenes')

  const [diagnosisText, setDiagnosisText] = useState<Record<string, string>>({})
  const [budgetText, setBudgetText] = useState<Record<string, string>>({})
  const [catalogSelection, setCatalogSelection] = useState<Record<string, string>>({})

  const [commentText, setCommentText] = useState<Record<string, string>>({})
  const [statusSelection, setStatusSelection] = useState<Record<string, OrderStatus>>({})
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetchData()
    // Polling automático — mismo intervalo que Admin y Motorizado, para que los
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
      const [ordersRes, catalogRes] = await Promise.all([
        api.get('/api/orders/technician/my-orders'),
        api.get('/api/catalog'),
      ])
      const freshOrders: TechOrder[] = ordersRes.data.data

      if (isPoll) {
        setOrders((prev) => {
          const prevIds = new Set(prev.map((o) => o.id))
          const freshIds = freshOrders.filter((o) => !prevIds.has(o.id)).map((o) => o.id)
          if (freshIds.length > 0) {
            setNewIds((prevNew) => new Set([...prevNew, ...freshIds]))
          }
          return freshOrders
        })
      } else {
        setOrders(freshOrders)
      }

      setCatalog(catalogRes.data.data)
    } catch (err) {
      // En polling silencioso no mostramos el error de página completa —
      // los datos ya cargados siguen visibles, solo se reintenta en el próximo ciclo.
      if (!isPoll) setError('Error al cargar tus órdenes')
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

  const handleSubmitDiagnosis = async (orderId: string) => {
    const key = `diag:${orderId}`
    if (pendingIds.has(key)) return
    const diagnosis = diagnosisText[orderId]
    const budget = budgetText[orderId]
    const serviceCatalogId = catalogSelection[orderId] || undefined

    if (!diagnosis || !budget) {
      showToast('Completa el diagnóstico y el presupuesto antes de enviar.', 'error')
      return
    }

    setPendingIds((prev) => new Set(prev).add(key))
    try {
      await api.patch(`/api/orders/${orderId}/diagnosis`, {
        diagnosis,
        budget: Number(budget),
        serviceCatalogId,
      })
      showToast('✅ Diagnóstico registrado. La orden queda esperando aprobación del presupuesto.', 'success')
      fetchData()
    } catch (err) {
      showToast('❌ Error al registrar el diagnóstico', 'error')
    } finally {
      setPendingIds((prev) => {
        const next = new Set(prev)
        next.delete(key)
        return next
      })
    }
  }

  const handleSubmitComment = async (orderId: string, currentStatus: OrderStatus) => {
    const key = `comment:${orderId}`
    if (pendingIds.has(key)) return
    const comment = commentText[orderId]
    const status = statusSelection[orderId] || currentStatus

    if (!comment) {
      showToast('Escribe un comentario antes de enviar.', 'error')
      return
    }

    setPendingIds((prev) => new Set(prev).add(key))
    try {
      await api.patch(`/api/orders/${orderId}/status`, { status, comment })
      showToast('✅ Comentario registrado.', 'success')
      setCommentText((prev) => ({ ...prev, [orderId]: '' }))
      fetchData()
    } catch (err) {
      showToast('❌ Error al registrar el comentario', 'error')
    } finally {
      setPendingIds((prev) => {
        const next = new Set(prev)
        next.delete(key)
        return next
      })
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

  const activeOrders = orders.filter((o) => o.technicianCommission == null)
  const completedOrders = orders.filter((o) => o.technicianCommission != null)
  const totalCommission = completedOrders.reduce(
    (sum, o) => sum + Number(o.technicianCommission),
    0
  )

  const { monday, saturday } = getWeekRange()
  const weeklyOrders = completedOrders.filter((o) => {
    if (!o.finalPaymentConfirmedAt) return false
    const d = new Date(o.finalPaymentConfirmedAt)
    return d >= monday && d <= saturday
  })
  const weeklyCommission = weeklyOrders.reduce(
    (sum, o) => sum + Number(o.technicianCommission),
    0
  )

  const { start: monthStart, end: monthEnd } = getMonthRange()
  const monthlyOrders = completedOrders.filter((o) => {
    if (!o.finalPaymentConfirmedAt) return false
    const d = new Date(o.finalPaymentConfirmedAt)
    return d >= monthStart && d <= monthEnd
  })
  const monthlyCommission = monthlyOrders.reduce(
    (sum, o) => sum + Number(o.technicianCommission),
    0
  )
  const monthLabel = monthStart.toLocaleDateString('es-VE', { month: 'long', year: 'numeric' })

  if (loading) return <div className="page-container"><p>Cargando…</p></div>
  if (error) return <div className="page-container"><p className="alert-error">{error}</p></div>

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>Panel del Técnico</h1>
          <p>Hola, {user?.name}</p>
        </div>
        <button className="btn btn-secondary" onClick={() => fetchData()}>
          ↻ Actualizar
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <button
          className={tab === 'ordenes' ? 'btn btn-primary' : 'btn btn-outline'}
          onClick={() => setTab('ordenes')}
        >
          Órdenes
        </button>
        <button
          className={tab === 'resumen' ? 'btn btn-primary' : 'btn btn-outline'}
          onClick={() => setTab('resumen')}
        >
          📊 Resumen y Comisiones
        </button>
      </div>

      {tab === 'ordenes' && (
        <>
      <div className="card">
        <h2>Mis Órdenes Activas ({activeOrders.length})</h2>

        {activeOrders.length === 0 ? (
          <p>No tienes órdenes activas</p>
        ) : (
          activeOrders.map((order) => {
            const isExpanded = expandedId === order.id
            const isNew = newIds.has(order.id)
            const needsDiagnosis = order.budget == null

            return (
              <div key={order.id} className="card" style={isNew ? NEW_CARD_STYLE : undefined}>
                <div
                  className="accordion-card-header"
                  onClick={() => toggleExpand(order.id)}
                >
                  <div className="accordion-card-header__summary">
                    <strong>{order.orderNumber}</strong> — {order.client.name} {order.client.lastName}
                    {isNew && <span className="badge" style={NEW_BADGE_STYLE} role="img" aria-label="Orden nueva, no revisada todavía">🆕 Nuevo</span>}
                    <br />
                    {order.device.brand} {order.device.model} ·{' '}
                    <span className={badgeClassName(getStatusBadge('order', order.status).variant)}>
                      {getStatusBadge('order', order.status).label}
                    </span>
                    {order.technicianCommission != null && (
                      <span> · Comisión: ${order.technicianCommission}</span>
                    )}
                  </div>
                  <span>{isExpanded ? '▲' : '▼'}</span>
                </div>

                {isExpanded && (
                  <div style={{ marginTop: 12, borderTop: '1px solid var(--color-border)', paddingTop: 12 }}>
                    <p><strong>Problema:</strong> {order.problem}</p>
                    {order.diagnosis && <p><strong>Diagnóstico:</strong> {order.diagnosis}</p>}
                    {order.budget && <p><strong>Presupuesto:</strong> ${order.budget}</p>}

                    {needsDiagnosis && (
                      <div className="card">
                        <h4>Registrar diagnóstico</h4>
                        <div className="form-group">
                          <label>Diagnóstico</label>
                          <textarea
                            value={diagnosisText[order.id] || ''}
                            onChange={(e) =>
                              setDiagnosisText((prev) => ({ ...prev, [order.id]: e.target.value }))
                            }
                            rows={3}
                          />
                        </div>
                        <div className="form-group">
                          <label>Servicio del catálogo (opcional)</label>
                          <select
                            value={catalogSelection[order.id] || ''}
                            onChange={(e) =>
                              setCatalogSelection((prev) => ({ ...prev, [order.id]: e.target.value }))
                            }
                          >
                            <option value="">-- Ninguno / diagnóstico manual --</option>
                            {catalog.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name} (${c.basePrice})
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="form-group">
                          <label>Presupuesto ($)</label>
                          <input
                            type="number"
                            value={budgetText[order.id] || ''}
                            onChange={(e) =>
                              setBudgetText((prev) => ({ ...prev, [order.id]: e.target.value }))
                            }
                          />
                        </div>
                        <button className="btn btn-primary" disabled={pendingIds.has(`diag:${order.id}`)} onClick={() => handleSubmitDiagnosis(order.id)}>
                          Enviar diagnóstico
                        </button>
                      </div>
                    )}

                    {!needsDiagnosis && (
                    <div className="card">
                      <h4>Agregar comentario de progreso</h4>
                      <div className="form-group">
                        <label>Estado</label>
                        <select
                          value={statusSelection[order.id] || order.status}
                          onChange={(e) =>
                            setStatusSelection((prev) => ({
                              ...prev,
                              [order.id]: e.target.value as OrderStatus,
                            }))
                          }
                        >
                          {STATUS_OPTIONS.map((s) => (
                            <option key={s} value={s}>
                              {getStatusBadge('order', s).label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="form-group">
                        <textarea
                          value={commentText[order.id] || ''}
                          onChange={(e) =>
                            setCommentText((prev) => ({ ...prev, [order.id]: e.target.value }))
                          }
                          placeholder="Describe el avance del trabajo..."
                          rows={2}
                        />
                      </div>
                      <button className="btn btn-primary" disabled={pendingIds.has(`comment:${order.id}`)} onClick={() => handleSubmitComment(order.id, order.status)}>
                        Guardar comentario
                      </button>
                    </div>
                    )}

                    <h4>Historial</h4>
                    {order.statusHistory.map((entry) => (
                      <div key={entry.id} className="form-hint">
                        <strong>{getStatusBadge('order', entry.status).label}</strong> — {formatDate(entry.createdAt)}
                        {entry.comment && <div>{entry.comment}</div>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      <div className="card" style={{ marginTop: 32 }}>
        <h3>Órdenes completadas ({completedOrders.length})</h3>
        {completedOrders.length === 0 ? (
          <p>Aún no tienes órdenes completadas</p>
        ) : (
          completedOrders.map((order) => (
            <div key={order.id} className="history-row">
              <strong>{order.orderNumber}</strong> — {order.client.name} {order.client.lastName}{' '}
              — {order.device.brand} {order.device.model}
              {order.technicianCommission != null && (
                <span className="history-amount"> · Comisión: ${order.technicianCommission}</span>
              )}
            </div>
          ))
        )}
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
          <p>Servicios completados: {monthlyOrders.length}</p>
          <p>Comisión ganada: ${monthlyCommission.toFixed(2)}</p>
        </div>
        <div className="card">
          <h3>Corte semanal (lun. a sáb.)</h3>
          <p>{monday.toLocaleDateString('es-VE')} — {saturday.toLocaleDateString('es-VE')}</p>
          <p>Servicios esta semana: {weeklyOrders.length}</p>
          <p>Comisión de esta semana: ${weeklyCommission.toFixed(2)}</p>
        </div>
      </div>
      )}
    </div>
  )
}