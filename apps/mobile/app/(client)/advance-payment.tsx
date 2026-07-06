import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { Stack, useRouter, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { ordersAPI } from '../../src/services/api'

type PaymentMethod = 'PAGO_MOVIL' | 'TRANSFERENCIA' | 'BINANCE'

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  PAGO_MOVIL: '📱 Pago Móvil',
  TRANSFERENCIA: '🏦 Transferencia Bancaria',
  BINANCE: '₿ Binance',
}

const PAYMENT_INFO: Record<PaymentMethod, string> = {
  PAGO_MOVIL: 'Banco: Banesco • Teléfono: 0414-1234567 • CI: V-12345678',
  TRANSFERENCIA: 'Banco: Banesco • Cuenta: 0134-0000-00-0000000000 • RIF: J-12345678-9',
  BINANCE: 'ID Binance: reptel@correo.com • Red: BEP20 (USDT)',
}

// Montos fijos de delivery + revisión — deben coincidir con las
// constantes ADVANCE_DELIVERY_AMOUNT / ADVANCE_REVISION_AMOUNT en
// server/src/modules/orders/orders.service.ts. Como no son configurables
// todavía (decisión consciente por ahora), si cambian allá hay que
// actualizarlos aquí también.
const DELIVERY_AMOUNT = 10
const REVISION_AMOUNT = 15
const TOTAL_ADVANCE = DELIVERY_AMOUNT + REVISION_AMOUNT

interface DeviceParams {
  type: 'LAPTOP' | 'PC'
  brand: string
  model: string
  serialNumber?: string
  color: string
  accessories: string
  devicePassword?: string
}

interface SelectedFaultItem {
  id: string
  name: string
  price: number
  isCustom?: boolean
}

