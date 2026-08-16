import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TextInput,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { Stack, useRouter } from 'expo-router'
import { useState, useEffect, useCallback } from 'react'
import { ordersAPI } from '../../src/services/api'
import { useToastStore } from '../../src/store/toast.store'
import { useConfirm } from '../../src/hooks/useConfirm'

// El backend guarda el método de pago con el enum de Prisma (MOBILE_PAYMENT,
// TRANSFER, BINANCE), pero la pantalla de pago espera los literales que usa
// el formulario (PAGO_MOVIL, TRANSFERENCIA, BINANCE) — sin este mapeo, el
// valor no coincide con ninguna condición y no se muestra ningún campo.
const BACKEND_TO_FRONTEND_METHOD: Record<string, 'PAGO_MOVIL' | 'TRANSFERENCIA' | 'BINANCE'> = {
  MOBILE_PAYMENT: 'PAGO_MOVIL',
  TRANSFER: 'TRANSFERENCIA',
  BINANCE: 'BINANCE',
}

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
interface StatusHistoryEntry {
  id: string
  status: OrderStatus
  comment?: string
  createdAt: string
}

interface TechOrder {
  id: string
  orderNumber: string
  status: OrderStatus
  problem: string
  observations?: string
  diagnosis?: string | null
  budget?: number | null
  budgetApproved?: boolean | null
  deliveryAmount?: number | null
  revisionAmount?: number | null
  // Viene del backend como enum de Prisma (MOBILE_PAYMENT/TRANSFER/BINANCE),
  // no como los literales del formulario — se traduce con BACKEND_TO_FRONTEND_METHOD.
  advancePaymentMethod?: string | null
  advancePaymentSubmissions?: {
    id: string
    amount: number
    status: 'PENDING' | 'CONFIRMED' | 'REJECTED'
    rejectionReason?: string | null
    createdAt: string
  }[]
  finalPaymentDetails?: Record<string, string> | null
  finalPaymentConfirmed?: boolean
  finalPaymentRejectionReason?: string | null
  technicianCommission?: number | null
  receivedAt: string
  device: {
    type: string
    brand: string
    model: string
    color: string
  }
  technician?: {
    id: string
    name: string
  } | null
  statusHistory: StatusHistoryEntry[]
}

const STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING_PAYMENT: '💳 Pendiente de confirmación de pago',
  RECEIVED: '📥 Recibida',
  DIAGNOSING: '🔍 En diagnóstico',
  WAITING_APPROVAL: '⏳ Esperando aprobación de presupuesto',
  APPROVED: '✅ Presupuesto aprobado',
  REPAIRING: '🔧 En reparación',
  WAITING_PART: '📦 Esperando repuesto',
  READY: '📦 Lista para entrega',
  DELIVERED: '🚚 Entregada',
  CANCELLED: '❌ Cancelada',
}

const STATUS_COLOR: Record<OrderStatus, string> = {
  PENDING_PAYMENT: '#6B6B75',
  RECEIVED: '#6B6B75',
  DIAGNOSING: '#4B3E96',
  WAITING_APPROVAL: '#4B3E96',
  APPROVED: '#4B3E96',
  REPAIRING: '#4B3E96',
  WAITING_PART: '#4B3E96',
  READY: '#1E7A3D',
  DELIVERED: '#1E7A3D',
  CANCELLED: '#B3261E',
}

const STATUS_BG: Record<OrderStatus, string> = {
  PENDING_PAYMENT: '#EFEAE2',
  RECEIVED: '#EFEAE2',
  DIAGNOSING: '#ECEAF3',
  WAITING_APPROVAL: '#ECEAF3',
  APPROVED: '#ECEAF3',
  REPAIRING: '#ECEAF3',
  WAITING_PART: '#ECEAF3',
  READY: '#E3F3E9',
  DELIVERED: '#E3F3E9',
  CANCELLED: '#FBE9E7',
}

