import { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native'
import { ordersAPI } from '../../src/services/api'

const statusLabels: Record<string, string> = {
  RECEIVED: 'Equipo recibido',
  DIAGNOSING: 'En diagnóstico',
  WAITING_APPROVAL: 'Esperando tu aprobación',
  APPROVED: 'Presupuesto aprobado',
  REPAIRING: 'En reparación',
  READY: '¡Listo para retirar!',
  DELIVERED: 'Entregado',
  CANCELLED: 'Cancelado',
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

const allStatuses = [
  'RECEIVED',
  'DIAGNOSING',
  'WAITING_APPROVAL',
  'APPROVED',
  'REPAIRING',
  'READY',
  'DELIVERED',
]

export default function TrackingScreen() {
  const [orderNumber, setOrderNumber] = useState('')
  const [loading, setLoading] = useState(false)
  const [order, setOrder] = useState<any>(null)

  const handleTrack = async () => {
    if (!orderNumber.trim()) {
      Alert.alert('Error', 'Ingresa el número de orden')
      return
    }
    try {
      setLoading(true)
      setOrder(null)
      const response = await ordersAPI.track(orderNumber.trim())
      setOrder(response.data.data)
    } catch (error: any) {
      Alert.alert('Error', 'Orden no encontrada. Verifica el número.')
    } finally {
      setLoading(false)
    }
  }

  const currentStatusIndex = order ? allStatuses.indexOf(order.status) : -1

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>RepTel</Text>
        <Text style={styles.subtitle}>Seguimiento de reparación</Text>
      </View>

      <View style={styles.searchCard}>
        <Text style={styles.label}>Número de orden</Text>
        <TextInput
          style={styles.input}
          placeholder="Ej: REP-260518-9027"
          placeholderTextColor="#999"
          value={orderNumber}
          onChangeText={setOrderNumber}
          autoCapitalize="characters"
        />
        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleTrack}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Buscar</Text>
          )}
        </TouchableOpacity>
      </View>

      {order && (
        <View style={styles.resultCard}>
          <View style={styles.orderInfo}>
            <Text style={styles.orderNumber}>{order.orderNumber}</Text>
            <View style={[styles.statusBadge, { backgroundColor: statusColors[order.status] }]}>
              <Text style={styles.statusBadgeText}>{statusLabels[order.status]}</Text>
            </View>
          </View>

          <View style={styles.deviceInfo}>
            <Text style={styles.deviceName}>
              {order.device?.brand} {order.device?.model}
            </Text>
            <Text style={styles.problem}>{order.problem}</Text>
          </View>

          <Text style={styles.timelineTitle}>Estado de la reparación</Text>
          <View style={styles.timeline}>
            {allStatuses.map((status, index) => {
              const isCompleted = index <= currentStatusIndex
              const isCurrent = index === currentStatusIndex
              return (
                <View key={status} style={styles.timelineItem}>
                  <View style={styles.timelineLeft}>
                    <View style={[
                      styles.timelineDot,
                      isCompleted && styles.timelineDotCompleted,
                      isCurrent && { backgroundColor: statusColors[status] }
                    ]} />
                    {index < allStatuses.length - 1 && (
                      <View style={[
                        styles.timelineLine,
                        isCompleted && styles.timelineLineCompleted
                      ]} />
                    )}
                  </View>
                  <Text style={[
                    styles.timelineLabel,
                    isCompleted && styles.timelineLabelCompleted,
                    isCurrent && styles.timelineLabelCurrent
                  ]}>
                    {statusLabels[status]}
                  </Text>
                </View>
              )
            })}
          </View>

          {order.statusHistory && order.statusHistory.length > 0 && (
            <View style={styles.historySection}>
              <Text style={styles.timelineTitle}>Historial</Text>
              {order.statusHistory.map((h: any) => (
                <View key={h.id} style={styles.historyItem}>
                  <Text style={styles.historyStatus}>{statusLabels[h.status]}</Text>
                  {h.comment && <Text style={styles.historyComment}>{h.comment}</Text>}
                  <Text style={styles.historyDate}>
                    {new Date(h.createdAt).toLocaleString('es-VE')}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA' },
  content: { padding: 16, paddingBottom: 32 },
  header: {
    alignItems: 'center',
    paddingVertical: 32,
    backgroundColor: '#1E3A5F',
    marginHorizontal: -16,
    marginTop: -16,
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  title: { fontSize: 36, fontWeight: 'bold', color: '#fff', letterSpacing: 3 },
  subtitle: { color: '#A8C4E0', fontSize: 14, marginTop: 4 },
  searchCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 16, elevation: 2 },
  label: { fontSize: 14, fontWeight: '600', color: '#1E3A5F', marginBottom: 8 },
  input: {
    borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 8,
    padding: 12, fontSize: 16, color: '#333', backgroundColor: '#F9F9F9',
  },
  button: {
    backgroundColor: '#1E3A5F', borderRadius: 8,
    padding: 14, alignItems: 'center', marginTop: 12,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  resultCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, elevation: 2 },
  orderInfo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  orderNumber: { fontSize: 16, fontWeight: 'bold', color: '#1E3A5F' },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  statusBadgeText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  deviceInfo: { borderTopWidth: 1, borderTopColor: '#F0F0F0', paddingTop: 12, marginBottom: 16 },
  deviceName: { fontSize: 16, fontWeight: '600', color: '#333' },
  problem: { fontSize: 14, color: '#666', marginTop: 4 },
  timelineTitle: { fontSize: 16, fontWeight: '600', color: '#1E3A5F', marginBottom: 12 },
  timeline: { marginBottom: 16 },
  timelineItem: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 0 },
  timelineLeft: { alignItems: 'center', marginRight: 12, width: 20 },
  timelineDot: {
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: '#E0E0E0', borderWidth: 2, borderColor: '#E0E0E0',
  },
  timelineDotCompleted: { backgroundColor: '#1E3A5F', borderColor: '#1E3A5F' },
  timelineLine: { width: 2, height: 32, backgroundColor: '#E0E0E0' },
  timelineLineCompleted: { backgroundColor: '#1E3A5F' },
  timelineLabel: { fontSize: 14, color: '#999', paddingTop: 0, lineHeight: 16, marginBottom: 16 },
  timelineLabelCompleted: { color: '#333' },
  timelineLabelCurrent: { fontWeight: '700', color: '#1E3A5F' },
  historySection: { borderTopWidth: 1, borderTopColor: '#F0F0F0', paddingTop: 12 },
  historyItem: { marginBottom: 12 },
  historyStatus: { fontSize: 14, fontWeight: '600', color: '#1E3A5F' },
  historyComment: { fontSize: 13, color: '#666', marginTop: 2 },
  historyDate: { fontSize: 12, color: '#999', marginTop: 2 },
})