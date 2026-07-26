import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Image,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { Stack, useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { api } from '../../src/services/api'
import { useCartStore } from '../../src/store/cart.store'
import { useToastStore } from '../../src/store/toast.store'
import { colors } from '../../src/theme/colors'

interface Product {
  id: string
  name: string
  description: string
  price: number
  stock: number
  imageUrl: string | null
  category: { id: string; name: string }
  requiresInstallation: boolean
}


const productImages: Record<string, any> = {
  'products/cargador-usbc.jpg': require('../../assets/images/products/cargador-usbc.jpg'),
}

export default function StoreScreen() {
  const router = useRouter()
  const { addItem, totalItems } = useCartStore()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos')
  const [categories, setCategories] = useState<string[]>(['Todos'])
  const showToast = useToastStore((state) => state.showToast)

  useEffect(() => {
    fetchProducts()
  }, [])

  const fetchProducts = async () => {
    setError(false)
    try {
      const response = await api.get('/api/products')
      const data: Product[] = response.data.data
      setProducts(data)
      const cats = ['Todos', ...new Set(data.map((p) => p.category.name))]
      setCategories(cats)
    } catch (error: any) {
      setError(true)
      showToast('No se pudieron cargar los productos', 'error')
    } finally {
      setLoading(false)
    }
  }

const handleAddToCart = (product: Product) => {
  addItem({
    id: product.id,
    name: product.name,
    price: Number(product.price),
    imageUrl: product.imageUrl,
    categoryName: product.category.name,
    requiresInstallation: product.requiresInstallation,
  })
    showToast(`✓ ${product.name} se agregó al carrito`, 'success')
  }

  const filtered =
    selectedCategory === 'Todos'
      ? products
      : products.filter((p) => p.category.name === selectedCategory)

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
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.title}>Tienda RepTel</Text>
              <Text style={styles.subtitle}>Accesorios y repuestos</Text>
            </View>
            <TouchableOpacity
              style={styles.cartBtn}
              onPress={() => router.push('/(client)/checkout')}
            >
              <Text style={styles.cartIcon}>🛒</Text>
              {totalItems > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{totalItems}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Categorías */}
        <View style={styles.categoryHeaderRow}>
          <Text style={styles.categoryTitleText}>Categorías</Text>
          <Text style={styles.scrollHint}>desliza »</Text>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterScroll}
          contentContainerStyle={styles.filterContainer}
        >
          {categories.map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[
                styles.filterBtn,
                selectedCategory === cat && styles.filterBtnActive,
              ]}
              onPress={() => setSelectedCategory(cat)}
            >
              <Text
                style={[
                  styles.filterText,
                  selectedCategory === cat && styles.filterTextActive,
                ]}
              >
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Productos */}
        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 60 }} />
        ) : error ? (
          <View style={{ alignItems: 'center', marginTop: 60, paddingHorizontal: 24 }}>
            <Text style={styles.emptyText}>No se pudo conectar con la tienda</Text>
            <TouchableOpacity
              style={[styles.card, { marginTop: 16, paddingHorizontal: 20, paddingVertical: 10 }]}
              onPress={fetchProducts}
            >
              <Text>↻ Reintentar</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.productList}
            showsVerticalScrollIndicator={false}
          >
            {filtered.length === 0 ? (
              <Text style={styles.emptyText}>No hay productos disponibles</Text>
            ) : (
              <View style={styles.grid}>
                {filtered.map((product) => (
                  <TouchableOpacity
                    key={product.id}
                    style={styles.card}
                    activeOpacity={0.85}
                    onPress={() =>
                      router.push({
                        pathname: '/(client)/product-detail',
                        params: { product: JSON.stringify(product) },
                      })
                    }
                  >
                    <View style={styles.imagePlaceholder}>
                      {product.imageUrl && productImages[product.imageUrl] ? (
                        <Image
                          source={productImages[product.imageUrl]}
                          style={styles.productImage}
                          resizeMode="cover"
                        />
                      ) : (
                        <Text style={styles.imagePlaceholderText}>📦</Text>
                      )}
                    </View>

                    <View style={styles.cardBody}>
                      <Text style={styles.categoryTag}>{product.category.name}</Text>
                      <Text style={styles.productName} numberOfLines={2}>
                        {product.name}
                      </Text>
                      <Text style={styles.productDesc} numberOfLines={2}>
                        {product.description}
                      </Text>
                      <View style={styles.cardFooter}>
                        <Text style={styles.price}>${product.price}</Text>
                        <Text style={styles.stock}>
                          {product.stock > 0 ? `${product.stock} disp.` : 'Agotado'}
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={[
                          styles.buyBtn,
                          product.stock === 0 && styles.buyBtnDisabled,
                        ]}
                        disabled={product.stock === 0}
                        onPress={(e) => {
                          e.stopPropagation()
                          handleAddToCart(product)
                        }}
                      >
                        <Text style={styles.buyBtnText}>
                          {product.stock > 0 ? 'Agregar al carrito' : 'Agotado'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
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
  backText: { color: colors.secondary, fontSize: 14, fontWeight: '500' },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: { fontSize: 26, fontWeight: '800', color: colors.primary, marginBottom: 2 },
  subtitle: { fontSize: 14, color: colors.textMuted },
  cartBtn: {
    position: 'relative',
    padding: 8,
  },
  cartIcon: { fontSize: 28 },
  badge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: colors.danger,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: { color: colors.onPrimary, fontSize: 11, fontWeight: '800' },
  categoryHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 22,
    marginBottom: 8,
  },
  categoryTitleText: { fontSize: 13, color: colors.primary, fontWeight: '700' },
  scrollHint: { fontSize: 11, color: colors.textMuted, fontWeight: '500' },
  filterScroll: { maxHeight: 50, minHeight: 50, marginBottom: 10 },
  filterContainer: {
    paddingHorizontal: 22,
    gap: 10,
    alignItems: 'center',
    flexDirection: 'row',
  },
  filterBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  filterBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterText: { fontSize: 13, color: colors.secondary, fontWeight: '600', textAlign: 'center', flexShrink: 0 },
  filterTextActive: { color: colors.onPrimary },
  productList: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 40 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 14,
  },
  card: {
    width: '47%',
    backgroundColor: colors.surface,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  imagePlaceholder: {
    height: 100,
    backgroundColor: colors.backgroundAlt,
    justifyContent: 'center',
    alignItems: 'center',
  },
  productImage: { width: '100%', height: '100%' },
  imagePlaceholderText: { fontSize: 40 },
  cardBody: { padding: 12 },
  categoryTag: {
    fontSize: 10,
    color: colors.textMuted,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  productName: { fontSize: 13, fontWeight: '700', color: colors.primary, marginBottom: 4 },
  productDesc: { fontSize: 11, color: colors.textMuted, lineHeight: 15, marginBottom: 8 },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  price: { fontSize: 16, fontWeight: '800', color: colors.primary },
  stock: { fontSize: 11, color: colors.success, fontWeight: '600' },
  buyBtn: { backgroundColor: colors.primary, borderRadius: 10, paddingVertical: 8, alignItems: 'center' },
  buyBtnDisabled: { backgroundColor: colors.textMuted },
  buyBtnText: { color: colors.onPrimary, fontSize: 11, fontWeight: '700' },
  emptyText: { textAlign: 'center', color: colors.textMuted, marginTop: 60, fontSize: 15 },
})