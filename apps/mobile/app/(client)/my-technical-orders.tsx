import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TextInput,
  RefreshControl,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { Stack, useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { useState, useCallback } from 'react'
import { File, Paths } from 'expo-file-system'
import * as Sharing from 'expo-sharing'
import { ordersAPI, API_URL } from '../../src/services/api'
import { useAuthStore } from '../../src/store/auth.store'
import { useToastStore } from '../../src/store/toast.store'
import { useConfirm } from '../../src/hooks/useConfirm'
import OrderProgress from '../../src/components/OrderProgress'
import { getOrderProgress, getProgressSummary, clientHistoryComment, CLIENT_STATUS_LABEL } from '../../src/utils/orderProgress'
import ContactCard from '../../src/components/ContactCard'
import BudgetDecision from '../../src/components/BudgetDecision'
import { usePaymentInfo } from '../../src/hooks/usePaymentInfo'
import { getAdvanceStatus } from '../../src/utils/advancePayment'
import { splitOrders } from '../../src/utils/orderGroups'
import ScreenHeader from '../../src/components/ScreenHeader'
import OrderProgressBar from '../../src/components/OrderProgressBar'

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
  | 'ON_THE_WAY'
  | 'DIAGNOSING'
  | 'WAITING_APPROVAL'
  | 'APPROVED'
  | 'REPAIRING'
  | 'WAITING_EXTRA_PAYMENT'
  | 'READY'
  | 'PAID_PENDING_DELIVERY'
  | 'REJECTED_PENDING_PICKUP'
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
  budgetRejectionReason?: string | null
  deliveryAmount?: number | null
  revisionAmount?: number | null
  // Viene del backend como enum de Prisma (MOBILE_PAYMENT/TRANSFER/BINANCE),
  // no como los literales del formulario — se traduce con BACKEND_TO_FRONTEND_METHOD.
  advancePaymentMethod?: string | null
  advancePaymentSubmissions?: {
    id: string
    amount: number
    status: 'PENDING' | 'CONFIRMED' | 'REJECTED'
    // REVISION = anticipo de recepción/delivery; BUDGET = anticipo del
    // presupuesto de reparación (y, desde la revisión final, también el cobro
    // del pago final tradicional). Son dos pools distintos, nunca se mezclan.
    kind?: 'REVISION' | 'BUDGET'
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
  technician?: { id: string; name: string; lastName?: string | null; phone?: string | null } | null
  paymentSummary?: {
    budget: number
    paid: number
    remaining: number
    minimumPercent: number
    minimumAmount: number
    pendingForMinimum: number
    // Abonos del presupuesto enviados que el local todavía no revisó.
    pendingReview: number
  } | null
  statusHistory: StatusHistoryEntry[]
  partsUsed?: {
    productName: string
    quantity: number
    unitPriceAtUse: number | null
  }[]
}

const STATUS_COLOR: Record<OrderStatus, string> = {
  PENDING_PAYMENT: '#6B6B75',
  RECEIVED: '#6B6B75',
  ON_THE_WAY: '#4B3E96',
  DIAGNOSING: '#4B3E96',
  WAITING_APPROVAL: '#4B3E96',
  APPROVED: '#4B3E96',
  REPAIRING: '#4B3E96',
  WAITING_EXTRA_PAYMENT: '#b45309',
  READY: '#1E7A3D',
  PAID_PENDING_DELIVERY: '#0369a1',
  REJECTED_PENDING_PICKUP: '#B3261E',
  DELIVERED: '#1E7A3D',
  CANCELLED: '#B3261E',
}

const STATUS_BG: Record<OrderStatus, string> = {
  PENDING_PAYMENT: '#EFEAE2',
  RECEIVED: '#EFEAE2',
  ON_THE_WAY: '#ECEAF3',
  DIAGNOSING: '#ECEAF3',
  WAITING_APPROVAL: '#ECEAF3',
  APPROVED: '#ECEAF3',
  REPAIRING: '#ECEAF3',
  WAITING_EXTRA_PAYMENT: '#FFF4E0',
  READY: '#E3F3E9',
  PAID_PENDING_DELIVERY: '#e0f2fe',
  REJECTED_PENDING_PICKUP: '#FBE9E7',
  DELIVERED: '#E3F3E9',
  CANCELLED: '#FBE9E7',
}

export default function MyTechnicalOrdersScreen() {
  const router = useRouter()
  const [orders, setOrders] = useState<TechOrder[]>([])
  const [loading, setLoading] = useState(true)
  // expandId: desde la tarjeta "En curso" del inicio se abre esa orden.
  const { expandId } = useLocalSearchParams<{ expandId?: string }>()
  const [expandedId, setExpandedId] = useState<string | null>(expandId ?? null)
  const [refreshing, setRefreshing] = useState(false)
  const showToast = useToastStore((state) => state.showToast)
  const confirmDialog = useConfirm()
  const [disputeNote, setDisputeNote] = useState<Record<string, string>>({})
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({})
  const [downloadingReceipt, setDownloadingReceipt] = useState<string | null>(null)
  const [historyOpen, setHistoryOpen] = useState<Record<string, boolean>>({})
  const token = useAuthStore((state) => state.token)
  const { data: paymentSettings } = usePaymentInfo()

  // silent: al deslizar para refrescar se mantiene la lista visible.
  const fetchOrders = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
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

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await fetchOrders(true)
    setRefreshing(false)
  }, [fetchOrders])

  // Se recarga cada vez que el cliente vuelve a esta pantalla (por ejemplo,
  // después de pagar), para ver el estado al día.
  useFocusEffect(
    useCallback(() => {
      fetchOrders()
    }, [fetchOrders])
  )

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id))
  }

  const handleDownloadReceipt = async (order: TechOrder, type: 'intake' | 'final') => {
    const key = `${order.id}-${type}`
    setDownloadingReceipt(key)
    try {
      const pendingPickup = type === 'intake' && order.deliveryAmount != null && !order.diagnosis
      const filename = `recibo-${type === 'final' ? 'entrega' : pendingPickup ? 'anticipo' : 'recepcion'}-${order.orderNumber}.pdf`
      const destination = new File(Paths.cache, filename)
      if (destination.exists) destination.delete()

      const file = await File.downloadFileAsync(
        `${API_URL}/api/orders/${order.id}/receipt/${type}`,
        destination,
        { headers: { Authorization: `Bearer ${token}` } }
      )

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, { mimeType: 'application/pdf' })
      } else {
        showToast('Recibo descargado, pero no se puede compartir en este dispositivo', 'info')
      }
    } catch (error: any) {
      showToast(error?.message || 'No se pudo descargar el recibo', 'error')
    } finally {
      setDownloadingReceipt(null)
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

  const goToBudgetPayment = (
    order: TechOrder,
    mode: 'approve' | 'extra',
    preset: 'minimum' | 'full',
    payable: { pendingForMinimum: number; maxAmount: number }
  ) => {
    router.push({
      pathname: '/(client)/budget-payment',
      params: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        budget: String(order.budget ?? 0),
        mode,
        preset,
        minimumPercent: String(order.paymentSummary?.minimumPercent ?? 50),
        pendingForMinimum: String(payable.pendingForMinimum),
        maxAmount: String(payable.maxAmount),
      },
    })
  }

  const handleRejectBudget = async (order: TechOrder, reason: string) => {
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

  const handleRejectExtraPart = async (order: TechOrder) => {
    const confirmed = await confirmDialog({
      title: 'Rechazar repuesto adicional',
      message: 'Si rechazas el repuesto, la reparación puede no quedar al 100% y es tu responsabilidad. Lo que ya pagaste no se devuelve. ¿Confirmas?',
      confirmLabel: 'Rechazar repuesto',
    })
    if (!confirmed) return

    setActionLoading((prev) => ({ ...prev, [order.id]: true }))
    try {
      await ordersAPI.rejectExtraPart(order.id)
      showToast('Listo. El técnico continúa la reparación sin el repuesto.', 'success')
      fetchOrders()
    } catch (error: any) {
      showToast(error?.response?.data?.message || 'Error al rechazar el repuesto', 'error')
    } finally {
      setActionLoading((prev) => ({ ...prev, [order.id]: false }))
    }
  }

  const handleConfirmZeroBudget = async (order: TechOrder) => {
    const confirmed = await confirmDialog({
      title: 'Confirmar diagnóstico',
      message: 'El técnico determinó que no es necesario reparar tu equipo. Ya pagaste la revisión y el delivery — no se te cobrará nada más. ¿Confirmas?',
      confirmLabel: 'Confirmar',
    })
    if (!confirmed) return

    setActionLoading((prev) => ({ ...prev, [order.id]: true }))
    try {
      await ordersAPI.confirmZeroBudgetDiagnosis(order.id)
      showToast('✅ Diagnóstico confirmado. No se te cobrará nada adicional.', 'success')
      fetchOrders()
    } catch (error: any) {
      showToast(error?.response?.data?.message || 'Error al confirmar el diagnóstico', 'error')
    } finally {
      setActionLoading((prev) => ({ ...prev, [order.id]: false }))
    }
  }

  const handleConfirmDelivery = async (order: TechOrder) => {
    const confirmed = await confirmDialog({
      title: 'Confirmar recepción del equipo',
      message: 'Al confirmar, das por recibido tu equipo y se finaliza el servicio. ¿Confirmas?',
      confirmLabel: 'Confirmar',
    })
    if (!confirmed) return

    setActionLoading((prev) => ({ ...prev, [order.id]: true }))
    try {
      await ordersAPI.confirmDelivery(order.id)
      showToast('✅ Servicio finalizado. ¡Gracias por confiar en RepTel!', 'success')
      fetchOrders()
    } catch (error: any) {
      showToast(error?.response?.data?.message || 'Error al confirmar la recepción', 'error')
    } finally {
      setActionLoading((prev) => ({ ...prev, [order.id]: false }))
    }
  }

  const handleDisputeZeroBudget = async (order: TechOrder) => {
    // La nota es realmente opcional: se captura antes en un TextInput propio
    // (estado disputeNote), no vía confirmDialog con requireText — con
    // requireText: true el diálogo no resuelve si el campo queda vacío,
    // lo que bloqueaba el envío sin nota pese a que el texto decía "opcional".
    const confirmed = await confirmDialog({
      title: '¿Qué sigue pasando con el equipo?',
      message: 'El técnico revisará tu equipo de nuevo. ¿Confirmas el envío?',
      confirmLabel: 'Enviar y pedir nueva revisión',
    })
    if (!confirmed) return

    const note = (disputeNote[order.id] || '').trim()

    setActionLoading((prev) => ({ ...prev, [order.id]: true }))
    try {
      await ordersAPI.disputeZeroBudgetDiagnosis(order.id, note || undefined)
      showToast('🔁 Enviado. El técnico revisará tu equipo de nuevo.', 'success')
      fetchOrders()
    } catch (error: any) {
      showToast(error?.response?.data?.message || 'Error al enviar la disputa', 'error')
    } finally {
      setActionLoading((prev) => ({ ...prev, [order.id]: false }))
    }
  }

  const renderOrderCard = (order: TechOrder, isActive: boolean) => {
    const isExpanded = expandedId === order.id
    const status = order.status
    // Lo que el cliente puede pagar descontando los abonos que el
    // local todavía no revisó — así no vuelve a pagar lo mismo.
    const pendingReview = order.paymentSummary?.pendingReview ?? 0
    const payable = {
      pendingReview,
      maxAmount: Math.max(0, (order.paymentSummary?.remaining ?? 0) - pendingReview),
      pendingForMinimum: Math.max(0, (order.paymentSummary?.pendingForMinimum ?? 0) - pendingReview),
    }

    // Anticipo incompleto de una orden de la app: se avisa sin abrir la tarjeta.
    const advance = getAdvanceStatus(order)
    const missingAdvance =
      status === 'PENDING_PAYMENT' && !advance.isCounterOrder && advance.counted > 0.009 && advance.remaining > 0.009
    const compactHistory = !isActive && !isExpanded

    const statusBadge = (
      <View
        style={[
          styles.statusBadge,
          { backgroundColor: missingAdvance ? '#FFF4E0' : STATUS_BG[status] },
        ]}
      >
        <Text style={[styles.statusText, { color: missingAdvance ? '#b45309' : STATUS_COLOR[status] }]}>
          {missingAdvance ? 'FALTA PAGO' : CLIENT_STATUS_LABEL[status] ?? status}
        </Text>
      </View>
    )

    return (
      <TouchableOpacity
        key={order.id}
        style={[styles.orderCard, isActive && styles.orderCardActive, compactHistory && styles.orderCardCompact]}
        onPress={() => toggleExpand(order.id)}
        activeOpacity={0.85}
      >
        {compactHistory ? (
          // Historial: una sola fila (número, fecha · equipo y estado).
          <View style={styles.orderHeader}>
            <View style={styles.orderHeaderLeft}>
              <Text style={styles.orderId}>{order.orderNumber}</Text>
              <Text style={styles.orderDate}>
                {formatDate(order.receivedAt)} · {order.device.brand} {order.device.model}
              </Text>
            </View>
            {statusBadge}
            <Text style={styles.expandArrow}>▼</Text>
          </View>
        ) : (
          <>
            {/* Cabecera del pedido */}
            <View style={styles.orderHeader}>
              <View style={styles.orderHeaderLeft}>
                <Text style={styles.orderId}>{order.orderNumber}</Text>
                <Text style={styles.orderDate}>{formatDate(order.receivedAt)}</Text>
              </View>
              {isActive && (
                <View style={styles.activeTag}>
                  <View style={styles.activeDot} />
                  <Text style={styles.activeTagText}>ACTIVA</Text>
                </View>
              )}
              <Text style={styles.expandArrow}>{isExpanded ? '▲' : '▼'}</Text>
            </View>

            {/* Badge de estado */}
            <View style={styles.statusRow}>
              {statusBadge}
              {((status === 'WAITING_APPROVAL' && order.budget != null) || status === 'WAITING_EXTRA_PAYMENT') && (
                <View style={styles.actionBadge}>
                  <Text style={styles.actionBadgeText}>⚠️ Acción requerida</Text>
                </View>
              )}
            </View>

            {/* Equipo siempre visible */}
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Equipo</Text>
              <Text style={styles.deviceValue}>
                {order.device.brand} {order.device.model}
              </Text>
            </View>

            {/* Paso actual de la orden activa, sin tener que abrirla */}
            {isActive && status !== 'REJECTED_PENDING_PICKUP' && (() => {
              const { current, total } = getProgressSummary(order)
              return <OrderProgressBar current={current} total={total} />
            })()}

            {/* Lo que falta del anticipo, con la tarjeta cerrada */}
            {isActive && missingAdvance && !isExpanded && (
              <View style={styles.advanceCard}>
                <Text style={styles.advanceTitle}>
                  ⏳ Pagado ${advance.counted.toFixed(2)} de ${advance.total.toFixed(2)}. Te faltan ${advance.remaining.toFixed(2)} para activar tu orden.
                </Text>
                <TouchableOpacity
                  style={styles.advanceBtn}
                  onPress={(e) => {
                    e.stopPropagation()
                    router.push({
                      pathname: '/(client)/upload-advance-receipt',
                      params: {
                        orderId: order.id,
                        paymentMethod: BACKEND_TO_FRONTEND_METHOD[order.advancePaymentMethod || ''] || 'PAGO_MOVIL',
                        total: String(advance.remaining),
                      },
                    })
                  }}
                >
                  <Text style={styles.advanceBtnText}>Enviar el resto · ${advance.remaining.toFixed(2)}</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}

        {/* Detalle expandible */}
        {isExpanded && (
          <View style={styles.expandedContent}>
            {/* Seguimiento por pasos */}
            <Text style={styles.itemsTitle}>📍 Seguimiento</Text>
            <OrderProgress steps={getOrderProgress(order)} />

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
              const { isCounterOrder, total, confirmed: confirmado, remaining: restante, submissions } = getAdvanceStatus(order)

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
                  {isCounterOrder ? (
                    <Text style={styles.advanceSubmissionRow}>
                      El pago de la revisión se registra en el local.
                    </Text>
                  ) : restante > 0.009 && (
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

            {/* Repuestos que el técnico usó/usará en la reparación —
                visible en cualquier estado desde que quedan
                registrados, no solo mientras se decide el presupuesto */}
            {order.partsUsed && order.partsUsed.length > 0 && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Repuestos a utilizar</Text>
                {order.partsUsed.map((part, index) => (
                  <Text key={index} style={styles.detailValue}>
                    {part.productName} (x{part.quantity}) — ${(part.quantity * Number(part.unitPriceAtUse ?? 0)).toFixed(2)}
                  </Text>
                ))}
              </View>
            )}

            {/* Contacto — desde el pago confirmado hasta la entrega */}
            {!['PENDING_PAYMENT', 'DELIVERED', 'CANCELLED'].includes(status) && (
              <ContactCard technician={order.technician} storePhone={paymentSettings?.pagoMovilTelefono} />
            )}

            {/* Presupuesto — con resumen de lo pagado y lo que falta,
                salvo en órdenes rechazadas (ahí no se cobra más). */}
            {order.budget != null && (status === 'REJECTED_PENDING_PICKUP' || status === 'CANCELLED' || !order.paymentSummary ? (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Presupuesto</Text>
                <Text style={styles.detailValue}>
                  ${Number(order.budget).toFixed(2)}
                  {order.budgetApproved === false ? ' — Rechazado' : ''}
                </Text>
              </View>
            ) : (
              <View style={styles.paymentSummary}>
                <View style={styles.paymentSummaryRow}>
                  <Text style={styles.paymentSummaryLabel}>Presupuesto</Text>
                  <Text style={styles.paymentSummaryValue}>${order.paymentSummary.budget.toFixed(2)}</Text>
                </View>
                <View style={styles.paymentSummaryRow}>
                  <Text style={styles.paymentSummaryLabel}>Pagado</Text>
                  <Text style={styles.paymentSummaryValue}>${order.paymentSummary.paid.toFixed(2)}</Text>
                </View>
                <View style={[styles.paymentSummaryRow, styles.paymentSummaryTotal]}>
                  <Text style={styles.paymentSummaryLabelBold}>Te falta</Text>
                  <Text style={styles.paymentSummaryValueBold}>${order.paymentSummary.remaining.toFixed(2)}</Text>
                </View>
              </View>
            ))}

            {/* Decisión del cliente sobre el presupuesto — solo cuando el
                presupuesto supera lo ya pagado por la revisión. Si
                budget <= revisionAmount el 50% del anticipo da <= 0
                (nada que cobrar): ese caso usa la tarjeta de
                "diagnóstico sin costo adicional" de más abajo, igual
                que budget === 0 (Finding 4, revisión final). */}
            {status === 'WAITING_APPROVAL' && order.budget != null && Number(order.budget) > Number(order.revisionAmount ?? 15) && (
              <BudgetDecision
                kind="budget"
                minimumAmount={payable.pendingForMinimum}
                fullAmount={payable.maxAmount}
                pendingReview={payable.pendingReview}
                loading={!!actionLoading[order.id]}
                onPay={(preset) => goToBudgetPayment(order, 'approve', preset, payable)}
                onReject={(reason) => handleRejectBudget(order, reason ?? '')}
              />
            )}

            {/* Decisión del cliente — diagnóstico SIN costo (incluye
                budget > 0 pero <= revisionAmount: económicamente es
                el mismo caso de "nada más que cobrar", ver Finding 4) */}
            {status === 'WAITING_APPROVAL' && order.budget != null && Number(order.budget) <= Number(order.revisionAmount ?? 15) && (
              <View style={styles.decisionCard}>
                <Text style={styles.decisionTitle}>
                  El técnico determinó que no es necesario reparar tu equipo
                </Text>
                {order.diagnosis && (
                  <Text style={styles.reasonLabel}>{order.diagnosis}</Text>
                )}

                <TouchableOpacity
                  style={styles.approveBtn}
                  onPress={(e) => { e.stopPropagation(); handleConfirmZeroBudget(order) }}
                  disabled={actionLoading[order.id]}
                >
                  <Text style={styles.approveBtnText}>✅ Confirmar diagnóstico</Text>
                </TouchableOpacity>

                <Text style={styles.reasonLabel}>
                  Si no estás de acuerdo, cuéntanos qué sigue pasando (opcional):
                </Text>
                <TextInput
                  style={styles.reasonInput}
                  placeholder="Ej. Sigue sin encender"
                  placeholderTextColor="#9aa5cc"
                  value={disputeNote[order.id] || ''}
                  onChangeText={(text) =>
                    setDisputeNote((prev) => ({ ...prev, [order.id]: text }))
                  }
                  onTouchStart={(e) => e.stopPropagation()}
                />

                <TouchableOpacity
                  style={styles.rejectBtn}
                  onPress={(e) => { e.stopPropagation(); handleDisputeZeroBudget(order) }}
                  disabled={actionLoading[order.id]}
                >
                  <Text style={styles.rejectBtnText}>🔁 No estoy de acuerdo, pedir nueva revisión</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Repuesto adicional durante la reparación */}
            {status === 'WAITING_EXTRA_PAYMENT' && order.paymentSummary && (
              <>
                <Text style={styles.reasonLabel}>
                  Presupuesto nuevo: ${order.paymentSummary.budget.toFixed(2)} · Pagado: ${order.paymentSummary.paid.toFixed(2)}.
                </Text>
                <BudgetDecision
                  kind="extra"
                  minimumAmount={payable.pendingForMinimum}
                  fullAmount={payable.maxAmount}
                  pendingReview={payable.pendingReview}
                  loading={!!actionLoading[order.id]}
                  onPay={(preset) => goToBudgetPayment(order, 'extra', preset, payable)}
                  onReject={() => handleRejectExtraPart(order)}
                />
              </>
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
                  // Saldo real, no un 50% fijo: base (presupuesto −
                  // revisión ya pagada) menos todo lo confirmado del
                  // pool BUDGET. Con anticipo hasta el 100% y
                  // ajustes imprevistos al presupuesto, el 50% dejó
                  // de ser cierto (Finding B, revisión final).
                  const base =
                    Number(order.budget ?? 0) - Number(order.revisionAmount ?? 15)
                  const confirmado = (order.advancePaymentSubmissions ?? [])
                    .filter((s) => s.kind === 'BUDGET' && s.status === 'CONFIRMED')
                    .reduce((sum, s) => sum + Number(s.amount), 0)
                  const restante = Math.max(base - confirmado, 0)
                  router.push({
                    pathname: '/(client)/final-payment',
                    params: {
                      orderId: order.id,
                      orderNumber: order.orderNumber,
                      budget: String(order.budget ?? 0),
                      revisionAmount: String(order.revisionAmount ?? 15),
                      remaining: String(restante),
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

            {/* Aceptar entrega a domicilio — reemplaza el "marcar
                entregado" del admin para self-service+delivery: el
                cliente es quien puede confirmar que el equipo
                llegó, el admin no está presente en la entrega. */}
            {status === 'PAID_PENDING_DELIVERY' && order.deliveryAmount != null && (
              <TouchableOpacity
                style={styles.approveBtn}
                onPress={(e) => { e.stopPropagation(); handleConfirmDelivery(order) }}
                disabled={actionLoading[order.id]}
              >
                <Text style={styles.approveBtnText}>✅ Aceptar y finalizar servicio</Text>
              </TouchableOpacity>
            )}

            {/* Recibos descargables — disponible desde que el anticipo está
                confirmado; entrega solo si ya se entregó. En self-service con
                delivery, RECEIVED solo significa "pago confirmado", no que el
                técnico ya fue a buscar el equipo — hasta que haya diagnóstico
                se etiqueta como "recibo del anticipo" en vez de "recepción". */}
            {status !== 'PENDING_PAYMENT' && (() => {
              const pendingPickup = order.deliveryAmount != null && !order.diagnosis
              return (
                <TouchableOpacity
                  style={styles.linkedProductBtn}
                  onPress={(e) => { e.stopPropagation(); handleDownloadReceipt(order, 'intake') }}
                  disabled={downloadingReceipt === `${order.id}-intake`}
                >
                  <Text style={styles.linkedProductBtnText}>
                    📄 Descargar {pendingPickup ? 'recibo del anticipo' : 'recibo de recepción'}
                  </Text>
                </TouchableOpacity>
              )
            })()}
            {status === 'DELIVERED' && (
              <TouchableOpacity
                style={styles.linkedProductBtn}
                onPress={(e) => { e.stopPropagation(); handleDownloadReceipt(order, 'final') }}
                disabled={downloadingReceipt === `${order.id}-final`}
              >
                <Text style={styles.linkedProductBtnText}>📄 Descargar recibo de entrega</Text>
              </TouchableOpacity>
            )}

            {/* Comisión (solo informativo, orden ya entregada) */}
            {status === 'DELIVERED' && order.technicianCommission != null && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Servicio completado</Text>
                <Text style={styles.detailValue}>✅ Pago final confirmado</Text>
              </View>
            )}

            {/* Historial detallado — plegado; el seguimiento de arriba es el resumen */}
            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation()
                setHistoryOpen((prev) => ({ ...prev, [order.id]: !prev[order.id] }))
              }}
            >
              <Text style={styles.itemsTitle}>
                📋 {historyOpen[order.id] ? 'Ocultar detalle ▲' : 'Ver detalle ▼'}
              </Text>
            </TouchableOpacity>
            {historyOpen[order.id] && order.statusHistory.map((entry) => {
              const comment = entry.comment ? clientHistoryComment(entry.comment) : ''
              return (
                <View key={entry.id} style={styles.itemRow}>
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemName}>{CLIENT_STATUS_LABEL[entry.status] ?? entry.status}</Text>
                    {comment !== '' && (
                      <Text style={styles.itemQty}>{comment}</Text>
                    )}
                  </View>
                  <Text style={styles.historyDate}>{formatDate(entry.createdAt)}</Text>
                </View>
              )
            })}
          </View>
        )}
      </TouchableOpacity>
    )
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <LinearGradient
        colors={['#ffffff', '#eef2ff', '#d5ddff', '#8fa5ff']}
        style={styles.container}
      >
        <ScreenHeader backLabel="← Inicio" title="Mis Órdenes de Servicio" subtitle="Historial de reparaciones y mantenimiento" />

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
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#17247a" />}
          >
            <TouchableOpacity style={styles.refreshBtn} onPress={() => fetchOrders()}>
              <Text style={styles.refreshText}>↻ Actualizar</Text>
            </TouchableOpacity>

            {(() => {
              const { active, history } = splitOrders(orders)
              return (
                <>
                  <Text style={styles.sectionLabel}>EN CURSO</Text>
                  {active.length === 0 ? (
                    <View style={styles.emptyActive}>
                      <Text style={styles.emptyActiveText}>No tienes órdenes en curso</Text>
                    </View>
                  ) : (
                    active.map((o) => renderOrderCard(o, true))
                  )}
                  {history.length > 0 && <Text style={styles.sectionLabel}>HISTORIAL</Text>}
                  {history.map((o) => renderOrderCard(o, false))}
                </>
              )
            })()}
          </ScrollView>
        )}
      </LinearGradient>
    </>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  sectionLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 0.6, color: '#5364ad', marginTop: 8, marginBottom: 8 },
  orderCardActive: {
    borderWidth: 2,
    borderColor: '#17247a',
    shadowColor: '#17247a',
    shadowOpacity: 0.16,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  orderCardCompact: { paddingVertical: 12 },
  activeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E3F3E9',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginRight: 8,
  },
  activeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#1E7A3D' },
  activeTagText: { fontSize: 10, fontWeight: '800', color: '#1E7A3D' },
  emptyActive: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#d0d8ff',
    alignItems: 'center',
    marginBottom: 14,
  },
  emptyActiveText: { fontSize: 13, color: '#5364ad' },
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
  actionBadge: {
    alignSelf: 'flex-start',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: '#B3261E',
  },
  actionBadgeText: { fontSize: 12, fontWeight: '700', color: '#fff' },
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
  paymentSummary: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#d5ddff',
  },
  paymentSummaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  paymentSummaryTotal: { borderTopWidth: 1, borderTopColor: '#e3e8ff', marginTop: 4, paddingTop: 6 },
  paymentSummaryLabel: { fontSize: 13, color: '#5a6399' },
  paymentSummaryValue: { fontSize: 13, color: '#17247a' },
  paymentSummaryLabelBold: { fontSize: 14, fontWeight: '700', color: '#17247a' },
  paymentSummaryValueBold: { fontSize: 14, fontWeight: '700', color: '#17247a' },
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
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  approveBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  reasonLabel: { fontSize: 12, color: '#5364ad', marginBottom: 8 },
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
    minHeight: 44,
    justifyContent: 'center',
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