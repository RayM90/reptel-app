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
import { Stack, useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { api } from '../../src/services/api'
import { useCartStore } from '../../src/store/cart.store'

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
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos')
  const [categories, setCategories] = useState<string[]>(['Todos'])

  useEffect(() => {
    fetchProducts()
  }, [])

  const fetchProducts = async () => {
    try {
      const response = await api.get('/api/products')
      const data: Product[] = response.data.data
      setProducts(data)
      const cats = ['Todos', ...new Set(data.map((p) => p.category.name))]
      setCategories(cats)
    } catch (error: any) {
      Alert.alert('Error', 'No se pudieron cargar los productos')
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
    Alert.alert('✓ Agregado', `${product.name} se agregó al carrito`)
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
          <ActivityIndicator size="large" color="#17247a" style={{ marginTop: 60 }} />
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
  backText: { color: '#5364ad', fontSize: 14, fontWeight: '500' },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: { fontSize: 26, fontWeight: '800', color: '#17247a', marginBottom: 2 },
  subtitle: { fontSize: 14, color: '#5364ad' },
  cartBtn: {
    position: 'relative',
    padding: 8,
  },
  cartIcon: { fontSize: 28 },
  badge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: '#e63946',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  categoryHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 22,
    marginBottom: 8,
  },
  categoryTitleText: { fontSize: 13, color: '#17247a', fontWeight: '700' },
  scrollHint: { fontSize: 11, color: '#5364ad', fontWeight: '500' },
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
    borderColor: '#d0d8ff',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  filterBtnActive: { backgroundColor: '#17247a', borderColor: '#17247a' },
  filterText: { fontSize: 13, color: '#5364ad', fontWeight: '600', textAlign: 'center', flexShrink: 0 },
  filterTextActive: { color: '#ffffff' },
  productList: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 40 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 14,
  },
  card: {
    width: '47%',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#17247a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  imagePlaceholder: {
    height: 100,
    backgroundColor: '#eef2ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  productImage: { width: '100%', height: '100%' },
  imagePlaceholderText: { fontSize: 40 },
  cardBody: { padding: 12 },
  categoryTag: {
    fontSize: 10,
    color: '#5364ad',
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  productName: { fontSize: 13, fontWeight: '700', color: '#17247a', marginBottom: 4 },
  productDesc: { fontSize: 11, color: '#5364ad', lineHeight: 15, marginBottom: 8 },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  price: { fontSize: 16, fontWeight: '800', color: '#17247a' },
  stock: { fontSize: 11, color: '#4ade80', fontWeight: '600' },
  buyBtn: { backgroundColor: '#17247a', borderRadius: 10, paddingVertical: 8, alignItems: 'center' },
  buyBtnDisabled: { backgroundColor: '#c0c0c0' },
  buyBtnText: { color: '#ffffff', fontSize: 11, fontWeight: '700' },
  emptyText: { textAlign: 'center', color: '#5364ad', marginTop: 60, fontSize: 15 },
})