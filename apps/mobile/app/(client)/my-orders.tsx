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
import { productOrdersAPI } from '../../src/services/api'

type OrderStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED'

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

interface ProductOrder {
  id: string
  status: OrderStatus
  total: number
  createdAt: string
  address: string
  paymentMethod: string
  notes?: string
  paymentDetails?: Record<string, string>
  paidAt?: string
  items: ProductOrderItem[]
}

const STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: '⏳ Pendiente de confirmación',
  CONFIRMED: '✅ Pago confirmado',
  CANCELLED: '❌ Cancelado',
}

const STATUS_COLOR: Record<OrderStatus, string> = {
  PENDING: '#b45309',
  CONFIRMED: '#15803d',
  CANCELLED: '#b91c1c',
}

const STATUS_BG: Record<OrderStatus, string> = {
  PENDING: '#fef3c7',
  CONFIRMED: '#dcfce7',
  CANCELLED: '#fee2e2',
}

const PAYMENT_LABEL: Record<string, string> = {
  MOBILE_PAYMENT: '📱 Pago Móvil',
  TRANSFER: '🏦 Transferencia',
  BINANCE: '₿ Binance',
}

export default function MyOrdersScreen() {
  const router = useRouter()
  const [orders, setOrders] = useState<ProductOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const fetchOrders = useCallback(async () => {
    setLoading(true)
    try {
      const response = await productOrdersAPI.getMyOrders()
      setOrders(response.data.data)
    } catch (error: any) {
      const backendMessage = error?.response?.data?.message
      Alert.alert(
        'No se pudieron cargar los pedidos',
        backendMessage || 'Ocurrió un error al obtener tus pedidos. Intenta de nuevo.'
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
            <TouchableOpacity style={styles.refreshBtn} onPress={fetchOrders}>
              <Text style={styles.refreshText}>↻ Actualizar</Text>
            </TouchableOpacity>

            {orders.map((order) => {
              const isExpanded = expandedId === order.id
              const status = order.status as OrderStatus

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
                      <Text style={styles.orderId}>
                        Pedido #{order.id.slice(0, 8).toUpperCase()}
                      </Text>
                      <Text style={styles.orderDate}>{formatDate(order.createdAt)}</Text>
                    </View>
                    <Text style={styles.expandArrow}>{isExpanded ? '▲' : '▼'}</Text>
                  </View>

                  {/* Badge de estado */}
                  <View style={[styles.statusBadge, { backgroundColor: STATUS_BG[status] }]}>
                    <Text style={[styles.statusText, { color: STATUS_COLOR[status] }]}>
                      {STATUS_LABEL[status]}
                    </Text>
                  </View>

                  {/* Total siempre visible */}
                  <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>Total</Text>
                    <Text style={styles.totalValue}>${Number(order.total).toFixed(2)}</Text>
                  </View>

                  {/* Detalle expandible */}
                  {isExpanded && (
                    <View style={styles.expandedContent}>
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

                      {/* Fecha de confirmación */}
                      {order.paidAt && (
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>Confirmado el</Text>
                          <Text style={styles.detailValue}>{formatDate(order.paidAt)}</Text>
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

{/* Datos de pago */}
                      {order.paymentDetails ? (
                        <View style={styles.receiptContainer}>
                          <Text style={styles.itemsTitle}>🧾 Datos de pago enviados</Text>
                          {Object.entries(order.paymentDetails).map(([key, value]) => (
                            <View key={key} style={styles.detailRow}>
                              <Text style={styles.detailLabel}>{key}</Text>
                              <Text style={styles.detailValue}>{value}</Text>
                            </View>
                          ))}
                        </View>
                      ) : order.status === 'PENDING' ? (
                        <View style={styles.noReceiptCard}>
                          <Text style={styles.noReceiptText}>
                            ⚠️ Aún no has enviado los datos de pago.
                          </Text>
                          <TouchableOpacity
                            style={styles.uploadBtn}
                            onPress={() =>
                              router.push({
                                pathname: '/(client)/upload-receipt',
                                params: { orderId: order.id, paymentMethod: order.paymentMethod === 'MOBILE_PAYMENT' ? 'PAGO_MOVIL' : order.paymentMethod === 'TRANSFER' ? 'TRANSFERENCIA' : 'BINANCE' },
                              })
                            }
                          >
                            <Text style={styles.uploadBtnText}>Enviar datos de pago</Text>
                          </TouchableOpacity>
                        </View>
                      ) : null}
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
  totalValue: { fontSize: 18, fontWeight: '900', color: '#17247a' },
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
  receiptContainer: { marginTop: 12 },
  receiptImage: {
    width: '100%',
    height: 220,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d0d8ff',
    backgroundColor: '#f0f3ff',
  },
  noReceiptCard: {
    marginTop: 12,
    backgroundColor: '#fff8e1',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#ffe082',
  },
  noReceiptText: { fontSize: 13, color: '#7a6000', marginBottom: 10 },
  uploadBtn: {
    backgroundColor: '#17247a',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  uploadBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
})