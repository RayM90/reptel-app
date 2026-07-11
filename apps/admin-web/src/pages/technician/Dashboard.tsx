import { useEffect, useState } from 'react'
import { api } from '../../services/api'
import { useAuthStore } from '../../store/auth.store'
import { useToastStore } from '../../store/toast.store'

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

export default function TechnicianDashboard() {
  const user = useAuthStore((state) => state.user)
  const showToast = useToastStore((state) => state.showToast)
  const [orders, setOrders] = useState<TechOrder[]>([])
  const [catalog, setCatalog] = useState<CatalogItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const [diagnosisText, setDiagnosisText] = useState<Record<string, string>>({})
  const [budgetText, setBudgetText] = useState<Record<string, string>>({})
  const [catalogSelection, setCatalogSelection] = useState<Record<string, string>>({})

  const [commentText, setCommentText] = useState<Record<string, string>>({})
  const [statusSelection, setStatusSelection] = useState<Record<string, OrderStatus>>({})

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    setError('')
    try {
      const [ordersRes, catalogRes] = await Promise.all([
        api.get('/api/orders/technician/my-orders'),
        api.get('/api/catalog'),
      ])
      setOrders(ordersRes.data.data)
      setCatalog(catalogRes.data.data)
    } catch (err) {
      setError('Error al cargar tus órdenes')
    } finally {
      setLoading(false)
    }
  }

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id))
  }

  const handleSubmitDiagnosis = async (orderId: string) => {
    const diagnosis = diagnosisText[orderId]
    const budget = budgetText[orderId]
    const serviceCatalogId = catalogSelection[orderId] || undefined

    if (!diagnosis || !budget) {
      showToast('Completa el diagnóstico y el presupuesto antes de enviar.', 'error')
      return
    }

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
    }
  }

  const handleSubmitComment = async (orderId: string, currentStatus: OrderStatus) => {
    const comment = commentText[orderId]
    const status = statusSelection[orderId] || currentStatus

    if (!comment) {
      showToast('Escribe un comentario antes de enviar.', 'error')
      return
    }

    try {
      await api.patch(`/api/orders/${orderId}/status`, { status, comment })
      showToast('✅ Comentario registrado.', 'success')
      setCommentText((prev) => ({ ...prev, [orderId]: '' }))
      fetchData()
    } catch (err) {
      showToast('❌ Error al registrar el comentario', 'error')
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

  if (loading) return <div className="page-container"><p>Cargando...</p></div>
  if (error) return <div className="page-container"><p className="alert-error">{error}</p></div>

  return (
    <div className="page-container">
      <h1>Panel del Técnico</h1>
      <p>Hola, {user?.name}</p>

      <div className="card">
        <h2>Mis Órdenes ({orders.length})</h2>

        {orders.length === 0 ? (
          <p>No tienes órdenes asignadas</p>
        ) : (
          orders.map((order) => {
            const isExpanded = expandedId === order.id
            const needsDiagnosis = order.budget == null

            return (
              <div key={order.id} className="card">
                <div
                  style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}
                  onClick={() => toggleExpand(order.id)}
                >
                  <div>
                    <strong>{order.orderNumber}</strong> — {order.client.name} {order.client.lastName}
                    <br />
                    {order.device.brand} {order.device.model} · <span className="badge">{order.status}</span>
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
                        <button className="btn btn-primary" onClick={() => handleSubmitDiagnosis(order.id)}>
                          Enviar diagnóstico
                        </button>
                      </div>
                    )}

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
                              {s}
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
                      <button className="btn btn-primary" onClick={() => handleSubmitComment(order.id, order.status)}>
                        Guardar comentario
                      </button>
                    </div>

                    <h4>Historial</h4>
                    {order.statusHistory.map((entry) => (
                      <div key={entry.id} className="form-hint">
                        <strong>{entry.status}</strong> — {formatDate(entry.createdAt)}
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

      <div style={{ display: 'flex', gap: 20, marginTop: 32, flexWrap: 'wrap' }}>
        <div className="card">
          <h3>Resumen histórico</h3>
          <p>Servicios completados: {completedOrders.length}</p>
          <p>Comisión total ganada: ${totalCommission.toFixed(2)}</p>
        </div>
        <div className="card">
          <h3>Corte semanal (lun. a sáb.)</h3>
          <p>{monday.toLocaleDateString('es-VE')} — {saturday.toLocaleDateString('es-VE')}</p>
          <p>Servicios esta semana: {weeklyOrders.length}</p>
          <p>Comisión de esta semana: ${weeklyCommission.toFixed(2)}</p>
        </div>
      </div>
    </div>
  )
}