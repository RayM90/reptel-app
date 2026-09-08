import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { Stack, useRouter, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { productOrdersAPI } from '../../src/services/api'
import { useAuthStore } from '../../src/store/auth.store'
import { useToastStore } from '../../src/store/toast.store'
import { useConfirm } from '../../src/hooks/useConfirm'
import { usePaymentInfo, formatPaymentInfo } from '../../src/hooks/usePaymentInfo'

const REVISION_COST = 15 // mismo valor que el backend (constants.ts), duplicada intencionalmente en frontend

type PaymentMethod = 'PAGO_MOVIL' | 'TRANSFERENCIA' | 'BINANCE'

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  PAGO_MOVIL: '📱 Pago Móvil',
  TRANSFERENCIA: '🏦 Transferencia Bancaria',
  BINANCE: '₿ Binance',
}

interface SelectedItem {
  productId: string
  name: string
  price: number
  quantity: number
}

export default function LinkCheckoutScreen() {
  const router = useRouter()
  const { orderId, orderNumber, budget, items: itemsParam } = useLocalSearchParams<{
    orderId: string
    orderNumber: string
    budget: string
    items: string
  }>()
  const items: SelectedItem[] = JSON.parse(itemsParam)
  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0)

  const budgetNumber = budget != null && budget !== 'null' ? Number(budget) : null
  const laborPending = budgetNumber != null ? Math.max(budgetNumber - REVISION_COST, 0) : null

  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null)
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [useOtherAddress, setUseOtherAddress] = useState(false)
  const [customAddress, setCustomAddress] = useState('')
  const showToast = useToastStore((state) => state.showToast)
  const confirmDialog = useConfirm()
  const { data: paymentSettings } = usePaymentInfo()
  const { user } = useAuthStore()

  const getDeliveryAddress = () => {
    if (useOtherAddress) return customAddress.trim()
    return user?.address?.trim() || ''
  }

  const handleConfirm = async () => {
    if (!selectedMethod) {
      showToast('Selecciona un método de pago para continuar', 'error')
      return
    }

    const address = getDeliveryAddress()
    if (!address) {
      showToast(
        useOtherAddress
          ? 'Escribe la dirección donde quieres recibir tu repuesto'
          : 'No tienes una dirección registrada. Activa "usar otra dirección" para escribir una.',
        'error'
      )
      return
    }

    const confirmed = await confirmDialog({
      title: 'Confirmar compra',
      message: `Total: $${total.toFixed(2)}\nMétodo: ${PAYMENT_LABELS[selectedMethod]}\n\nEl motorizado te traerá el repuesto a la dirección indicada. ¿Confirmas?`,
      confirmLabel: 'Confirmar',
    })
    if (!confirmed) return

    submitOrder(address)
  }

  const submitOrder = async (address: string) => {
    if (!selectedMethod) return
    setLoading(true)
    try {
      const response = await productOrdersAPI.createLinked({
        items: items.map((item) => ({ productId: item.productId, quantity: item.quantity })),
        paymentMethod: selectedMethod,
        linkedOrderId: orderId,
        address,
        notes: notes.trim() || undefined,
      })

      const createdOrder = response.data.data

      // El Alert original solo tenía un botón OK que navegaba — mostramos el
      // toast de éxito y navegamos directo, sin pedir un toque de más.
      showToast(
        '✅ Pedido de repuesto registrado. Ahora ingresa los datos de tu pago.',
        'success'
      )
      router.replace({
        pathname: '/(client)/upload-receipt',
        params: { orderId: createdOrder.id, paymentMethod: selectedMethod, total: String(total) },
      })
    } catch (error: any) {
      const backendMessage = error?.response?.data?.message
      showToast(
        backendMessage || 'Ocurrió un error al procesar tu pedido. Intenta de nuevo.',
        'error'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
      <LinearGradient colors={['#ffffff', '#eef2ff', '#d5ddff', '#8fa5ff']} style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backText}>← Atrás</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Confirmar Repuesto</Text>
          <Text style={styles.subtitle}>Para la orden {orderNumber}</Text>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📍 Dirección de entrega</Text>
            <View style={styles.addressCard}>
              <Text style={styles.addressName}>{user?.name || 'Cliente'}</Text>
              <Text style={styles.addressText}>
                {user?.address || 'Sin dirección registrada'}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.toggleAddressBtn}
              onPress={() => setUseOtherAddress((prev) => !prev)}
            >
              <Text style={styles.toggleAddressText}>
                {useOtherAddress ? '✕ Cancelar otra dirección' : '✎ Usar otra dirección'}
              </Text>
            </TouchableOpacity>

            {useOtherAddress && (
              <TextInput
                style={styles.notesInput}
                placeholder="Escribe la dirección de entrega para este pedido"
                placeholderTextColor="#9aa5cc"
                value={customAddress}
                onChangeText={setCustomAddress}
                multiline
              />
            )}
          </View>

          {budgetNumber != null && laborPending != null && (
            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>📋 Resumen de tu reparación</Text>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Mano de obra / diagnóstico</Text>
                <Text style={styles.summaryValue}>${budgetNumber.toFixed(2)}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Ya pagado (anticipo de revisión)</Text>
                <Text style={styles.summaryValueNegative}>-${REVISION_COST.toFixed(2)}</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabelBold}>Pendiente al finalizar la reparación</Text>
                <Text style={styles.summaryValueBold}>${laborPending.toFixed(2)}</Text>
              </View>
            </View>
          )}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🔧 Repuesto que compras ahora</Text>
            {items.map((item) => (
              <View key={item.productId} style={styles.itemRow}>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.itemUnitPrice}>${item.price.toFixed(2)} c/u × {item.quantity}</Text>
                </View>
                <Text style={styles.itemPrice}>${(item.price * item.quantity).toFixed(2)}</Text>
              </View>
            ))}
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total a pagar ahora</Text>
              <Text style={styles.totalValue}>${total.toFixed(2)}</Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>💳 Método de pago</Text>
            {(Object.keys(PAYMENT_LABELS) as PaymentMethod[]).map((method) => (
              <TouchableOpacity
                key={method}
                style={[styles.paymentOption, selectedMethod === method && styles.paymentOptionActive]}
                onPress={() => setSelectedMethod(method)}
              >
                <View style={styles.paymentRow}>
                  <Text style={styles.paymentLabel}>{PAYMENT_LABELS[method]}</Text>
                  <View style={[styles.radio, selectedMethod === method && styles.radioActive]} />
                </View>
                {selectedMethod === method && paymentSettings && (
                  <Text style={styles.paymentInfo}>{formatPaymentInfo(paymentSettings, method)}</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📝 Notas (opcional)</Text>
            <TextInput
              style={styles.notesInput}
              placeholder="Notas para el técnico..."
              placeholderTextColor="#9aa5cc"
              value={notes}
              onChangeText={setNotes}
              multiline
            />
          </View>

          <TouchableOpacity
            style={[styles.confirmBtn, (!selectedMethod || loading) && styles.confirmBtnDisabled]}
            onPress={handleConfirm}
            disabled={loading || !selectedMethod}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.confirmBtnText}>Confirmar • ${total.toFixed(2)}</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </LinearGradient>
      </KeyboardAvoidingView>
    </>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingTop: 60, paddingHorizontal: 22, paddingBottom: 16 },
  backBtn: { marginBottom: 8 },
  backText: { color: '#5364ad', fontSize: 14, fontWeight: '500' },
  title: { fontSize: 26, fontWeight: '800', color: '#17247a', marginBottom: 2 },
  subtitle: { fontSize: 14, color: '#5364ad' },
  scrollContent: { paddingHorizontal: 22, paddingBottom: 40 },
  addressCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#d0d8ff',
  },
  addressName: { fontSize: 15, fontWeight: '700', color: '#17247a', marginBottom: 4 },
  addressText: { fontSize: 13, color: '#5364ad', lineHeight: 20 },
  toggleAddressBtn: { marginTop: 10, alignSelf: 'flex-start' },
  toggleAddressText: { color: '#5364ad', fontSize: 13, fontWeight: '600' },
  summaryCard: {
    backgroundColor: '#f0f3ff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1.5,
    borderColor: '#d0d8ff',
  },
  summaryTitle: { fontSize: 14, fontWeight: '800', color: '#17247a', marginBottom: 12 },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryLabel: { fontSize: 12, color: '#5364ad' },
  summaryValue: { fontSize: 13, fontWeight: '700', color: '#17247a' },
  summaryValueNegative: { fontSize: 13, fontWeight: '700', color: '#15803d' },
  summaryDivider: {
    height: 1,
    backgroundColor: '#d0d8ff',
    marginVertical: 8,
  },
  summaryLabelBold: { fontSize: 13, fontWeight: '700', color: '#17247a', flex: 1, marginRight: 8 },
  summaryValueBold: { fontSize: 15, fontWeight: '900', color: '#17247a' },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#17247a', marginBottom: 12 },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#eef2ff',
  },
  itemInfo: { flex: 1, marginRight: 12 },
  itemName: { fontSize: 13, fontWeight: '700', color: '#17247a' },
  itemUnitPrice: { fontSize: 11, color: '#9aa5cc', marginTop: 2 },
  itemPrice: { fontSize: 14, fontWeight: '800', color: '#17247a' },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1.5,
    borderTopColor: '#d0d8ff',
  },
  totalLabel: { fontSize: 16, fontWeight: '700', color: '#17247a' },
  totalValue: { fontSize: 22, fontWeight: '900', color: '#17247a' },
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
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#d0d8ff' },
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
  notesInput: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#d0d8ff',
    fontSize: 13,
    color: '#17247a',
    minHeight: 60,
    textAlignVertical: 'top',
  },
  confirmBtn: { backgroundColor: '#17247a', borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginBottom: 20 },
  confirmBtnDisabled: { backgroundColor: '#c0c0c0' },
  confirmBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
})