const REJECT_REASONS = ['Es muy costoso', 'Prefiero resolverlo por mi cuenta', 'Otro']

export default function MyTechnicalOrdersScreen() {
  const router = useRouter()
  const [orders, setOrders] = useState<TechOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const showToast = useToastStore((state) => state.showToast)
  const confirmDialog = useConfirm()
  const [rejectReason, setRejectReason] = useState<Record<string, string>>({})
  const [rejectReasonOther, setRejectReasonOther] = useState<Record<string, string>>({})
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({})

  const fetchOrders = useCallback(async () => {
    setLoading(true)
    try {
      const response = await ordersAPI.getMyOrders()
      setOrders(response.data.data)
    } catch (error: any) {
      const backendMessage = error?.response?.data?.message
      showToast(
        backendMessage || 'Ocurrió un error al obtener tus órdenes. Intenta de nuevo.',
        'error'
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchOrders()
  }, [fetchOrders])

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id))
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

  const handleApproveBudget = async (order: TechOrder) => {
    const confirmed = await confirmDialog({
      title: 'Aprobar presupuesto',
      message: `¿Confirmas que aceptas el presupuesto de $${Number(order.budget).toFixed(2)} para reparar tu equipo?`,
      confirmLabel: 'Aprobar',
    })
    if (!confirmed) return

    setActionLoading((prev) => ({ ...prev, [order.id]: true }))
    try {
      await ordersAPI.approveBudget(order.id)
      showToast('✅ Presupuesto aprobado. El técnico continuará con la reparación.', 'success')
      fetchOrders()
    } catch (error: any) {
      showToast(error?.response?.data?.message || 'Error al aprobar el presupuesto', 'error')
    } finally {
      setActionLoading((prev) => ({ ...prev, [order.id]: false }))
    }
  }

  const handleRejectBudget = async (order: TechOrder) => {
    const selected = rejectReason[order.id]
    if (!selected) {
      showToast('Selecciona un motivo antes de rechazar.', 'error')
      return
    }
    const reason = selected === 'Otro' ? (rejectReasonOther[order.id] || '').trim() : selected
    if (!reason) {
      showToast('Describe el motivo antes de rechazar.', 'error')
      return
    }

    const confirmed = await confirmDialog({
      title: 'Rechazar presupuesto',
      message: 'Entendido, no se realizará la reparación. Ya pagaste la revisión y el delivery — no se te cobrará nada más. ¿Confirmas?',
      confirmLabel: 'Rechazar',
    })
    if (!confirmed) return

    setActionLoading((prev) => ({ ...prev, [order.id]: true }))
    try {
      await ordersAPI.rejectBudget(order.id, reason)
      showToast('Reparación cancelada. No se te cobrará nada adicional.', 'success')
      fetchOrders()
    } catch (error: any) {
      showToast(error?.response?.data?.message || 'Error al rechazar el presupuesto', 'error')
    } finally {
      setActionLoading((prev) => ({ ...prev, [order.id]: false }))
    }
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <LinearGradient
        colors={['#ffffff', '#eef2ff', '#d5ddff', '#8fa5ff']}
        style={styles.container}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backText}>← Inicio</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Mis Órdenes de Servicio</Text>
          <Text style={styles.subtitle}>Historial de reparaciones y mantenimiento</Text>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#17247a" />
            <Text style={styles.loadingText}>Cargando órdenes...</Text>
          </View>
        ) : orders.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>🛠️</Text>
            <Text style={styles.emptyTitle}>Aún no tienes órdenes</Text>
            <Text style={styles.emptySubtitle}>
              Cuando reportes un equipo para reparación, aparecerá aquí.
            </Text>
            <TouchableOpacity
              style={styles.goToStoreBtn}
              onPress={() => router.replace('/(client)/technical-service')}
            >
              <Text style={styles.goToStoreBtnText}>Reportar un equipo</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <TouchableOpacity style={styles.refreshBtn} onPress={fetchOrders}>
              <Text style={styles.refreshText}>↻ Actualizar</Text>
            </TouchableOpacity>

            {orders.map((order) => {
              const isExpanded = expandedId === order.id
              const status = order.status

              return (
                <TouchableOpacity
                  key={order.id}
                  style={styles.orderCard}
                  onPress={() => toggleExpand(order.id)}
                  activeOpacity={0.85}
                >
                  {/* Cabecera del pedido */}
                  <View style={styles.orderHeader}>
                    <View style={styles.orderHeaderLeft}>
                      <Text style={styles.orderId}>{order.orderNumber}</Text>
                      <Text style={styles.orderDate}>{formatDate(order.receivedAt)}</Text>
                    </View>
                    <Text style={styles.expandArrow}>{isExpanded ? '▲' : '▼'}</Text>
                  </View>

                  {/* Badge de estado */}
                  <View style={[styles.statusBadge, { backgroundColor: STATUS_BG[status] }]}>
                    <Text style={[styles.statusText, { color: STATUS_COLOR[status] }]}>
                      {STATUS_LABEL[status]}
                    </Text>
                  </View>

                  {/* Equipo siempre visible */}
                  <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>Equipo</Text>
                    <Text style={styles.deviceValue}>
                      {order.device.brand} {order.device.model}
                    </Text>
                  </View>

                  {/* Detalle expandible */}
                  {isExpanded && (
                    <View style={styles.expandedContent}>
                      {/* Tipo y color */}
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Equipo</Text>
                        <Text style={styles.detailValue}>
                          {order.device.type === 'LAPTOP' ? 'Laptop' : 'PC'} · {order.device.color}
                        </Text>
                      </View>

                      {/* Falla reportada */}
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Falla o servicio reportado</Text>
                        <Text style={styles.detailValue}>{order.problem}</Text>
                      </View>

                      {/* Anticipo — solo mientras está pendiente de completarse */}
                      {status === 'PENDING_PAYMENT' && (() => {
                        const total =
                          Number(order.deliveryAmount ?? 10) + Number(order.revisionAmount ?? 15)
                        const submissions = order.advancePaymentSubmissions ?? []
                        // "contado" cuenta PENDING + CONFIRMED — se usa para el restante,
                        // así el cliente nunca puede enviar de más aunque haya abonos sin
                        // revisar. "confirmado" es solo lo ya aprobado — es lo que se
                        // muestra en el título para no dar a entender que ya está pagado
                        // cuando en realidad sigue pendiente de revisión.
                        const contado = submissions
                          .filter((s) => s.status !== 'REJECTED')
                          .reduce((sum, s) => sum + Number(s.amount), 0)
                        const confirmado = submissions
                          .filter((s) => s.status === 'CONFIRMED')
                          .reduce((sum, s) => sum + Number(s.amount), 0)
                        const restante = Math.max(0, total - contado)

                        return (
                          <View style={styles.advanceCard}>
                            <Text style={styles.advanceTitle}>
                              Anticipo confirmado: ${confirmado.toFixed(2)} de ${total.toFixed(2)}
                            </Text>
                            {submissions.length > 0 && (
                              <View style={{ marginTop: 6, marginBottom: 10 }}>
                                {submissions.map((s) => (
                                  <Text key={s.id} style={styles.advanceSubmissionRow}>
                                    {s.status === 'CONFIRMED' ? '✅' : s.status === 'REJECTED' ? '❌' : '⏳'}{' '}
                                    ${Number(s.amount).toFixed(2)} — {s.status === 'CONFIRMED' ? 'confirmado' : s.status === 'REJECTED' ? 'rechazado' : 'pendiente de revisión'}
                                  </Text>
                                ))}
                              </View>
                            )}
                            {restante > 0.009 && (
                              <TouchableOpacity
                                style={styles.advanceBtn}
                                onPress={(e) => {
                                  e.stopPropagation()
                                  router.push({
                                    pathname: '/(client)/upload-advance-receipt',
                                    params: {
                                      orderId: order.id,
                                      paymentMethod:
                                        BACKEND_TO_FRONTEND_METHOD[order.advancePaymentMethod || ''] || 'PAGO_MOVIL',
                                      total: String(restante),
                                    },
                                  })
                                }}
                              >
                                <Text style={styles.advanceBtnText}>
                                  💳 {submissions.length > 0 ? `Completar anticipo (falta $${restante.toFixed(2)})` : 'Pagar anticipo'}
                                </Text>
                              </TouchableOpacity>
                            )}
                          </View>
                        )
                      })()}

                      {/* Observaciones */}
                      {order.observations && (
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>Observaciones</Text>
                          <Text style={styles.detailValue}>{order.observations}</Text>
                        </View>
                      )}

                      {/* Diagnóstico del técnico */}
                      {order.diagnosis && (
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>Diagnóstico del técnico</Text>
                          <Text style={styles.detailValue}>{order.diagnosis}</Text>
                        </View>
                      )}

                      {/* Técnico asignado */}
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Técnico asignado</Text>
                        <Text style={styles.detailValue}>
                          {order.technician?.name || 'Por asignar'}
                        </Text>
                      </View>

                      {/* Presupuesto */}
                      {order.budget != null && (
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>Presupuesto</Text>
                          <Text style={styles.detailValue}>
                            ${Number(order.budget).toFixed(2)}
                            {order.budgetApproved != null &&
                              (order.budgetApproved ? ' — Aprobado' : ' — Pendiente de aprobación')}
                          </Text>
                        </View>
                      )}

                      {/* Decisión del cliente sobre el presupuesto */}
                      {status === 'WAITING_APPROVAL' && order.budget != null && Number(order.budget) > 0 && (
                        <View style={styles.decisionCard}>
                          <Text style={styles.decisionTitle}>¿Qué decides con este presupuesto?</Text>

                          <TouchableOpacity
                            style={[styles.approveBtn, actionLoading[order.id] && styles.actionBtnDisabled]}
                            onPress={(e) => { e.stopPropagation(); handleApproveBudget(order) }}
                            disabled={actionLoading[order.id]}
                          >
                            <Text style={styles.approveBtnText}>✅ Aprobar presupuesto</Text>
                          </TouchableOpacity>

                          <Text style={styles.reasonLabel}>O si prefieres no reparar, indica por qué:</Text>
                          <View style={styles.reasonRow}>
                            {REJECT_REASONS.map((r) => (
                              <TouchableOpacity
                                key={r}
                                style={[styles.reasonChip, rejectReason[order.id] === r && styles.reasonChipActive]}
                                onPress={(e) => {
                                  e.stopPropagation()
                                  setRejectReason((prev) => ({ ...prev, [order.id]: r }))
                                  if (r !== 'Otro') {
                                    setRejectReasonOther((prev) => ({ ...prev, [order.id]: '' }))
                                  }
                                }}
                              >
                                <Text style={[styles.reasonChipText, rejectReason[order.id] === r && styles.reasonChipTextActive]}>
                                  {r}
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </View>

                          {rejectReason[order.id] === 'Otro' && (
                            <TextInput
                              style={styles.reasonInput}
                              placeholder="Cuéntanos el motivo..."
                              placeholderTextColor="#9aa5cc"
                              value={rejectReasonOther[order.id] || ''}
                              onChangeText={(text) =>
                                setRejectReasonOther((prev) => ({ ...prev, [order.id]: text }))
                              }
                              onTouchStart={(e) => e.stopPropagation()}
                            />
                          )}

                          {!!rejectReason[order.id] && (
                            <TouchableOpacity
                              style={[styles.rejectBtn, actionLoading[order.id] && styles.actionBtnDisabled]}
                              onPress={(e) => { e.stopPropagation(); handleRejectBudget(order) }}
                              disabled={actionLoading[order.id]}
                            >
                              <Text style={styles.rejectBtnText}>❌ Rechazar presupuesto</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      )}

                      {/* Comprar repuesto — solo si hay presupuesto real (no aplica con $0,
                          ahí no hubo reparación que requiera piezas instaladas por el técnico) */}
                      {order.budget != null && Number(order.budget) > 0 && (
                        <TouchableOpacity
                          style={styles.linkedProductBtn}
                          onPress={(e) => {
                            e.stopPropagation()
                            router.push({
                              pathname: '/(client)/select-linked-products',
                              params: {
                                orderId: order.id,
                                orderNumber: order.orderNumber,
                                budget: String(order.budget),
                              },
                            })
                          }}
                        >
                          <Text style={styles.linkedProductBtnText}>🔧 Comprar repuesto para esta orden</Text>
                        </TouchableOpacity>
                      )}

                      {/* Motivo de rechazo del pago final, si aplica */}
                      {order.finalPaymentRejectionReason && (
                        <View style={styles.rejectionCard}>
                          <Text style={styles.rejectionTitle}>❌ Pago rechazado</Text>
                          <Text style={styles.rejectionText}>{order.finalPaymentRejectionReason}</Text>
                        </View>
                      )}

                      {/* Pago final — solo cuando la orden está lista (READY) y hay saldo
                          real que pagar. Con presupuesto $0 no hay nada que cobrar; el
                          admin cierra la orden directo sin pasar por este paso. */}
                      {status === 'READY' && !order.finalPaymentConfirmed && order.budget != null && Number(order.budget) > 0 && (
                        <TouchableOpacity
                          style={styles.finalPaymentBtn}
                          onPress={(e) => {
                            e.stopPropagation()
                            router.push({
                              pathname: '/(client)/final-payment',
                              params: {
                                orderId: order.id,
                                orderNumber: order.orderNumber,
                                budget: String(order.budget ?? 0),
                                revisionAmount: String(order.revisionAmount ?? 0),
                              },
                            })
                          }}
                        >
                          <Text style={styles.finalPaymentBtnText}>
                            {order.finalPaymentDetails
                              ? '💰 Reenviar datos de pago final'
                              : '💰 Pagar saldo final'}
                          </Text>
                        </TouchableOpacity>
                      )}

                      {/* Comisión (solo informativo, orden ya entregada) */}
                      {order.technicianCommission != null && (
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>Servicio completado</Text>
                          <Text style={styles.detailValue}>✅ Pago final confirmado</Text>
                        </View>
                      )}

                      {/* Historial de estados */}
                      <Text style={styles.itemsTitle}>📋 Historial</Text>
                      {order.statusHistory.map((entry) => (
                        <View key={entry.id} style={styles.itemRow}>
                          <View style={styles.itemInfo}>
                            <Text style={styles.itemName}>{STATUS_LABEL[entry.status]}</Text>
                            {entry.comment && (
                              <Text style={styles.itemQty}>{entry.comment}</Text>
                            )}
                          </View>
                          <Text style={styles.historyDate}>{formatDate(entry.createdAt)}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </TouchableOpacity>
              )
            })}
          </ScrollView>
        )}
      </LinearGradient>
    </>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingTop: 60,
    paddingHorizontal: 22,
    paddingBottom: 16,
  },
  backBtn: { marginBottom: 8 },
  backText: { color: '#5364ad', fontSize: 14, fontWeight: '500' },
  title: { fontSize: 26, fontWeight: '800', color: '#17247a', marginBottom: 2 },
  subtitle: { fontSize: 14, color: '#5364ad' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { fontSize: 14, color: '#5364ad' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyIcon: { fontSize: 64, marginBottom: 16 },
  emptyTitle: { fontSize: 22, fontWeight: '800', color: '#17247a', marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: '#5364ad', textAlign: 'center', marginBottom: 24, lineHeight: 20 },
  goToStoreBtn: { backgroundColor: '#17247a', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 32 },
  goToStoreBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  scrollContent: { paddingHorizontal: 22, paddingBottom: 40 },
  refreshBtn: { alignSelf: 'flex-end', marginBottom: 12 },
  refreshText: { color: '#5364ad', fontSize: 13, fontWeight: '600' },
  orderCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1.5,
    borderColor: '#d0d8ff',
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  orderHeaderLeft: { flex: 1 },
  orderId: { fontSize: 14, fontWeight: '800', color: '#17247a' },
  orderDate: { fontSize: 12, color: '#9aa5cc', marginTop: 2 },
  expandArrow: { fontSize: 12, color: '#9aa5cc', marginLeft: 8 },
  statusBadge: {
    alignSelf: 'flex-start',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginBottom: 12,
  },
  statusText: { fontSize: 12, fontWeight: '700' },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: { fontSize: 13, color: '#5364ad', fontWeight: '600' },
  deviceValue: { fontSize: 15, fontWeight: '800', color: '#17247a' },
  expandedContent: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#eef2ff',
  },
  detailRow: { marginBottom: 10 },
  detailLabel: { fontSize: 11, color: '#9aa5cc', fontWeight: '600', textTransform: 'uppercase', marginBottom: 2 },
  detailValue: { fontSize: 13, color: '#17247a', lineHeight: 18 },
  itemsTitle: { fontSize: 13, fontWeight: '700', color: '#17247a', marginBottom: 8, marginTop: 4 },
  linkedProductBtn: {
    backgroundColor: '#17247a',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  linkedProductBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  advanceCard: {
    backgroundColor: '#eef2ff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#c7d2fe',
  },
  advanceTitle: { fontSize: 13, fontWeight: '700', color: '#17247a' },
  advanceSubmissionRow: { fontSize: 12, color: '#3730a3', marginTop: 4 },
  advanceBtn: {
    backgroundColor: '#17247a',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  advanceBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  rejectionCard: {
    marginBottom: 12,
    backgroundColor: '#fee2e2',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#fca5a5',
  },
  rejectionTitle: { fontSize: 13, fontWeight: '800', color: '#b91c1c', marginBottom: 4 },
  rejectionText: { fontSize: 13, color: '#7f1d1d', lineHeight: 18 },
  finalPaymentBtn: {
    backgroundColor: '#0f766e',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  finalPaymentBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  decisionCard: {
    backgroundColor: '#f8faff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#d0d8ff',
  },
  decisionTitle: { fontSize: 13, fontWeight: '700', color: '#17247a', marginBottom: 10 },
  approveBtn: {
    backgroundColor: '#1E7A3D',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 14,
  },
  approveBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  reasonLabel: { fontSize: 12, color: '#5364ad', marginBottom: 8 },
  reasonRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  reasonChip: {
    borderWidth: 1.5,
    borderColor: '#d0d8ff',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
  },
  reasonChipActive: { borderColor: '#B3261E', backgroundColor: '#fee2e2' },
  reasonChipText: { fontSize: 12, color: '#17247a', fontWeight: '600' },
  reasonChipTextActive: { color: '#B3261E' },
  reasonInput: {
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#d0d8ff',
    padding: 10,
    fontSize: 13,
    color: '#17247a',
    marginBottom: 10,
  },
  rejectBtn: {
    backgroundColor: '#B3261E',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  rejectBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  actionBtnDisabled: { opacity: 0.5 },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f8f9ff',
    borderRadius: 10,
    padding: 10,
    marginBottom: 6,
  },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 13, fontWeight: '600', color: '#17247a' },
  itemQty: { fontSize: 11, color: '#9aa5cc', marginTop: 2 },
  historyDate: { fontSize: 11, color: '#9aa5cc', marginLeft: 8 },
})