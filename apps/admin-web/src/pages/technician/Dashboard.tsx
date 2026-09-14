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

// REPAIRING y READY salieron de esta lista en la Tarea 4 (tienen su propio
// camino: el anticipo de presupuesto confirmado y "Finalizar reparación").
// DELIVERED sale por el mismo criterio (Finding G, revisión final): era una
// ruta gratuita a "entregado" que salteaba el cobro del saldo final. La única
// vía legítima es markOrderDelivered desde el panel admin, que exige
// PAID_PENDING_DELIVERY — el backend también lo rechaza por esta vía.
const STATUS_OPTIONS: OrderStatus[] = [
  'RECEIVED',
  'DIAGNOSING',
  'WAITING_APPROVAL',
  'APPROVED',
  'WAITING_PART',
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

interface PartUsed {
  id: string
  quantity: number
  unitPriceAtUse: string | null
  createdAt: string
  reversedAt: string | null
  product: { id: string; name: string }
  user: { id: string; name: string; lastName: string | null } | null
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
  deliveredAt: string | null
  finalPaymentDetails: Record<string, string> | null
  finalPaymentConfirmed: boolean
  client: { name: string; lastName: string }
  device: { type: string; brand: string; model: string; color: string; accessories: string; devicePassword: string | null; serialNumber: string | null }
  serviceCatalog: { id: string; name: string; basePrice: string } | null
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
  const [manualExtraText, setManualExtraText] = useState<Record<string, string>>({})

  const getPartsSubtotal = (orderId: string, partsOverride?: PartUsed[]) =>
    (partsOverride ?? partsByOrder[orderId] ?? [])
      .filter((p) => !p.reversedAt)
      .reduce((sum, p) => sum + p.quantity * Number(p.unitPriceAtUse ?? 0), 0)

  // El presupuesto se autollena con catálogo + monto manual + repuestos ya
  // usados (que el backend ya sumó a Order.budget al agregarlos — si no lo
  // reflejamos acá, enviar el diagnóstico lo pisaría con un total menor).
  // Sigue siendo editable a mano por si el técnico necesita ajustarlo directo.
  const recomputeBudget = (orderId: string, catalogId: string, manualExtra: string, partsOverride?: PartUsed[]) => {
    const catalogPrice = catalogId ? Number(catalog.find((c) => c.id === catalogId)?.basePrice ?? 0) : 0
    const extra = Number(manualExtra) || 0
    const partsSubtotal = getPartsSubtotal(orderId, partsOverride)
    setBudgetText((prev) => ({ ...prev, [orderId]: (catalogPrice + extra + partsSubtotal).toFixed(2) }))
  }

  const [commentText, setCommentText] = useState<Record<string, string>>({})
  const [statusSelection, setStatusSelection] = useState<Record<string, OrderStatus>>({})
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set())

  // ── Finalizar reparación: ajuste de presupuesto + cierre ──
  // El ajuste es una opción que el técnico activa si la necesita — no un
  // formulario siempre desplegado — para no distraer del cierre normal.
  const [adjustmentAmountText, setAdjustmentAmountText] = useState<Record<string, string>>({})
  const [adjustmentReasonText, setAdjustmentReasonText] = useState<Record<string, string>>({})
  const [finishObservationText, setFinishObservationText] = useState<Record<string, string>>({})
  const [showAdjustment, setShowAdjustment] = useState<Record<string, boolean>>({})

  // ── Repuestos de inventario usados en la orden ──
  const [products, setProducts] = useState<{ id: string; name: string; stock: number; price: string }[]>([])
  const [partsByOrder, setPartsByOrder] = useState<Record<string, PartUsed[]>>({})
  const [partsProductId, setPartsProductId] = useState<Record<string, string>>({})
  const [partsQuantity, setPartsQuantity] = useState<Record<string, string>>({})

  useEffect(() => {
    fetchData()
    api.get('/api/products').then((res) => setProducts(res.data.data))
    // Polling automático — mismo intervalo que Admin y Motorizado, para que los
    // 3 paneles internos se mantengan coordinados entre sí.
    const interval = setInterval(() => fetchData(true), POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [])

  const fetchParts = async (orderId: string): Promise<PartUsed[]> => {
    try {
      const res = await api.get(`/api/orders/${orderId}/parts`)
      setPartsByOrder((prev) => ({ ...prev, [orderId]: res.data.data }))
      return res.data.data
    } catch {
      // silencioso — no bloquea el resto del detalle de la orden
      return partsByOrder[orderId] ?? []
    }
  }

  const handleAddPart = async (orderId: string) => {
    const productId = partsProductId[orderId]
    const quantity = Number(partsQuantity[orderId])
    if (!productId || !Number.isInteger(quantity) || quantity <= 0) {
      showToast('Elegí un producto y una cantidad válida', 'error')
      return
    }
    try {
      await api.post(`/api/orders/${orderId}/parts`, { productId, quantity })
      showToast('✅ Repuesto registrado, presupuesto actualizado', 'success')
      setPartsProductId((prev) => ({ ...prev, [orderId]: '' }))
      setPartsQuantity((prev) => ({ ...prev, [orderId]: '' }))
      const freshParts = await fetchParts(orderId)
      recomputeBudget(orderId, catalogSelection[orderId] || '', manualExtraText[orderId] || '', freshParts)
      fetchData(true)
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Error al registrar el repuesto', 'error')
    }
  }

  const handleRevertPart = async (orderId: string, movementId: string) => {
    try {
      await api.delete(`/api/orders/${orderId}/parts/${movementId}`)
      showToast('Repuesto revertido — stock y presupuesto restaurados', 'success')
      const freshParts = await fetchParts(orderId)
      recomputeBudget(orderId, catalogSelection[orderId] || '', manualExtraText[orderId] || '', freshParts)
      fetchData(true)
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Error al revertir el repuesto', 'error')
    }
  }

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
    if (expandedId !== id && !partsByOrder[id]) {
      fetchParts(id).then((freshParts) => {
        recomputeBudget(id, catalogSelection[id] || '', manualExtraText[id] || '', freshParts)
      })
    }
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

  const handleAddBudgetAdjustment = async (orderId: string) => {
    const key = `budgetAdj:${orderId}`
    if (pendingIds.has(key)) return
    const amount = Number(adjustmentAmountText[orderId])
    const reason = (adjustmentReasonText[orderId] || '').trim()
    if (!(amount > 0) || !reason) {
      showToast('Completa un monto mayor a 0 y un motivo antes de registrar el ajuste.', 'error')
      return
    }
    setPendingIds((prev) => new Set(prev).add(key))
    try {
      await api.patch(`/api/orders/${orderId}/budget-adjustment`, { amount, reason })
      showToast('✅ Ajuste al presupuesto registrado.', 'success')
      setAdjustmentAmountText((prev) => ({ ...prev, [orderId]: '' }))
      setAdjustmentReasonText((prev) => ({ ...prev, [orderId]: '' }))
      setShowAdjustment((prev) => ({ ...prev, [orderId]: false }))
      fetchData()
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Error al registrar el ajuste al presupuesto', 'error')
    } finally {
      setPendingIds((prev) => {
        const next = new Set(prev)
        next.delete(key)
        return next
      })
    }
  }

  const handleFinishRepair = async (orderId: string) => {
    const key = `finish:${orderId}`
    if (pendingIds.has(key)) return
    const observation = (finishObservationText[orderId] || '').trim()
    setPendingIds((prev) => new Set(prev).add(key))
    try {
      const response = await api.post(`/api/orders/${orderId}/finish-repair`, observation ? { observation } : {})
      const updatedOrder = response.data.data
      showToast(
        updatedOrder.status === 'READY'
          ? '✅ Reparación terminada — la orden queda lista, con saldo pendiente por cobrar.'
          : '✅ Reparación terminada — no quedaba saldo pendiente, la orden pasó directo a pagada.',
        'success'
      )
      setFinishObservationText((prev) => ({ ...prev, [orderId]: '' }))
      fetchData()
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Error al finalizar la reparación', 'error')
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
    const dateStr = o.finalPaymentConfirmedAt ?? o.deliveredAt
    if (!dateStr) return false
    const d = new Date(dateStr)
    return d >= monday && d <= saturday
  })
  const weeklyCommission = weeklyOrders.reduce(
    (sum, o) => sum + Number(o.technicianCommission),
    0
  )

  const { start: monthStart, end: monthEnd } = getMonthRange()
  const monthlyOrders = completedOrders.filter((o) => {
    const dateStr = o.finalPaymentConfirmedAt ?? o.deliveredAt
    if (!dateStr) return false
    const d = new Date(dateStr)
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
          <p>Hola, {user?.lastName ? `${user.name} ${user.lastName}` : user?.name}</p>
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
                    {order.finalPaymentDetails && !order.finalPaymentConfirmed && (
                      <p className="alert-success">💰 El cliente ya reportó el pago final — esperando confirmación del administrador.</p>
                    )}

                    {/* ── Acción principal: una sola tarjeta destacada, según
                        el estado — antes "Finalizar reparación" y "Agregar
                        comentario de progreso" podían mostrarse juntas en
                        REPAIRING; ahora es siempre una sola, la que
                        corresponde ahora mismo. ── */}

                    {needsDiagnosis ? (
                      <div className="card card--action">
                        <span className="card-eyebrow">Acción requerida</span>
                        <h4>Registrar diagnóstico</h4>
                        <div className="form-group">
                          <label>Servicio del catálogo (si aplica — autollena el presupuesto)</label>
                          <select
                            value={catalogSelection[order.id] || ''}
                            onChange={(e) => {
                              const catalogId = e.target.value
                              setCatalogSelection((prev) => ({ ...prev, [order.id]: catalogId }))
                              recomputeBudget(order.id, catalogId, manualExtraText[order.id] || '')
                            }}
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
                          <label>Monto adicional (si el diagnóstico o parte del costo no está en el catálogo)</label>
                          <input
                            type="number"
                            value={manualExtraText[order.id] || ''}
                            onChange={(e) => {
                              const extra = e.target.value
                              setManualExtraText((prev) => ({ ...prev, [order.id]: extra }))
                              recomputeBudget(order.id, catalogSelection[order.id] || '', extra)
                            }}
                          />
                          <p className="form-hint">Se suma al precio del catálogo elegido arriba para formar el presupuesto total.</p>
                        </div>
                        <div className="form-group">
                          <label>Diagnóstico</label>
                          <textarea
                            value={diagnosisText[order.id] || ''}
                            onChange={(e) =>
                              setDiagnosisText((prev) => ({ ...prev, [order.id]: e.target.value }))
                            }
                            rows={3}
                            placeholder="Describí el diagnóstico — si no eligió nada del catálogo, escribilo acá completo"
                          />
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
                          <p className="form-hint">Se autollena con catálogo + monto adicional + repuestos, pero podés editarlo directo.</p>
                        </div>

                        {(() => {
                          const catalogItem = catalog.find((c) => c.id === (catalogSelection[order.id] || ''))
                          const extra = Number(manualExtraText[order.id] || 0)
                          const activeParts = (partsByOrder[order.id] ?? []).filter((p) => !p.reversedAt)
                          if (!catalogItem && !extra && activeParts.length === 0) return null
                          return (
                            <div className="form-hint" style={{ marginBottom: 12 }}>
                              <strong>Desglose del presupuesto:</strong>
                              <ul style={{ margin: '4px 0 0 18px', padding: 0 }}>
                                {catalogItem && <li>{catalogItem.name} — ${Number(catalogItem.basePrice).toFixed(2)}</li>}
                                {extra > 0 && <li>Monto adicional — ${extra.toFixed(2)}</li>}
                                {activeParts.map((p) => (
                                  <li key={p.id}>Repuesto: {p.product.name} (x{p.quantity}) — ${(p.quantity * Number(p.unitPriceAtUse ?? 0)).toFixed(2)}</li>
                                ))}
                              </ul>
                            </div>
                          )
                        })()}

                        <button className="btn btn-primary" disabled={pendingIds.has(`diag:${order.id}`)} onClick={() => handleSubmitDiagnosis(order.id)}>
                          Enviar diagnóstico
                        </button>
                      </div>
                    ) : order.status === 'REPAIRING' ? (
                      <div className="card card--action">
                        <span className="card-eyebrow">Acción requerida</span>
                        <h4>Finalizar reparación</h4>
                        {order.diagnosis && <p className="form-hint"><strong>Diagnóstico:</strong> {order.diagnosis}</p>}
                        {order.budget && <p className="form-hint"><strong>Presupuesto:</strong> ${order.budget}</p>}

                        <button
                          type="button"
                          className="card-toggle"
                          onClick={() => setShowAdjustment((prev) => ({ ...prev, [order.id]: !prev[order.id] }))}
                        >
                          {showAdjustment[order.id] ? '▾' : '▸'} ¿Necesitás agregar algo imprevisto?
                        </button>
                        {showAdjustment[order.id] && (
                          <div className="form-group">
                            <p className="form-hint">
                              Si es un repuesto, usá la sección "Repuestos" de abajo — este ajuste es para cualquier otro costo imprevisto.
                            </p>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                              <div style={{ width: 120 }}>
                                <input
                                  type="number"
                                  placeholder="Monto"
                                  value={adjustmentAmountText[order.id] || ''}
                                  onChange={(e) =>
                                    setAdjustmentAmountText((prev) => ({ ...prev, [order.id]: e.target.value }))
                                  }
                                />
                              </div>
                              <div style={{ flex: 1, minWidth: 160 }}>
                                <input
                                  type="text"
                                  placeholder="Motivo del ajuste"
                                  value={adjustmentReasonText[order.id] || ''}
                                  onChange={(e) =>
                                    setAdjustmentReasonText((prev) => ({ ...prev, [order.id]: e.target.value }))
                                  }
                                />
                              </div>
                              <button
                                className="btn btn-secondary"
                                disabled={
                                  pendingIds.has(`budgetAdj:${order.id}`) ||
                                  !(Number(adjustmentAmountText[order.id]) > 0) ||
                                  !(adjustmentReasonText[order.id] || '').trim()
                                }
                                onClick={() => handleAddBudgetAdjustment(order.id)}
                              >
                                Registrar ajuste
                              </button>
                            </div>
                          </div>
                        )}

                        <div className="form-group">
                          <label>Observación (opcional)</label>
                          <textarea
                            value={finishObservationText[order.id] || ''}
                            onChange={(e) =>
                              setFinishObservationText((prev) => ({ ...prev, [order.id]: e.target.value }))
                            }
                            rows={2}
                            placeholder="Notas finales sobre la reparación..."
                          />
                        </div>

                        <button
                          className="btn btn-primary"
                          disabled={pendingIds.has(`finish:${order.id}`)}
                          onClick={() => handleFinishRepair(order.id)}
                        >
                          Terminé la reparación
                        </button>
                      </div>
                    ) : (
                      <div className="card card--action">
                        <span className="card-eyebrow">Acción requerida</span>
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

                    {/* ── Repuestos: utilidad siempre accesible, no compite
                        visualmente con la acción principal de arriba. ── */}
                    <div className="card">
                      <h4>Repuestos</h4>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                        <div className="form-group" style={{ flex: 1, marginBottom: 0, minWidth: 160 }}>
                          <label>Producto</label>
                          <select
                            value={partsProductId[order.id] || ''}
                            onChange={(e) => setPartsProductId((prev) => ({ ...prev, [order.id]: e.target.value }))}
                          >
                            <option value="">— Seleccionar —</option>
                            {products.map((p) => (
                              <option key={p.id} value={p.id} disabled={p.stock <= 0}>
                                {p.name} — ${Number(p.price).toFixed(2)} (stock: {p.stock})
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="form-group" style={{ width: 90, marginBottom: 0 }}>
                          <label>Cantidad</label>
                          <input
                            type="number"
                            min="1"
                            value={partsQuantity[order.id] || ''}
                            onChange={(e) => setPartsQuantity((prev) => ({ ...prev, [order.id]: e.target.value }))}
                          />
                        </div>
                        <button className="btn btn-secondary" onClick={() => handleAddPart(order.id)}>
                          Usar repuesto
                        </button>
                      </div>

                      {(() => {
                        const activeParts = (partsByOrder[order.id] ?? []).filter((p) => !p.reversedAt)
                        if (activeParts.length === 0) return null
                        const partsSubtotal = activeParts.reduce((sum, p) => sum + p.quantity * Number(p.unitPriceAtUse ?? 0), 0)
                        return (
                          <div className="table-wrapper" style={{ marginTop: 10 }}>
                            <table className="styled-table">
                              <thead>
                                <tr>
                                  <th scope="col">Producto</th>
                                  <th scope="col">Cantidad</th>
                                  <th scope="col" className="money">Costo unitario</th>
                                  <th scope="col" className="money">Subtotal</th>
                                  <th scope="col">Quién</th>
                                  <th scope="col">Fecha</th>
                                  <th scope="col">Acciones</th>
                                </tr>
                              </thead>
                              <tbody>
                                {activeParts.map((p) => (
                                  <tr key={p.id}>
                                    <td data-label="Producto">{p.product.name}</td>
                                    <td data-label="Cantidad">{p.quantity}</td>
                                    <td className="money" data-label="Costo unitario">${Number(p.unitPriceAtUse ?? 0).toFixed(2)}</td>
                                    <td className="money" data-label="Subtotal">${(p.quantity * Number(p.unitPriceAtUse ?? 0)).toFixed(2)}</td>
                                    <td data-label="Quién">{p.user ? `${p.user.name} ${p.user.lastName ?? ''}`.trim() : '—'}</td>
                                    <td data-label="Fecha">{new Date(p.createdAt).toLocaleString('es-VE')}</td>
                                    <td data-label="Acciones">
                                      <button className="btn btn-danger" onClick={() => handleRevertPart(order.id, p.id)}>
                                        Revertir
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                              <tfoot>
                                <tr>
                                  <td colSpan={3} style={{ textAlign: 'right', fontWeight: 700 }}>Total repuestos</td>
                                  <td className="money" style={{ fontWeight: 700 }}>${partsSubtotal.toFixed(2)}</td>
                                  <td colSpan={3}></td>
                                </tr>
                              </tfoot>
                            </table>
                          </div>
                        )
                      })()}
                    </div>

                    {/* ── Referencia: colapsada por defecto — no compite con
                        la acción principal ni con Repuestos. ── */}
                    <details className="card card--muted">
                      <summary><h4 style={{ display: 'inline' }}>Detalle del equipo</h4></summary>
                      <p><strong>Tipo:</strong> {order.device.type === 'LAPTOP' ? 'Laptop' : 'PC'}</p>
                      <p><strong>Marca / Modelo:</strong> {order.device.brand} {order.device.model}</p>
                      <p><strong>Color:</strong> {order.device.color}</p>
                      <p><strong>Accesorios:</strong> {order.device.accessories || '—'}</p>
                      {order.device.devicePassword && <p><strong>Contraseña del equipo:</strong> {order.device.devicePassword}</p>}
                      <p><strong>Problema reportado por el cliente:</strong> {order.problem}</p>
                    </details>

                    <details className="card card--muted">
                      <summary><h4 style={{ display: 'inline' }}>Historial</h4></summary>
                      {order.statusHistory.map((entry) => (
                        <div key={entry.id} className="form-hint">
                          <strong>{getStatusBadge('order', entry.status).label}</strong> — {formatDate(entry.createdAt)}
                          {entry.comment && <div>{entry.comment}</div>}
                        </div>
                      ))}
                    </details>
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