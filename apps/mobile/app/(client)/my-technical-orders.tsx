import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { Stack, useRouter } from 'expo-router'
import { useState, useEffect, useCallback } from 'react'
import { ordersAPI } from '../../src/services/api'

type OrderStatus =
  | 'RECEIVED'
  | 'WAITING_APPROVAL'
  | 'APPROVED'
  | 'IN_PROGRESS'
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
  budget?: number | null
  budgetApproved?: boolean | null
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
  RECEIVED: '📥 Recibida',
  WAITING_APPROVAL: '⏳ Esperando aprobación de presupuesto',
  APPROVED: '✅ Presupuesto aprobado',
  IN_PROGRESS: '🔧 En reparación',
  READY: '📦 Lista para entrega',
  DELIVERED: '🚚 Entregada',
  CANCELLED: '❌ Cancelada',
}

const STATUS_COLOR: Record<OrderStatus, string> = {
  RECEIVED: '#1d4ed8',
  WAITING_APPROVAL: '#b45309',
  APPROVED: '#15803d',
  IN_PROGRESS: '#7c3aed',
  READY: '#0f766e',
  DELIVERED: '#15803d',
  CANCELLED: '#b91c1c',
}

const STATUS_BG: Record<OrderStatus, string> = {
  RECEIVED: '#dbeafe',
  WAITING_APPROVAL: '#fef3c7',
  APPROVED: '#dcfce7',
  IN_PROGRESS: '#ede9fe',
  READY: '#ccfbf1',
  DELIVERED: '#dcfce7',
  CANCELLED: '#fee2e2',
}

export default function MyTechnicalOrdersScreen() {
  const router = useRouter()
  const [orders, setOrders] = useState<TechOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const fetchOrders = useCallback(async () => {
    setLoading(true)
    try {
      const response = await ordersAPI.getMyOrders()
      setOrders(response.data.data)
    } catch (error: any) {
      const backendMessage = error?.response?.data?.message
      Alert.alert(
        'No se pudieron cargar las órdenes',
        backendMessage || 'Ocurrió un error al obtener tus órdenes. Intenta de nuevo.'
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

                      {/* Observaciones */}
                      {order.observations && (
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>Observaciones</Text>
                          <Text style={styles.detailValue}>{order.observations}</Text>
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