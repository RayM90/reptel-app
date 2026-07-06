import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  TextInput,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { Stack, useRouter, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { ordersAPI } from '../../src/services/api'

type PaymentMethod = 'PAGO_MOVIL' | 'TRANSFERENCIA' | 'BINANCE'

export default function UploadAdvanceReceiptScreen() {
  const router = useRouter()
  const { orderId, paymentMethod, total } = useLocalSearchParams<{
    orderId: string
    paymentMethod: PaymentMethod
    total: string
  }>()

  const totalNumber = total ? Number(total) : null

  const [banco, setBanco] = useState('')
  const [telefono, setTelefono] = useState('')
  const [referencia, setReferencia] = useState('')
  const [monto, setMonto] = useState(total || '')
  const [titular, setTitular] = useState('')
  const [cedula, setCedula] = useState('')
  const [correo, setCorreo] = useState('')
  const [uid, setUid] = useState('')
  const [nombre, setNombre] = useState('')

  const [loading, setLoading] = useState(false)

  const montoNumber = monto ? Number(monto) : 0
  const faltante = totalNumber != null ? totalNumber - montoNumber : 0
  const montoInsuficiente = totalNumber != null && faltante > 0.009

  const isFormValid = () => {
    if (!monto || montoInsuficiente) return false
    if (paymentMethod === 'PAGO_MOVIL') return !!banco && !!telefono && !!referencia
    if (paymentMethod === 'TRANSFERENCIA') return !!banco && !!titular && !!cedula && !!referencia
    if (paymentMethod === 'BINANCE') return !!correo && !!uid && !!nombre
    return false
  }

  const handleSubmit = async () => {
    if (!isFormValid()) {
      Alert.alert('Datos incompletos', 'Completa todos los campos requeridos.')
      return
    }
    if (!orderId) {
      Alert.alert('Error', 'No se encontró el ID de la orden. Vuelve a intentarlo.')
      return
    }

    let paymentDetails: Record<string, string> = { monto }

    if (paymentMethod === 'PAGO_MOVIL') {
      paymentDetails = { ...paymentDetails, banco, telefono, referencia }
    } else if (paymentMethod === 'TRANSFERENCIA') {
      paymentDetails = { ...paymentDetails, banco, titular, cedula, referencia }
    } else if (paymentMethod === 'BINANCE') {
      paymentDetails = { ...paymentDetails, correo, uid, nombre }
    }

    setLoading(true)
    try {
      await ordersAPI.submitAdvancePayment(orderId, paymentDetails)
      Alert.alert(
        '✅ Datos de pago enviados',
        'Tus datos fueron enviados. El equipo de RepTel los revisará y confirmará tu pago pronto. El técnico será despachado una vez confirmado.',
        [
          {
            text: 'Ver mis órdenes',
            onPress: () => router.replace('/(client)/my-technical-orders'),
          },
        ]
      )
    } catch (error: any) {
      const backendMessage = error?.response?.data?.message
      Alert.alert(
        'No se pudo enviar la información',
        backendMessage || 'Ocurrió un error al enviar los datos. Intenta de nuevo.'
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
          <Text style={styles.step}>Paso 2 de 2</Text>
          <Text style={styles.title}>Datos del Pago</Text>
          <Text style={styles.subtitle}>
            Ingresa los datos de tu pago anticipado (delivery + revisión)
          </Text>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.infoCard}>
            <Text style={styles.infoText}>
              📝 Ingresa los datos exactos de tu pago. El equipo de RepTel los verificará y confirmará el pago manualmente para despachar al técnico.
            </Text>
          </View>

          <View style={styles.form}>
            {paymentMethod === 'PAGO_MOVIL' && (
              <>
                <Field label="Banco" value={banco} onChangeText={setBanco} placeholder="Ej. Banesco" />
                <Field label="Teléfono emisor" value={telefono} onChangeText={setTelefono} placeholder="Ej. 0414-1234567" keyboardType="phone-pad" />
                <Field label="Últimos 4 dígitos de la referencia" value={referencia} onChangeText={setReferencia} placeholder="Ej. 1234" keyboardType="number-pad" maxLength={4} />
              </>
            )}

            {paymentMethod === 'TRANSFERENCIA' && (
              <>
                <Field label="Banco" value={banco} onChangeText={setBanco} placeholder="Ej. Banesco" />
                <Field label="Nombre del titular" value={titular} onChangeText={setTitular} placeholder="Nombre completo" />
                <Field label="Cédula" value={cedula} onChangeText={setCedula} placeholder="Ej. V-12345678" />
                <Field label="Número de referencia" value={referencia} onChangeText={setReferencia} placeholder="Referencia de la transferencia" keyboardType="number-pad" />
              </>
            )}

            {paymentMethod === 'BINANCE' && (
              <>
                <Field label="Correo de la cuenta" value={correo} onChangeText={setCorreo} placeholder="correo@ejemplo.com" keyboardType="email-address" />
                <Field label="UID de Binance" value={uid} onChangeText={setUid} placeholder="Ej. 123456789" />
                <Field label="Nombre del titular" value={nombre} onChangeText={setNombre} placeholder="Nombre completo" />
              </>
            )}

            <Field label="Monto enviado ($)" value={monto} onChangeText={setMonto} placeholder="Ej. 25.00" keyboardType="decimal-pad" />

            {montoInsuficiente && (
              <View style={styles.warningCard}>
                <Text style={styles.warningText}>
                  ⚠️ Faltan ${faltante.toFixed(2)} para completar el pago total de ${totalNumber?.toFixed(2)}
                </Text>
              </View>
            )}
          </View>

          <TouchableOpacity
            style={[styles.submitBtn, (!isFormValid() || loading) && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={!isFormValid() || loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitBtnText}>Enviar Datos de Pago</Text>
            )}
          </TouchableOpacity>

          <Text style={styles.waitNote}>
            ⏳ Una vez enviado, el técnico-delivery será notificado para salir tan pronto tu pago sea confirmado.
          </Text>
        </ScrollView>
      </LinearGradient>
    </>
  )
}

interface FieldProps {
  label: string
  value: string
  onChangeText: (text: string) => void
  placeholder?: string
  keyboardType?: 'default' | 'phone-pad' | 'number-pad' | 'decimal-pad' | 'email-address'
  maxLength?: number
}

function Field({ label, value, onChangeText, placeholder, keyboardType = 'default', maxLength }: FieldProps) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.fieldInput}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#9aa5cc"
        keyboardType={keyboardType}
        maxLength={maxLength}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingTop: 60, paddingHorizontal: 22, paddingBottom: 20 },
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
  form: { marginBottom: 8 },
  fieldGroup: { marginBottom: 16 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#17247a', marginBottom: 6 },
  fieldInput: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#d0d8ff',
    fontSize: 14,
    color: '#17247a',
  },
  warningCard: {
    backgroundColor: '#fee2e2',
    borderRadius: 12,
    padding: 12,
    marginTop: -4,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#fca5a5',
  },
  warningText: { fontSize: 13, color: '#b91c1c', fontWeight: '600' },
  submitBtn: { backgroundColor: '#17247a', borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginBottom: 16, marginTop: 8 },
  submitBtnDisabled: { backgroundColor: '#c0c0c0' },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  waitNote: { fontSize: 13, color: '#5364ad', textAlign: 'center', lineHeight: 20 },
})