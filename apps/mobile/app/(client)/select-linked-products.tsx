import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { Stack, useRouter, useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import { api } from '../../src/services/api'

interface Product {
  id: string
  name: string
  description: string
  price: number
  stock: number
  imageUrl: string | null
  requiresInstallation: boolean
  category: { id: string; name: string }
}

interface SelectedItem {
  productId: string
  name: string
  price: number
  quantity: number
}

export default function SelectLinkedProductsScreen() {
  const router = useRouter()
  const { orderId, orderNumber } = useLocalSearchParams<{ orderId: string; orderNumber: string }>()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Record<string, number>>({})

  useEffect(() => {
    fetchProducts()
  }, [])

  const fetchProducts = async () => {
    try {
      const response = await api.get('/api/products')
      const data: Product[] = response.data.data
      setProducts(data.filter((p) => p.requiresInstallation))
    } catch (error) {
      Alert.alert('Error', 'No se pudieron cargar los repuestos disponibles')
    } finally {
      setLoading(false)
    }
  }

  const toggleSelect = (product: Product) => {
    setSelected((prev) => {
      const next = { ...prev }
      if (next[product.id]) {
        delete next[product.id]
      } else {
        next[product.id] = 1
      }
      return next
    })
  }

  const changeQuantity = (product: Product, delta: number) => {
    setSelected((prev) => {
      const current = prev[product.id] || 1
      const updated = Math.min(product.stock, Math.max(1, current + delta))
      return { ...prev, [product.id]: updated }
    })
  }

  const selectedItems: SelectedItem[] = Object.entries(selected).map(([productId, quantity]) => {
    const product = products.find((p) => p.id === productId)!
    return { productId, name: product.name, price: Number(product.price), quantity }
  })

  const total = selectedItems.reduce((sum, item) => sum + item.price * item.quantity, 0)

  const handleContinue = () => {
    if (selectedItems.length === 0) {
      Alert.alert('Selecciona al menos un repuesto', 'Debes elegir al menos un producto para continuar')
      return
    }
    router.push({
      pathname: '/(client)/link-checkout',
      params: {
        orderId,
        orderNumber,
        items: JSON.stringify(selectedItems),
      },
    })
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <LinearGradient colors={['#ffffff', '#eef2ff', '#d5ddff', '#8fa5ff']} style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backText}>← Mis Órdenes</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Comprar Repuesto</Text>
          <Text style={styles.subtitle}>Para la orden {orderNumber}</Text>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color="#17247a" style={{ marginTop: 60 }} />
        ) : products.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📦</Text>
            <Text style={styles.emptyTitle}>No hay repuestos disponibles</Text>
            <Text style={styles.emptySubtitle}>Por ahora no hay productos habilitados para instalación</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {products.map((product) => {
              const isSelected = !!selected[product.id]
              const qty = selected[product.id] || 1

              return (
                <View key={product.id} style={[styles.card, isSelected && styles.cardActive]}>
                  <TouchableOpacity
                    style={styles.cardMain}
                    activeOpacity={0.85}
                    onPress={() => toggleSelect(product)}
                  >
                    <View style={styles.imagePlaceholder}>
                      <Text style={styles.imagePlaceholderText}>📦</Text>
                    </View>
                    <View style={styles.cardInfo}>
                      <Text style={styles.productName} numberOfLines={2}>{product.name}</Text>
                      <Text style={styles.productPrice}>${Number(product.price).toFixed(2)}</Text>
                      <Text style={styles.productStock}>
                        {product.stock > 0 ? `${product.stock} disp.` : 'Agotado'}
                      </Text>
                    </View>
                    <View style={[styles.checkbox, isSelected && styles.checkboxActive]}>
                      {isSelected && <Text style={styles.checkboxCheck}>✓</Text>}
                    </View>
                  </TouchableOpacity>

                  {isSelected && (
                    <View style={styles.qtyRow}>
                      <Text style={styles.qtyLabel}>Cantidad</Text>
                      <View style={styles.qtyControls}>
                        <TouchableOpacity style={styles.qtyBtn} onPress={() => changeQuantity(product, -1)}>
                          <Text style={styles.qtyBtnText}>−</Text>
                        </TouchableOpacity>
                        <Text style={styles.qtyValue}>{qty}</Text>
                        <TouchableOpacity style={styles.qtyBtn} onPress={() => changeQuantity(product, 1)}>
                          <Text style={styles.qtyBtnText}>+</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>
              )
            })}

            {selectedItems.length > 0 && (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total</Text>
                <Text style={styles.totalValue}>${total.toFixed(2)}</Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.continueBtn, selectedItems.length === 0 && styles.continueBtnDisabled]}
              disabled={selectedItems.length === 0}
              onPress={handleContinue}
            >
              <Text style={styles.continueBtnText}>Continuar al pago →</Text>
            </TouchableOpacity>
          </ScrollView>
        )}
      </LinearGradient>
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
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyIcon: { fontSize: 64, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: '#17247a', marginBottom: 8, textAlign: 'center' },
  emptySubtitle: { fontSize: 13, color: '#5364ad', textAlign: 'center' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: '#eef2ff',
    overflow: 'hidden',
  },
  cardActive: { borderColor: '#17247a' },
  cardMain: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 12 },
  imagePlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 10,
    backgroundColor: '#eef2ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imagePlaceholderText: { fontSize: 24 },
  cardInfo: { flex: 1 },
  productName: { fontSize: 13, fontWeight: '700', color: '#17247a' },
  productPrice: { fontSize: 14, fontWeight: '800', color: '#17247a', marginTop: 2 },
  productStock: { fontSize: 11, color: '#9aa5cc', marginTop: 2 },
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
  qtyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 12,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#eef2ff',
  },
  qtyLabel: { fontSize: 12, color: '#5364ad', fontWeight: '600' },
  qtyControls: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  qtyBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#eef2ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  qtyBtnText: { fontSize: 16, fontWeight: '700', color: '#17247a' },
  qtyValue: { fontSize: 14, fontWeight: '800', color: '#17247a', minWidth: 20, textAlign: 'center' },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
    paddingTop: 12,
    borderTopWidth: 1.5,
    borderTopColor: '#d0d8ff',
  },
  totalLabel: { fontSize: 16, fontWeight: '700', color: '#17247a' },
  totalValue: { fontSize: 22, fontWeight: '900', color: '#17247a' },
  continueBtn: { backgroundColor: '#17247a', borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  continueBtnDisabled: { backgroundColor: '#c0c0c0' },
  continueBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
})