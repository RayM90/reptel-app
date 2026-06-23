import { useEffect, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native'
import { router } from 'expo-router'
import { useAuthStore } from '../../src/store/auth.store'
import { ordersAPI } from '../../src/services/api'

interface Order {
  id: string
  orderNumber: string
  status: string
  problem: string
  client: { name: string; phone: string }
  device: { brand: string; model: string }
  receivedAt: string
}

const statusColors: Record<string, string> = {
  RECEIVED: '#3498DB',
  DIAGNOSING: '#9B59B6',
  WAITING_APPROVAL: '#F39C12',
  APPROVED: '#27AE60',
  REPAIRING: '#E67E22',
  READY: '#2ECC71',
  DELIVERED: '#95A5A6',
  CANCELLED: '#E74C3C',
}

const statusLabels: Record<string, string> = {
  RECEIVED: 'Recibido',
  DIAGNOSING: 'Diagnosticando',
  WAITING_APPROVAL: 'Esperando aprobación',
  APPROVED: 'Aprobado',
  REPAIRING: 'En reparación',
  READY: 'Listo',
  DELIVERED: 'Entregado',
  CANCELLED: 'Cancelado',
}

export default function DashboardScreen() {
  const { user, logout } = useAuthStore()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchOrders = async () => {
    try {
      const response = await ordersAPI.getAll()
      setOrders(response.data.data)
    } catch (error) {
      console.error('Error cargando órdenes:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchOrders()
  }, [])

  const onRefresh = () => {
    setRefreshing(true)
    fetchOrders()
  }

  const handleLogout = () => {
    logout()
    router.replace('/(auth)/login')
  }

  const activeOrders = orders.filter(o => o.status !== 'DELIVERED' && o.status !== 'CANCELLED')
  const readyOrders = orders.filter(o => o.status === 'READY')

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.welcome}>Bienvenido</Text>
          <Text style={styles.userName}>{user?.name}</Text>
        </View>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
          <Text style={styles.logoutText}>Salir</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: '#3498DB' }]}>
            <Text style={styles.statNumber}>{activeOrders.length}</Text>
            <Text style={styles.statLabel}>Activas</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: '#2ECC71' }]}>
            <Text style={styles.statNumber}>{readyOrders.length}</Text>
            <Text style={styles.statLabel}>Listas</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: '#9B59B6' }]}>
            <Text style={styles.statNumber}>{orders.length}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
        </View>

        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.newOrderBtn}
            onPress={() => router.push('/(admin)/search-client')}
          >
            <Text style={styles.newOrderBtnText}>+ Nueva Orden</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>Órdenes activas</Text>

        {loading ? (
          <ActivityIndicator size="large" color="#1E3A5F" style={{ marginTop: 32 }} />
        ) : activeOrders.length === 0 ? (
          <Text style={styles.emptyText}>No hay órdenes activas</Text>
        ) : (
          activeOrders.map((order) => (
            <TouchableOpacity
              key={order.id}
              style={styles.orderCard}
              onPress={() => router.push(`/(admin)/orders`)}
            >
              <View style={styles.orderHeader}>
                <Text style={styles.orderNumber}>{order.orderNumber}</Text>
                <View style={[styles.statusBadge, { backgroundColor: statusColors[order.status] }]}>
                  <Text style={styles.statusText}>{statusLabels[order.status]}</Text>
                </View>
              </View>
              <Text style={styles.orderClient}>{order.client?.name}</Text>
              <Text style={styles.orderDevice}>
                {order.device?.brand} {order.device?.model}
              </Text>
              <Text style={styles.orderProblem} numberOfLines={1}>{order.problem}</Text>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA' },
  header: {
    backgroundColor: '#1E3A5F',
    padding: 24,
    paddingTop: 56,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  welcome: { color: '#A8C4E0', fontSize: 14 },
  userName: { color: '#ffffff', fontSize: 20, fontWeight: 'bold' },
  logoutBtn: { backgroundColor: 'rgba(255,255,255,0.2)', padding: 8, borderRadius: 8 },
  logoutText: { color: '#ffffff', fontSize: 14 },
  content: { flex: 1, padding: 16 },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 24, marginTop: 8 },
  statCard: {
    flex: 1, borderRadius: 12, padding: 16, alignItems: 'center',
  },
  statNumber: { color: '#fff', fontSize: 28, fontWeight: 'bold' },
  statLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 4 },
  actionsRow: { marginBottom: 16 },
  newOrderBtn: {
    backgroundColor: '#1a73e8',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
  },
  newOrderBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: '#1E3A5F', marginBottom: 12 },
  emptyText: { textAlign: 'center', color: '#999', marginTop: 32, fontSize: 16 },
  orderCard: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16,
    marginBottom: 12, elevation: 2,
  },
  orderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  orderNumber: { fontSize: 14, fontWeight: 'bold', color: '#1E3A5F' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  orderClient: { fontSize: 15, fontWeight: '600', color: '#333' },
  orderDevice: { fontSize: 13, color: '#666', marginTop: 2 },
  orderProblem: { fontSize: 13, color: '#999', marginTop: 4 },
})