export default function AdvancePaymentScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{
    device: string
    problem: string
    observations: string
    totalEstimated: string
    selectedItems: string
  }>()

  const device: DeviceParams = JSON.parse(params.device)
  const problem = params.problem
  const observations = params.observations || undefined
  const totalEstimated = params.totalEstimated
  const selectedItems: SelectedFaultItem[] = JSON.parse(params.selectedItems || '[]')

  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null)
  const [loading, setLoading] = useState(false)

  const handleConfirm = () => {
    if (!selectedMethod) {
      Alert.alert('Método de pago', 'Selecciona un método de pago para continuar')
      return
    }

    Alert.alert(
      'Confirmar pago anticipado',
      `Delivery: $${DELIVERY_AMOUNT}\nRevisión: $${REVISION_AMOUNT}\nTotal: $${TOTAL_ADVANCE}\nMétodo: ${PAYMENT_LABELS[selectedMethod]}\n\nEste monto no es reembolsable en caso de rechazar el presupuesto final. ¿Confirmas?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Confirmar', onPress: () => submitOrder(selectedMethod) },
      ]
    )
  }

  const submitOrder = async (method: PaymentMethod) => {
    setLoading(true)
    try {
      const response = await ordersAPI.createSelfService({
        device,
        problem,
        observations,
        advancePaymentMethod: method,
      })

      const orderData = response.data.data

      Alert.alert(
        '✅ Orden creada',
        `Número: ${orderData.orderNumber}\n\nAhora sube el comprobante de pago para procesar tu orden.`,
        [
          {
            text: 'OK',
        onPress: () =>
        router.replace({
        pathname: '/(client)/upload-advance-receipt',
        params: { orderId: orderData.id, paymentMethod: method },
      }),
          },
        ]
      )
    } catch (error: any) {
      const backendMessage = error?.response?.data?.message
      Alert.alert(
        'No se pudo crear la orden',
        backendMessage || 'Ocurrió un error al procesar tu orden. Intenta de nuevo.'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <LinearGradient
        colors={['#ffffff', '#eef2ff', '#d5ddff', '#8fa5ff']}
        style={styles.container}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backText}>← Volver</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Pago Anticipado</Text>
          <Text style={styles.subtitle}>Delivery + revisión del equipo</Text>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
{/* Resumen del equipo */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🖥️ Equipo reportado</Text>
            <View style={styles.deviceCard}>
              <Text style={styles.deviceText}>
                {device.type === 'LAPTOP' ? 'Laptop' : 'PC'} — {device.brand} {device.model}
              </Text>
              <Text style={styles.deviceSubtext}>
                Color: {device.color} · Accesorios: {device.accessories}
              </Text>
            </View>
          </View>

          {/* Servicios/fallas seleccionados */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🔧 Servicios seleccionados</Text>
            <View style={styles.deviceCard}>
              {selectedItems.map((item) => (
                <View key={item.id} style={styles.faultSummaryRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.faultSummaryName}>{item.name}</Text>
                    {item.isCustom && (
                      <Text style={styles.faultSummaryTag}>Personalizado</Text>
                    )}
                  </View>
                  <Text style={styles.faultSummaryPrice}>
                    {item.price > 0 ? `$${item.price}` : 'A evaluar'}
                  </Text>
                </View>
              ))}
              {totalEstimated && Number(totalEstimated) > 0 && (
                <View style={styles.estimateTotalRow}>
                  <Text style={styles.estimateTotalLabel}>Total estimado de reparación</Text>
                  <Text style={styles.estimateTotalValue}>${totalEstimated}</Text>
                </View>
              )}
              <Text style={styles.estimateNote}>Sujeto a confirmación del técnico</Text>
            </View>
          </View>

          {/* Desglose del pago anticipado */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>💰 Monto a pagar ahora</Text>
            <View style={styles.breakdownCard}>
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>Delivery (motorizado)</Text>
                <Text style={styles.breakdownValue}>${DELIVERY_AMOUNT}</Text>
              </View>
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>Revisión / diagnóstico</Text>
                <Text style={styles.breakdownValue}>${REVISION_AMOUNT}</Text>
              </View>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total</Text>
                <Text style={styles.totalValue}>${TOTAL_ADVANCE}</Text>
              </View>
            </View>
            <View style={styles.noteCard}>
              <Text style={styles.noteText}>
                ⚠️ Si aceptas el presupuesto final, el monto de revisión ($
                {REVISION_AMOUNT}) se descuenta del total de la reparación. El
                delivery (${DELIVERY_AMOUNT}) no se descuenta ni se reembolsa
                en ningún caso — asegura la salida del motorizado.
              </Text>
            </View>
          </View>

          {/* Método de pago */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>💳 Método de pago</Text>
            {(Object.keys(PAYMENT_LABELS) as PaymentMethod[]).map((method) => (
              <TouchableOpacity
                key={method}
                style={[
                  styles.paymentOption,
                  selectedMethod === method && styles.paymentOptionActive,
                ]}
                onPress={() => setSelectedMethod(method)}
              >
                <View style={styles.paymentRow}>
                  <Text style={styles.paymentLabel}>{PAYMENT_LABELS[method]}</Text>
                  <View style={[
                    styles.radio,
                    selectedMethod === method && styles.radioActive,
                  ]} />
                </View>
                {selectedMethod === method && (
                  <Text style={styles.paymentInfo}>{PAYMENT_INFO[method]}</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>

          {/* Botón confirmar */}
          <TouchableOpacity
            style={[styles.confirmBtn, (!selectedMethod || loading) && styles.confirmBtnDisabled]}
            onPress={handleConfirm}
            disabled={loading || !selectedMethod}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.confirmBtnText}>
                Confirmar y Pagar • ${TOTAL_ADVANCE}
              </Text>
            )}
          </TouchableOpacity>
        </ScrollView>
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
  scrollContent: { paddingHorizontal: 22, paddingBottom: 40 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#17247a', marginBottom: 12 },
  deviceCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#d0d8ff',
  },
  deviceText: { fontSize: 15, fontWeight: '700', color: '#17247a', marginBottom: 4 },
  deviceSubtext: { fontSize: 13, color: '#5364ad', lineHeight: 20 },
  estimateNote: { fontSize: 12, color: '#9aa5cc', marginTop: 8 },
  faultSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eef2ff',
  },
  faultSummaryName: { fontSize: 13, color: '#17247a', fontWeight: '600' },
  faultSummaryTag: { fontSize: 11, color: '#5364ad', marginTop: 2 },
  faultSummaryPrice: { fontSize: 14, fontWeight: '700', color: '#5364ad', marginLeft: 8 },
  estimateTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1.5,
    borderTopColor: '#d0d8ff',
  },
  estimateTotalLabel: { fontSize: 14, fontWeight: '700', color: '#17247a' },
  estimateTotalValue: { fontSize: 18, fontWeight: '900', color: '#17247a' },
  breakdownCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#d0d8ff',
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  breakdownLabel: { fontSize: 14, color: '#5364ad' },
  breakdownValue: { fontSize: 14, fontWeight: '700', color: '#17247a' },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1.5,
    borderTopColor: '#d0d8ff',
  },
  totalLabel: { fontSize: 16, fontWeight: '700', color: '#17247a' },
  totalValue: { fontSize: 22, fontWeight: '900', color: '#17247a' },
  noteCard: {
    backgroundColor: '#fff8e1',
    borderRadius: 12,
    padding: 14,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#ffe082',
  },
  noteText: { fontSize: 12, color: '#7a6000', lineHeight: 18 },
  paymentOption: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: '#d0d8ff',
  },
  paymentOptionActive: { borderColor: '#17247a', backgroundColor: '#f0f3ff' },
  paymentRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  paymentLabel: { fontSize: 14, fontWeight: '600', color: '#17247a' },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#d0d8ff',
  },
  radioActive: { borderColor: '#17247a', backgroundColor: '#17247a' },
  paymentInfo: {
    marginTop: 10,
    fontSize: 12,
    color: '#5364ad',
    lineHeight: 18,
    borderTopWidth: 1,
    borderTopColor: '#eef2ff',
    paddingTop: 10,
  },
  confirmBtn: {
    backgroundColor: '#17247a',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 20,
  },
  confirmBtnDisabled: { backgroundColor: '#c0c0c0' },
  confirmBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
})