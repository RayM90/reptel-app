import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { Stack, useRouter, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { useCartStore } from '../../src/store/cart.store'
import { useConfirm } from '../../src/hooks/useConfirm'

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

export default function ProductDetailScreen() {
  const router = useRouter()
  const { product: productParam } = useLocalSearchParams<{ product: string }>()
  const { addItem, totalItems } = useCartStore()
  const [quantity, setQuantity] = useState(1)
  const confirmDialog = useConfirm()

  const product: Product = JSON.parse(productParam)

  const increase = () => {
    if (quantity < product.stock) setQuantity(quantity + 1)
  }

  const decrease = () => {
    if (quantity > 1) setQuantity(quantity - 1)
  }

  const handleAddToCart = async () => {
    for (let i = 0; i < quantity; i++) {
      addItem({
        id: product.id,
        name: product.name,
        price: Number(product.price),
        imageUrl: product.imageUrl,
        categoryName: product.category.name,
        requiresInstallation: product.requiresInstallation,
})

    }

    // A diferencia de otros casos, aquí sí hay dos opciones con resultado
    // distinto (seguir viendo vs. ir al carrito), por eso usamos confirmDialog
    // en vez de un simple toast.
    const irAlCarrito = await confirmDialog({
      title: '✓ Agregado',
      message: `${quantity} x ${product.name} se agregó al carrito`,
      confirmLabel: 'Ir al carrito',
      cancelLabel: 'Seguir viendo',
    })
    if (irAlCarrito) {
      router.push('/(client)/checkout')
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

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Imagen */}
          <View style={styles.imageContainer}>
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

          {/* Info */}
          <View style={styles.infoCard}>
            <Text style={styles.categoryTag}>{product.category.name}</Text>
            <Text style={styles.productName}>{product.name}</Text>

            <View style={styles.priceRow}>
              <Text style={styles.price}>${product.price}</Text>
              <Text style={[styles.stock, product.stock === 0 && styles.stockOut]}>
                {product.stock > 0 ? `${product.stock} disponibles` : 'Agotado'}
              </Text>
            </View>

            <View style={styles.divider} />

            <Text style={styles.sectionTitle}>Descripción</Text>
            <Text style={styles.description}>{product.description}</Text>

            {product.stock > 0 && (
              <>
                <View style={styles.divider} />
                <Text style={styles.sectionTitle}>Cantidad</Text>
                <View style={styles.quantityRow}>
                  <TouchableOpacity
                    style={styles.qtyBtn}
                    onPress={decrease}
                    disabled={quantity <= 1}
                  >
                    <Text style={styles.qtyBtnText}>−</Text>
                  </TouchableOpacity>
                  <Text style={styles.qtyValue}>{quantity}</Text>
                  <TouchableOpacity
                    style={styles.qtyBtn}
                    onPress={increase}
                    disabled={quantity >= product.stock}
                  >
                    <Text style={styles.qtyBtnText}>+</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>

          {/* Botón agregar */}
          <TouchableOpacity
            style={[styles.addBtn, product.stock === 0 && styles.addBtnDisabled]}
            disabled={product.stock === 0}
            onPress={handleAddToCart}
          >
            <Text style={styles.addBtnText}>
              {product.stock > 0
                ? `Agregar al carrito • $${(product.price * quantity).toFixed(2)}`
                : 'Agotado'}
            </Text>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backBtn: { padding: 4 },
  backText: { color: '#5364ad', fontSize: 14, fontWeight: '500' },
  cartBtn: { position: 'relative', padding: 8 },
  cartIcon: { fontSize: 26 },
  badge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: '#B3261E',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  scrollContent: { paddingHorizontal: 22, paddingBottom: 40 },
  imageContainer: {
    height: 220,
    backgroundColor: '#eef2ff',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 18,
    overflow: 'hidden',
  },
  productImage: { width: '100%', height: '100%' },
  imagePlaceholderText: { fontSize: 64 },
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 18,
    marginBottom: 18,
  },
  categoryTag: {
    fontSize: 11,
    color: '#5364ad',
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  productName: { fontSize: 20, fontWeight: '800', color: '#17247a', marginBottom: 12 },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  price: { fontSize: 26, fontWeight: '900', color: '#17247a' },
  stock: { fontSize: 13, color: '#1E7A3D', fontWeight: '700' },
  stockOut: { color: '#B3261E' },
  divider: { height: 1, backgroundColor: '#eef2ff', marginVertical: 16 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#17247a', marginBottom: 8 },
  description: { fontSize: 14, color: '#5364ad', lineHeight: 21 },
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  qtyBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#eef2ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  qtyBtnText: { fontSize: 22, fontWeight: '700', color: '#17247a' },
  qtyValue: { fontSize: 18, fontWeight: '800', color: '#17247a', minWidth: 30, textAlign: 'center' },
  addBtn: {
    backgroundColor: '#17247a',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  addBtnDisabled: { backgroundColor: '#c0c0c0' },
  addBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
})