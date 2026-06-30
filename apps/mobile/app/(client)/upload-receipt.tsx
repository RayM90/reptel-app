import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { Stack, useRouter, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import * as ImagePicker from 'expo-image-picker'
import { productOrdersAPI } from '../../src/services/api'

export default function UploadReceiptScreen() {
  const router = useRouter()
  const { orderId } = useLocalSearchParams<{ orderId: string }>()
  const [imageUri, setImageUri] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const requestPermissionAndPick = async (fromCamera: boolean) => {
    if (fromCamera) {
      const { status } = await ImagePicker.requestCameraPermissionsAsync()
      if (status !== 'granted') {
        Alert.alert(
          'Permiso requerido',
          'Necesitamos acceso a tu cámara para tomar la foto del comprobante.'
        )
        return
      }
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (status !== 'granted') {
        Alert.alert(
          'Permiso requerido',
          'Necesitamos acceso a tu galería para seleccionar el comprobante.'
        )
        return
      }
    }

    const result = fromCamera
      ? await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.8,
          allowsEditing: true,
        })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.8,
          allowsEditing: true,
        })

    if (!result.canceled && result.assets.length > 0) {
      setImageUri(result.assets[0].uri)
    }
  }

  const handleSubmit = async () => {
    if (!imageUri) {
      Alert.alert('Comprobante requerido', 'Selecciona o toma una foto del comprobante primero.')
      return
    }
    if (!orderId) {
      Alert.alert('Error', 'No se encontró el ID del pedido. Vuelve a intentarlo.')
      return
    }

    setLoading(true)
    try {
      await productOrdersAPI.uploadReceipt(orderId, imageUri)
      Alert.alert(
        '✅ Comprobante enviado',
        'Tu comprobante fue enviado. El equipo de RepTel lo revisará y confirmará tu pago pronto.',
        [
          {
            text: 'Ver mis pedidos',
            onPress: () => router.replace('/(client)/my-orders'),
          },
        ]
      )
    } catch (error: any) {
      const backendMessage = error?.response?.data?.message
      Alert.alert(
        'No se pudo enviar el comprobante',
        backendMessage || 'Ocurrió un error al enviar el comprobante. Intenta de nuevo.'
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
          <Text style={styles.step}>Paso 2 de 2</Text>
          <Text style={styles.title}>Subir Comprobante</Text>
          <Text style={styles.subtitle}>
            Toma o selecciona la foto de tu comprobante de pago
          </Text>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Instrucciones */}
          <View style={styles.infoCard}>
            <Text style={styles.infoText}>
              📎 Sube el screenshot o foto del comprobante de tu transferencia, Pago Móvil o Binance. El equipo de RepTel lo revisará y confirmará tu pedido manualmente.
            </Text>
          </View>

          {/* Preview de imagen */}
          {imageUri ? (
            <View style={styles.previewContainer}>
              <Image source={{ uri: imageUri }} style={styles.previewImage} resizeMode="contain" />
              <TouchableOpacity
                style={styles.changeImageBtn}
                onPress={() => setImageUri(null)}
              >
                <Text style={styles.changeImageText}>✕ Cambiar imagen</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.placeholderContainer}>
              <Text style={styles.placeholderIcon}>🧾</Text>
              <Text style={styles.placeholderText}>Ninguna imagen seleccionada</Text>
            </View>
          )}

          {/* Botones de selección */}
          {!imageUri && (
            <View style={styles.pickersRow}>
              <TouchableOpacity
                style={styles.pickerBtn}
                onPress={() => requestPermissionAndPick(false)}
              >
                <Text style={styles.pickerBtnIcon}>🖼️</Text>
                <Text style={styles.pickerBtnText}>Galería</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.pickerBtn}
                onPress={() => requestPermissionAndPick(true)}
              >
                <Text style={styles.pickerBtnIcon}>📷</Text>
                <Text style={styles.pickerBtnText}>Cámara</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Botón enviar */}
          <TouchableOpacity
            style={[
              styles.submitBtn,
              (!imageUri || loading) && styles.submitBtnDisabled,
            ]}
            onPress={handleSubmit}
            disabled={!imageUri || loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitBtnText}>Enviar Comprobante</Text>
            )}
          </TouchableOpacity>

          {/* Nota de espera */}
          <Text style={styles.waitNote}>
            ⏳ Una vez enviado, recibirás una notificación cuando tu pago sea confirmado.
          </Text>
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
    paddingBottom: 20,
  },
  step: { fontSize: 12, color: '#5364ad', fontWeight: '600', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 },
  title: { fontSize: 26, fontWeight: '800', color: '#17247a', marginBottom: 6 },
  subtitle: { fontSize: 14, color: '#5364ad', lineHeight: 20 },
  scrollContent: { paddingHorizontal: 22, paddingBottom: 40 },
  infoCard: {
    backgroundColor: '#fff8e1',
    borderRadius: 12,
    padding: 14,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#ffe082',
  },
  infoText: { fontSize: 13, color: '#7a6000', lineHeight: 20 },
  previewContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  previewImage: {
    width: '100%',
    height: 300,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#d0d8ff',
    backgroundColor: '#f0f3ff',
  },
  changeImageBtn: {
    marginTop: 12,
    alignSelf: 'center',
  },
  changeImageText: { color: '#5364ad', fontSize: 13, fontWeight: '600' },
  placeholderContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0f3ff',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#d0d8ff',
    borderStyle: 'dashed',
    height: 200,
    marginBottom: 20,
  },
  placeholderIcon: { fontSize: 48, marginBottom: 10 },
  placeholderText: { fontSize: 14, color: '#9aa5cc' },
  pickersRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 28,
  },
  pickerBtn: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingVertical: 20,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#d0d8ff',
  },
  pickerBtnIcon: { fontSize: 28, marginBottom: 6 },
  pickerBtnText: { fontSize: 14, fontWeight: '700', color: '#17247a' },
  submitBtn: {
    backgroundColor: '#17247a',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  submitBtnDisabled: { backgroundColor: '#c0c0c0' },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  waitNote: {
    fontSize: 13,
    color: '#5364ad',
    textAlign: 'center',
    lineHeight: 20,
  },
})