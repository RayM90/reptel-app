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
import { useState } from 'react'
import { useCartStore } from '../../src/store/cart.store'
import { useAuthStore } from '../../src/store/auth.store'
import { productOrdersAPI } from '../../src/services/api'
import { useToastStore } from '../../src/store/toast.store'
import { useConfirm } from '../../src/hooks/useConfirm'

// Mismos montos fijos que el backend (server/src/config/constants.ts).
// Prototipo de tesis, no configurables todavía.
const INSTALLATION_COST = 15
// Costo de delivery cobrado al cliente en TODOS los pedidos de tienda
// (server/src/config/constants.ts -> DELIVERY_COST).
const DELIVERY_COST = 5

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

export default function CheckoutScreen() {
  const router = useRouter()
  const { items, totalItems, totalPrice, clearCart, updateQuantity, removeItem } = useCartStore()
  const { user } = useAuthStore()
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null)
  const [loading, setLoading] = useState(false)
  const [useOtherAddress, setUseOtherAddress] = useState(false)
  const [customAddress, setCustomAddress] = useState('')
  const [notes, setNotes] = useState('')
  const [wantsInstallation, setWantsInstallation] = useState(false)
  const showToast = useToastStore((state) => state.showToast)
  const confirmDialog = useConfirm()

  if (items.length === 0) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <LinearGradient
          colors={['#ffffff', '#eef2ff', '#d5ddff', '#8fa5ff']}
          style={styles.container}
        >
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>🛒</Text>
            <Text style={styles.emptyTitle}>Tu carrito está vacío</Text>
            <Text style={styles.emptySubtitle}>Agrega productos desde la tienda</Text>
            <TouchableOpacity
              style={styles.backToStoreBtn}
              onPress={() => router.back()}
            >
              <Text style={styles.backToStoreBtnText}>Ir a la Tienda</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </>
    )
  }

  const hasInstallableItem = items.some((item) => item.requiresInstallation)
  const installationCost = wantsInstallation ? INSTALLATION_COST : 0
  const finalTotal = totalPrice + installationCost + DELIVERY_COST

  const handleDecrease = async (id: string, quantity: number) => {
    if (quantity === 1) {
      const confirmed = await confirmDialog({
        title: 'Eliminar producto',
        message: '¿Deseas quitar este producto del carrito?',
        confirmLabel: 'Eliminar',
      })
      if (confirmed) removeItem(id)
    } else {
      updateQuantity(id, quantity - 1)
    }
  }

  const handleIncrease = (id: string, quantity: number) => {
    updateQuantity(id, quantity + 1)
  }

  const getDeliveryAddress = () => {
    if (useOtherAddress) return customAddress.trim()
    return user?.address?.trim() || ''
  }

  const handleConfirmOrder = async () => {
    if (!selectedMethod) {
      showToast('Selecciona un método de pago para continuar', 'error')
      return
    }

    const address = getDeliveryAddress()
    if (!address) {
      showToast(
        useOtherAddress
          ? 'Escribe la dirección donde quieres recibir tu pedido'
          : 'No tienes una dirección registrada. Activa "usar otra dirección" para escribir una.',
        'error'
      )
      return
    }

    const confirmed = await confirmDialog({
      title: 'Confirmar pedido',
      message: `Total: $${finalTotal.toFixed(2)}\nMétodo: ${PAYMENT_LABELS[selectedMethod]}\n\n¿Confirmas el pedido?`,
      confirmLabel: 'Confirmar',
    })
    if (!confirmed) return

    submitOrder(address)
  }

  const submitOrder = async (address: string) => {
    if (!selectedMethod) return
    setLoading(true)
    try {
      const response = await productOrdersAPI.create({
        items: items.map((item) => ({
          productId: item.id,
          quantity: item.quantity,
        })),
        paymentMethod: selectedMethod,
        address,
        notes: notes.trim() || undefined,
        requiresInstallation: wantsInstallation,
      })

      const createdOrder = response.data.data
      clearCart()

      // El Alert original solo tenía un botón OK que navegaba — mostramos el
      // toast de éxito y navegamos directo, sin pedir un toque de más.
      showToast('✅ Pedido registrado. Ahora ingresa los datos de tu pago.', 'success')
      router.replace({
        pathname: '/(client)/upload-receipt',
        params: { orderId: createdOrder.id, paymentMethod: selectedMethod, total: String(finalTotal) },
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
      <LinearGradient
        colors={['#ffffff', '#eef2ff', '#d5ddff', '#8fa5ff']}
        style={styles.container}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backText}>← Tienda</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Confirmar Pedido</Text>
          <Text style={styles.subtitle}>{totalItems} producto(s)</Text>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Dirección de entrega */}
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
                style={styles.addressInput}
                placeholder="Escribe la dirección de entrega para este pedido"
                placeholderTextColor="#9aa5cc"
                value={customAddress}
                onChangeText={setCustomAddress}
                multiline
              />
            )}
          </View>

          {/* Resumen de productos */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📦 Resumen del pedido</Text>
            {items.map((item) => (
              <View key={item.id} style={styles.itemRow}>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.itemCategory}>{item.categoryName}</Text>
                  <Text style={styles.itemUnitPrice}>${item.price.toFixed(2)} c/u</Text>
                </View>

                <View style={styles.itemRightCol}>
                  <View style={styles.qtyControls}>
                    <TouchableOpacity
                      style={styles.qtyBtnSmall}
                      onPress={() => handleDecrease(item.id, item.quantity)}
                    >
                      <Text style={styles.qtyBtnSmallText}>−</Text>
                    </TouchableOpacity>
                    <Text style={styles.qtyValueSmall}>{item.quantity}</Text>
                    <TouchableOpacity
                      style={styles.qtyBtnSmall}
                      onPress={() => handleIncrease(item.id, item.quantity)}
                    >
                      <Text style={styles.qtyBtnSmallText}>+</Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.itemPrice}>
                    ${(item.price * item.quantity).toFixed(2)}
                  </Text>
                </View>
              </View>
            ))}

            {hasInstallableItem && (
              <TouchableOpacity
                style={styles.installationCard}
                onPress={() => setWantsInstallation((prev) => !prev)}
                activeOpacity={0.85}
              >
                <View style={styles.installationRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.installationTitle}>🔧 ¿Requieres instalación?</Text>
                    <Text style={styles.installationSubtitle}>
                      El técnico-delivery que entrega tu producto lo instala ahí mismo (+${INSTALLATION_COST.toFixed(2)})
                    </Text>
                  </View>
                  <View style={[styles.checkbox, wantsInstallation && styles.checkboxActive]}>
                    {wantsInstallation && <Text style={styles.checkboxCheck}>✓</Text>}
                  </View>
                </View>
              </TouchableOpacity>
            )}

            <View style={styles.installationCostRow}>
              <Text style={styles.installationCostLabel}>Subtotal</Text>
              <Text style={styles.installationCostValue}>${totalPrice.toFixed(2)}</Text>
            </View>

            {wantsInstallation && (
              <View style={styles.installationCostRow}>
                <Text style={styles.installationCostLabel}>Instalación</Text>
                <Text style={styles.installationCostValue}>+${INSTALLATION_COST.toFixed(2)}</Text>
              </View>
            )}

            <View style={styles.installationCostRow}>
              <Text style={styles.installationCostLabel}>Costo de delivery</Text>
              <Text style={styles.installationCostValue}>+${DELIVERY_COST.toFixed(2)}</Text>
            </View>

            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>${finalTotal.toFixed(2)}</Text>
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

          {/* Notas del pedido */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📝 Notas (opcional)</Text>
            <TextInput
              style={styles.notesInput}
              placeholder="Ej: dejar el pedido con el conserje, llamar antes de entregar..."
              placeholderTextColor="#9aa5cc"
              value={notes}
              onChangeText={setNotes}
              multiline
            />
          </View>

          {/* Nota datos de pago */}
          {selectedMethod && (
            <View style={styles.noteCard}>
              <Text style={styles.noteText}>
                📎 Después de confirmar, deberás ingresar los datos de tu pago para procesar tu pedido.
              </Text>
            </View>
          )}

          {/* Botón confirmar */}
          <TouchableOpacity
            style={[styles.confirmBtn, (!selectedMethod || loading) && styles.confirmBtnDisabled]}
            onPress={handleConfirmOrder}
            disabled={loading || !selectedMethod}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.confirmBtnText}>
                Confirmar Pedido • ${finalTotal.toFixed(2)}
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
  addressInput: {
    marginTop: 10,
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
  itemCategory: { fontSize: 11, color: '#5364ad', marginTop: 2 },
  itemUnitPrice: { fontSize: 11, color: '#9aa5cc', marginTop: 2 },
  itemRightCol: { alignItems: 'flex-end', gap: 8 },
  qtyControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  qtyBtnSmall: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: '#eef2ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  qtyBtnSmallText: { fontSize: 16, fontWeight: '700', color: '#17247a' },
  qtyValueSmall: { fontSize: 13, fontWeight: '800', color: '#17247a', minWidth: 18, textAlign: 'center' },
  itemQty: { fontSize: 11, color: '#5364ad' },
  itemPrice: { fontSize: 14, fontWeight: '800', color: '#17247a' },
  installationCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginTop: 4,
    marginBottom: 4,
    borderWidth: 1.5,
    borderColor: '#d0d8ff',
  },
  installationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  installationTitle: { fontSize: 13, fontWeight: '700', color: '#17247a', marginBottom: 2 },
  installationSubtitle: { fontSize: 11, color: '#5364ad', lineHeight: 15 },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#d0d8ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxActive: { backgroundColor: '#17247a', borderColor: '#17247a' },
  checkboxCheck: { color: '#fff', fontSize: 14, fontWeight: '800' },
  installationCostRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginBottom: 4,
  },
  installationCostLabel: { fontSize: 13, color: '#5364ad', fontWeight: '600' },
  installationCostValue: { fontSize: 13, color: '#17247a', fontWeight: '700' },
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
  noteCard: {
    backgroundColor: '#fff8e1',
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#ffe082',
  },
  noteText: { fontSize: 13, color: '#7a6000', lineHeight: 20 },
  confirmBtn: {
    backgroundColor: '#17247a',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 20,
  },
  confirmBtnDisabled: { backgroundColor: '#c0c0c0' },
  confirmBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyIcon: { fontSize: 64, marginBottom: 16 },
  emptyTitle: { fontSize: 22, fontWeight: '800', color: '#17247a', marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: '#5364ad', marginBottom: 24 },
  backToStoreBtn: { backgroundColor: '#17247a', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 32 },
  backToStoreBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
})