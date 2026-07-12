import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { Stack, useRouter } from 'expo-router'
import { useState, useEffect, useCallback, useRef } from 'react'
import { productOrdersAPI } from '../../src/services/api'
import { useToastStore } from '../../src/store/toast.store'

// Mismo valor que apps/admin-web/src/config/constants.ts -> POLL_INTERVAL_MS.
// Se define localmente porque mobile no comparte código con admin-web, pero
// debe coincidir para que los paneles internos y el cliente queden coordinados.
const POLL_INTERVAL_MS = 20000

type OrderStatus = 'PENDING' | 'CONFIRMED' | 'DELIVERED' | 'CANCELLED'
type SubmissionStatus = 'PENDING' | 'CONFIRMED' | 'REJECTED'

interface ProductOrderItem {
  id: string
  quantity: number
  unitPrice: number
  subtotal: number
  product: {
    id: string
    name: string
  }
}

interface PaymentSubmission {
  id: string
  amount: number
  paymentDetails: Record<string, string>
  status: SubmissionStatus
  rejectionReason: string | null
  createdAt: string
}

interface ProductOrder {
  id: string
  status: OrderStatus
  total: number
  deliveryCost?: number | null
  installationCost?: number | null
  createdAt: string
  address: string
  paymentMethod: string
  notes?: string
  paidAt?: string
  items: ProductOrderItem[]
  paymentSubmissions: PaymentSubmission[]
  delivery?: {
    status: string
    deliveredAt: string | null
    agent: { id: string; name: string; phone?: string } | null
  } | null
}

const STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: '⏳ Pendiente de confirmación',
  CONFIRMED: '✅ Pago confirmado',
  DELIVERED: '📦 Entregado',
  CANCELLED: '❌ Cancelado',
}

const STATUS_COLOR: Record<OrderStatus, string> = {
  PENDING: '#b45309',
  CONFIRMED: '#15803d',
  DELIVERED: '#17247a',
  CANCELLED: '#b91c1c',
}

const STATUS_BG: Record<OrderStatus, string> = {
  PENDING: '#fef3c7',
  CONFIRMED: '#dcfce7',
  DELIVERED: '#e0e7ff',
  CANCELLED: '#fee2e2',
}

const SUBMISSION_LABEL: Record<SubmissionStatus, string> = {
  PENDING: '⏳ En revisión',
  CONFIRMED: '✅ Confirmado',
  REJECTED: '❌ Rechazado',
}

const SUBMISSION_COLOR: Record<SubmissionStatus, string> = {
  PENDING: '#b45309',
  CONFIRMED: '#15803d',
  REJECTED: '#b91c1c',
}

const PAYMENT_LABEL: Record<string, string> = {
  MOBILE_PAYMENT: '📱 Pago Móvil',
  TRANSFER: '🏦 Transferencia',
  BINANCE: '₿ Binance',
}

const paymentMethodToFrontend: Record<string, string> = {
  MOBILE_PAYMENT: 'PAGO_MOVIL',
  TRANSFER: 'TRANSFERENCIA',
  BINANCE: 'BINANCE',
}

