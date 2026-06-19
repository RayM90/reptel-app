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
import { Stack, useRouter } from 'expo-router'
import { useState } from 'react'
import { useCartStore } from '../../src/store/cart.store'
import { useAuthStore } from '../../src/store/auth.store'

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

  const handleDecrease = (id: string, quantity: number) => {
    if (quantity === 1) {
      Alert.alert(
        'Eliminar producto',
        '¿Deseas quitar este producto del carrito?',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Eliminar', style: 'destructive', onPress: () => removeItem(id) },
        ]
      )
    } else {
      updateQuantity(id, quantity - 1)
    }
  }

  const handleIncrease = (id: string, quantity: number) => {
    updateQuantity(id, quantity + 1)
  }

  const handleConfirmOrder = async () => {
    if (!selectedMethod) {
      Alert.alert('Método de pago', 'Selecciona un método de pago para continuar')
      return
    }
    Alert.alert(
      'Confirmar pedido',
      `Total: $${totalPrice.toFixed(2)}\nMétodo: ${PAYMENT_LABELS[selectedMethod]}\n\n¿Confirmas el pedido?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: () => {
            // TODO Fase 3: crear orden en backend + subir comprobante a S3
            Alert.alert(
              '✅ Pedido registrado',
              'Tu pedido fue registrado. Realiza el pago y sube el comprobante.',
              [{ text: 'OK', onPress: () => { clearCart(); router.replace('/(client)/home-client') } }]
            )
          },
        },
      ]
    )
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
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>${totalPrice.toFixed(2)}</Text>
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

          {/* Nota comprobante */}
          {selectedMethod && (
            <View style={styles.noteCard}>
              <Text style={styles.noteText}>
                📎 Después de confirmar, deberás subir el comprobante de pago para procesar tu pedido.
              </Text>
            </View>
          )}

          {/* Botón confirmar */}
          <TouchableOpacity
            style={[styles.confirmBtn, !selectedMethod && styles.confirmBtnDisabled]}
            onPress={handleConfirmOrder}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.confirmBtnText}>
                Confirmar Pedido • ${totalPrice.toFixed(2)}
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