export default function MyOrdersScreen() {
  const router = useRouter()
  const [orders, setOrders] = useState<ProductOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  // IDs de pedidos cuyo estado cambió desde la última vez que el cliente los vio.
  const [updatedIds, setUpdatedIds] = useState<Set<string>>(new Set())
  // Último estado conocido de cada pedido, para detectar cambios en el polling.
  const previousStatusRef = useRef<Record<string, OrderStatus>>({})
  const showToast = useToastStore((state) => state.showToast)

  const fetchOrders = useCallback(async (isPoll = false) => {
    if (!isPoll) setLoading(true)
    try {
      const response = await productOrdersAPI.getMyOrders()
      const freshOrders: ProductOrder[] = response.data.data

      if (isPoll) {
        const changedIds = freshOrders
          .filter((o) => {
            const prevStatus = previousStatusRef.current[o.id]
            return prevStatus !== undefined && prevStatus !== o.status
          })
          .map((o) => o.id)

        if (changedIds.length > 0) {
          setUpdatedIds((prev) => new Set([...prev, ...changedIds]))
        }
      }

      previousStatusRef.current = Object.fromEntries(
        freshOrders.map((o) => [o.id, o.status])
      )
      setOrders(freshOrders)
    } catch (error: any) {
      // En polling silencioso no interrumpimos con un Alert — los pedidos ya
      // cargados siguen visibles, solo se reintenta en el próximo ciclo.
      if (!isPoll) {
        const backendMessage = error?.response?.data?.message
        showToast(
          backendMessage || 'Ocurrió un error al obtener tus pedidos. Intenta de nuevo.',
          'error'
        )
      }
    } finally {
      if (!isPoll) setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchOrders()
    // Polling automático — mismo intervalo que los paneles internos (Admin,
    // Motorizado, Técnico), para que todo el sistema quede coordinado.
    const interval = setInterval(() => fetchOrders(true), POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [fetchOrders])

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id))
    if (updatedIds.has(id)) {
      setUpdatedIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
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
          <Text style={styles.title}>Mis Pedidos</Text>
          <Text style={styles.subtitle}>Historial de compras en la tienda</Text>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#17247a" />
            <Text style={styles.loadingText}>Cargando pedidos...</Text>
          </View>
        ) : orders.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📦</Text>
            <Text style={styles.emptyTitle}>Aún no tienes pedidos</Text>
            <Text style={styles.emptySubtitle}>
              Cuando hagas una compra en la tienda, aparecerá aquí.
            </Text>
            <TouchableOpacity
              style={styles.goToStoreBtn}
              onPress={() => router.replace('/(client)/store')}
            >
              <Text style={styles.goToStoreBtnText}>Ir a la Tienda</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <TouchableOpacity style={styles.refreshBtn} onPress={() => fetchOrders()}>
              <Text style={styles.refreshText}>↻ Actualizar</Text>
            </TouchableOpacity>

            {orders.map((order) => {
              const isExpanded = expandedId === order.id
              const isUpdated = updatedIds.has(order.id)
              const status = order.status as OrderStatus
              const frontendPaymentMethod =
                paymentMethodToFrontend[order.paymentMethod] ?? 'PAGO_MOVIL'

              const itemsSubtotal = order.items.reduce(
                (sum, item) => sum + Number(item.subtotal),
                0
              )

              const confirmedSubmissions = order.paymentSubmissions.filter(
                (s) => s.status === 'CONFIRMED'
              )
              const confirmedTotal = confirmedSubmissions.reduce(
                (sum, s) => sum + Number(s.amount),
                0
              )
              const remaining = Number(order.total) - confirmedTotal
              const hasPendingSubmission = order.paymentSubmissions.some(
                (s) => s.status === 'PENDING'
              )
              const canSendMorePayment =
                order.status === 'PENDING' && remaining > 0.009

              return (
                <TouchableOpacity
                  key={order.id}
                  style={[styles.orderCard, isUpdated && styles.orderCardUpdated]}
                  onPress={() => toggleExpand(order.id)}
                  activeOpacity={0.85}
                >
                  {/* Cabecera del pedido */}
                  <View style={styles.orderHeader}>
                    <View style={styles.orderHeaderLeft}>
                      <Text style={styles.orderId}>
                        Pedido #{order.id.slice(0, 8).toUpperCase()}
                      </Text>
                      <Text style={styles.orderDate}>{formatDate(order.createdAt)}</Text>
                    </View>
                    <Text style={styles.expandArrow}>{isExpanded ? '▲' : '▼'}</Text>
                  </View>

                  {/* Badge de estado */}
                  <View style={styles.statusRow}>
                    <View style={[styles.statusBadge, { backgroundColor: STATUS_BG[status] }]}>
                      <Text style={[styles.statusText, { color: STATUS_COLOR[status] }]}>
                        {STATUS_LABEL[status]}
                      </Text>
                    </View>
                    {isUpdated && (
                      <View style={styles.updatedBadge}>
                        <Text style={styles.updatedBadgeText}>🔔 Actualizado</Text>
                      </View>
                    )}
                  </View>

                  {/* Total siempre visible */}
                  <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>Total</Text>
                    <Text style={styles.totalValue}>${Number(order.total).toFixed(2)}</Text>
                  </View>

                  {/* Progreso de pago, si aplica */}
                  {order.status === 'PENDING' && order.paymentSubmissions.length > 0 && (
                    <Text style={styles.progressText}>
                      Recibido: ${confirmedTotal.toFixed(2)} de ${Number(order.total).toFixed(2)}
                    </Text>
                  )}

                  {/* Detalle expandible */}
                  {isExpanded && (
                    <View style={styles.expandedContent}>
                      {/* Línea de tiempo del pedido */}
                      <Text style={styles.itemsTitle}>📋 Seguimiento</Text>
                      <View style={styles.timeline}>
                        <TimelineStep
                          label="Pedido realizado"
                          done
                          date={formatDate(order.createdAt)}
                          isLast={false}
                        />
                        <TimelineStep
                          label="Pago confirmado"
                          done={!!order.paidAt}
                          date={order.paidAt ? formatDate(order.paidAt) : undefined}
                          isLast={false}
                        />
                        <TimelineStep
                          label="En camino"
                          done={!!order.paidAt}
                          date={undefined}
                          isLast={false}
                        />
                        <TimelineStep
                          label="Entregado"
                          done={!!order.delivery?.deliveredAt}
                          date={
                            order.delivery?.deliveredAt
                              ? formatDate(order.delivery.deliveredAt)
                              : undefined
                          }
                          isLast
                        />
                      </View>

                      {/* Método de pago */}
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Método de pago</Text>
                        <Text style={styles.detailValue}>
                          {PAYMENT_LABEL[order.paymentMethod] ?? order.paymentMethod}
                        </Text>
                      </View>

                      {/* Dirección */}
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Dirección de entrega</Text>
                        <Text style={styles.detailValue}>{order.address}</Text>
                      </View>

                      {/* Notas */}
                      {order.notes && (
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>Notas</Text>
                          <Text style={styles.detailValue}>{order.notes}</Text>
                        </View>
                      )}

                      {/* Motorizado asignado */}
                      {order.delivery?.agent && (
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>Motorizado</Text>
                          <Text style={styles.detailValue}>{order.delivery.agent.name}</Text>
                          {order.delivery.agent.phone && (
                            <Text style={styles.detailValue}>📞 {order.delivery.agent.phone}</Text>
                          )}
                        </View>
                      )}

                      {/* Productos */}
                      <Text style={styles.itemsTitle}>📦 Productos</Text>
                      {order.items.map((item) => (
                        <View key={item.id} style={styles.itemRow}>
                          <View style={styles.itemInfo}>
                            <Text style={styles.itemName}>{item.product.name}</Text>
                            <Text style={styles.itemQty}>x{item.quantity} · ${Number(item.unitPrice).toFixed(2)} c/u</Text>
                          </View>
                          <Text style={styles.itemSubtotal}>
                            ${Number(item.subtotal).toFixed(2)}
                          </Text>
                        </View>
                      ))}

                      {/* Desglose de costos adicionales */}
                      <View style={styles.breakdownContainer}>
                        <View style={styles.breakdownRow}>
                          <Text style={styles.breakdownLabel}>Subtotal</Text>
                          <Text style={styles.breakdownValue}>
                            ${itemsSubtotal.toFixed(2)}
                          </Text>
                        </View>
                        {order.installationCost != null && (
                          <View style={styles.breakdownRow}>
                            <Text style={styles.breakdownLabel}>Instalación</Text>
                            <Text style={styles.breakdownValue}>
                              +${Number(order.installationCost).toFixed(2)}
                            </Text>
                          </View>
                        )}
                        {order.deliveryCost != null && (
                          <View style={styles.breakdownRow}>
                            <Text style={styles.breakdownLabel}>Costo de delivery</Text>
                            <Text style={styles.breakdownValue}>
                              +${Number(order.deliveryCost).toFixed(2)}
                            </Text>
                          </View>
                        )}
                      </View>


                      {/* Historial de abonos */}
                      {order.paymentSubmissions.length > 0 ? (
                        <View style={styles.receiptContainer}>
                          <Text style={styles.itemsTitle}>🧾 Historial de pagos enviados</Text>
                          <Text style={styles.progressTextInline}>
                            Recibido: ${confirmedTotal.toFixed(2)} de ${Number(order.total).toFixed(2)}
                            {remaining > 0.009 ? ` · Restante: $${remaining.toFixed(2)}` : ''}
                          </Text>
                          {order.paymentSubmissions.map((s) => (
                            <View key={s.id} style={styles.submissionCard}>
                              <View style={styles.submissionHeader}>
                                <Text style={[styles.submissionStatus, { color: SUBMISSION_COLOR[s.status] }]}>
                                  {SUBMISSION_LABEL[s.status]}
                                </Text>
                                <Text style={styles.submissionAmount}>${Number(s.amount).toFixed(2)}</Text>
                              </View>
                              <Text style={styles.submissionDate}>{formatDate(s.createdAt)}</Text>
                              {s.status === 'REJECTED' && s.rejectionReason && (
                                <Text style={styles.submissionRejection}>Motivo: {s.rejectionReason}</Text>
                              )}
                            </View>
                          ))}
                        </View>
                      ) : order.status === 'PENDING' ? (
                        <View style={styles.noReceiptCard}>
                          <Text style={styles.noReceiptText}>
                            ⚠️ Aún no has enviado los datos de pago.
                          </Text>
                        </View>
                      ) : null}

                      {/* Botón para enviar pago (inicial o abono adicional) */}
                      {canSendMorePayment && !hasPendingSubmission && (
                        <TouchableOpacity
                          style={styles.uploadBtn}
                          onPress={() =>
                            router.push({
                              pathname: '/(client)/upload-receipt',
                              params: {
                                orderId: order.id,
                                paymentMethod: frontendPaymentMethod,
                                total: String(remaining),
                              },
                            })
                          }
                        >
                          <Text style={styles.uploadBtnText}>
                            {order.paymentSubmissions.length > 0
                              ? 'Enviar el saldo restante'
                              : 'Enviar datos de pago'}
                          </Text>
                        </TouchableOpacity>
                      )}

                      {hasPendingSubmission && (
                        <Text style={styles.pendingReviewNote}>
                          ⏳ Tienes un abono en revisión. Espera la confirmación antes de enviar otro.
                        </Text>
                      )}
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

interface TimelineStepProps {
  label: string
  done: boolean
  date?: string
  isLast: boolean
}

function TimelineStep({ label, done, date, isLast }: TimelineStepProps) {
  return (
    <View style={styles.timelineStep}>
      <View style={styles.timelineIconCol}>
        <View style={[styles.timelineDot, done && styles.timelineDotDone]}>
          {done && <Text style={styles.timelineCheck}>✓</Text>}
        </View>
        {!isLast && <View style={[styles.timelineLine, done && styles.timelineLineDone]} />}
      </View>
      <View style={styles.timelineTextCol}>
        <Text style={[styles.timelineLabel, done && styles.timelineLabelDone]}>{label}</Text>
        {date && <Text style={styles.timelineDate}>{date}</Text>}
      </View>
    </View>
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
  orderCardUpdated: {
    backgroundColor: '#fff8e1',
    borderColor: '#f59e0b',
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
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  statusText: { fontSize: 12, fontWeight: '700' },
  updatedBadge: {
    alignSelf: 'flex-start',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: '#f59e0b',
  },
  updatedBadgeText: { fontSize: 12, fontWeight: '700', color: '#fff' },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: { fontSize: 13, color: '#5364ad', fontWeight: '600' },
  totalValue: { fontSize: 18, fontWeight: '900', color: '#17247a' },
  progressText: { fontSize: 12, color: '#5364ad', marginTop: 8, fontWeight: '600' },
  progressTextInline: { fontSize: 12, color: '#5364ad', fontWeight: '600', marginBottom: 10 },
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
  itemSubtotal: { fontSize: 14, fontWeight: '800', color: '#17247a' },
  breakdownContainer: {
    marginTop: 4,
    marginBottom: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#eef2ff',
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginBottom: 4,
  },
  breakdownLabel: { fontSize: 13, color: '#5364ad', fontWeight: '600' },
  breakdownValue: { fontSize: 13, color: '#17247a', fontWeight: '700' },
  receiptContainer: { marginTop: 12 },
  submissionCard: {
    backgroundColor: '#f8f9ff',
    borderRadius: 10,
    padding: 10,
    marginBottom: 6,
  },
  submissionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  submissionStatus: { fontSize: 12, fontWeight: '700' },
  submissionAmount: { fontSize: 14, fontWeight: '800', color: '#17247a' },
  submissionDate: { fontSize: 11, color: '#9aa5cc', marginTop: 2 },
  submissionRejection: { fontSize: 12, color: '#b91c1c', marginTop: 4 },
  noReceiptCard: {
    marginTop: 12,
    backgroundColor: '#fff8e1',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#ffe082',
  },
  noReceiptText: { fontSize: 13, color: '#7a6000' },
  pendingReviewNote: {
    fontSize: 12,
    color: '#b45309',
    marginTop: 10,
    textAlign: 'center',
  },
  uploadBtn: {
    backgroundColor: '#17247a',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 12,
  },
  uploadBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  // ── Línea de tiempo ──
  timeline: { marginBottom: 16 },
  timelineStep: { flexDirection: 'row' },
  timelineIconCol: { alignItems: 'center', width: 24 },
  timelineDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#d0d8ff',
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  timelineDotDone: { backgroundColor: '#17247a', borderColor: '#17247a' },
  timelineCheck: { color: '#fff', fontSize: 11, fontWeight: '800' },
  timelineLine: { width: 2, flex: 1, minHeight: 24, backgroundColor: '#d0d8ff', marginTop: 2 },
  timelineLineDone: { backgroundColor: '#17247a' },
  timelineTextCol: { flex: 1, marginLeft: 10, paddingBottom: 16 },
  timelineLabel: { fontSize: 13, color: '#9aa5cc', fontWeight: '600' },
  timelineLabelDone: { color: '#17247a' },
  timelineDate: { fontSize: 11, color: '#9aa5cc', marginTop: 2 },
})