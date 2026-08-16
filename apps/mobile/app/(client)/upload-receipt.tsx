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
import { useToastStore } from '../../src/store/toast.store'
import { usePaymentDraft } from '../../src/hooks/usePaymentDraft'

type PaymentMethod = 'PAGO_MOVIL' | 'TRANSFERENCIA' | 'BINANCE'

// Filtros de entrada — restringen los campos numéricos a lo que realmente
// deben contener, en vez de solo cambiar el tipo de teclado mostrado.
const onlyDigits = (text: string) => text.replace(/[^0-9]/g, '')
const onlyDecimal = (text: string) => {
  const cleaned = text.replace(/[^0-9.]/g, '')
  const parts = cleaned.split('.')
  if (parts.length <= 2) return cleaned
  return parts[0] + '.' + parts.slice(1).join('')
}

export default function UploadReceiptScreen() {
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
  const [cedulaLetter, setCedulaLetter] = useState<'V' | 'E'>('V')
  const [cedulaNumber, setCedulaNumber] = useState('')
  const cedula = cedulaNumber ? `${cedulaLetter}-${cedulaNumber}` : ''
  const [correo, setCorreo] = useState('')
  const [uid, setUid] = useState('')
  const [nombre, setNombre] = useState('')

  const { clearDraft } = usePaymentDraft(
    'upload-receipt',
    orderId,
    { banco, telefono, referencia, monto, titular, cedulaLetter, cedulaNumber, correo, uid, nombre },
    (loaded) => {
      if (loaded.banco !== undefined) setBanco(loaded.banco)
      if (loaded.telefono !== undefined) setTelefono(loaded.telefono)
      if (loaded.referencia !== undefined) setReferencia(loaded.referencia)
      if (loaded.monto !== undefined) setMonto(loaded.monto)
      if (loaded.titular !== undefined) setTitular(loaded.titular)
      if (loaded.cedulaLetter === 'V' || loaded.cedulaLetter === 'E') setCedulaLetter(loaded.cedulaLetter)
      if (loaded.cedulaNumber !== undefined) setCedulaNumber(loaded.cedulaNumber)
      if (loaded.correo !== undefined) setCorreo(loaded.correo)
      if (loaded.uid !== undefined) setUid(loaded.uid)
      if (loaded.nombre !== undefined) setNombre(loaded.nombre)
    }
  )

  const [loading, setLoading] = useState(false)
  const showToast = useToastStore((state) => state.showToast)

  const montoNumber = monto ? Number(monto) : 0
  const restante = totalNumber != null ? totalNumber - montoNumber : 0
  const esPagoParcial = totalNumber != null && restante > 0.009
  const excedeElTotal = totalNumber != null && montoNumber > totalNumber + 0.009

  const isFormValid = () => {
    if (!monto || montoNumber <= 0 || excedeElTotal) return false
    if (paymentMethod === 'PAGO_MOVIL') return !!banco && !!telefono && !!referencia
    if (paymentMethod === 'TRANSFERENCIA') return !!banco && !!titular && !!cedula && !!referencia
    if (paymentMethod === 'BINANCE') return !!correo && !!uid && !!nombre
    return false
  }

  const handleSubmit = async () => {
    if (!isFormValid()) {
      showToast('Completa todos los campos requeridos.', 'error')
      return
    }
    if (!orderId) {
      showToast('No se encontró el ID del pedido. Vuelve a intentarlo.', 'error')
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
      await productOrdersAPI.uploadReceipt(orderId, paymentDetails, montoNumber)
      clearDraft()
      // El Alert original solo tenía un botón ("Ver mis pedidos") que
      // navegaba — mostramos el toast de éxito y navegamos directo.
      showToast(
        esPagoParcial
          ? `Tu abono de $${montoNumber.toFixed(2)} fue enviado. El equipo de RepTel lo revisará. Aún quedará un saldo pendiente de $${restante.toFixed(2)} por enviar.`
          : '✅ Datos enviados. El equipo de RepTel los revisará y confirmará tu pago pronto. Un motorizado será asignado una vez confirmado.',
        'success'
      )
      router.replace('/(client)/my-orders')
    } catch (error: any) {
      const backendMessage = error?.response?.data?.message
      showToast(
        backendMessage || 'Ocurrió un error al enviar los datos. Intenta de nuevo.',
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
      <LinearGradient
        colors={['#ffffff', '#eef2ff', '#d5ddff', '#8fa5ff']}
        style={styles.container}
      >
        <View style={styles.header}>
          <Text style={styles.step}>Paso 2 de 2</Text>
          <Text style={styles.title}>Datos del Pago</Text>
          <Text style={styles.subtitle}>
            Ingresa los datos del pago de tu pedido
          </Text>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.infoCard}>
            <Text style={styles.infoText}>
              📝 Ingresa los datos exactos de tu pago. Puedes pagar el total de una vez o abonar por partes: el equipo de RepTel confirmará cada abono, y en cuanto se complete el monto se asignará tu entrega.
            </Text>
          </View>

          <View style={styles.form}>
            {paymentMethod === 'PAGO_MOVIL' && (
              <>
                <Field label="Banco" value={banco} onChangeText={setBanco} placeholder="Ej. Banesco" />
                <Field label="Teléfono emisor" value={telefono} onChangeText={(text) => setTelefono(onlyDigits(text))} placeholder="Ej. 0414-1234567" keyboardType="phone-pad" />
                <Field label="Últimos 4 dígitos de la referencia" value={referencia} onChangeText={(text) => setReferencia(onlyDigits(text))} placeholder="Ej. 1234" keyboardType="number-pad" maxLength={4} />
              </>
            )}

            {paymentMethod === 'TRANSFERENCIA' && (
              <>
                <Field label="Banco" value={banco} onChangeText={setBanco} placeholder="Ej. Banesco" />
                <Field label="Nombre del titular" value={titular} onChangeText={setTitular} placeholder="Nombre completo" />
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Cédula</Text>
                  <View style={styles.cedulaRow}>
                    <View style={styles.cedulaLetterGroup}>
                      <TouchableOpacity
                        style={[styles.cedulaLetterBtn, cedulaLetter === 'V' && styles.cedulaLetterBtnActive]}
                        onPress={() => setCedulaLetter('V')}
                      >
                        <Text style={[styles.cedulaLetterText, cedulaLetter === 'V' && styles.cedulaLetterTextActive]}>V</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.cedulaLetterBtn, cedulaLetter === 'E' && styles.cedulaLetterBtnActive]}
                        onPress={() => setCedulaLetter('E')}
                      >
                        <Text style={[styles.cedulaLetterText, cedulaLetter === 'E' && styles.cedulaLetterTextActive]}>E</Text>
                      </TouchableOpacity>
                    </View>
                    <TextInput
                      style={styles.cedulaInput}
                      value={cedulaNumber}
                      onChangeText={(text) => setCedulaNumber(onlyDigits(text))}
                      placeholder="12345678"
                      placeholderTextColor="#9aa5cc"
                      keyboardType="number-pad"
                    />
                  </View>
                </View>
                <Field label="Número de referencia" value={referencia} onChangeText={(text) => setReferencia(onlyDigits(text))} placeholder="Referencia de la transferencia" keyboardType="number-pad" />
              </>
            )}

            {paymentMethod === 'BINANCE' && (
              <>
                <Field label="Correo de la cuenta" value={correo} onChangeText={setCorreo} placeholder="correo@ejemplo.com" keyboardType="email-address" />
                <Field label="UID de Binance" value={uid} onChangeText={(text) => setUid(onlyDigits(text))} placeholder="Ej. 123456789" />
                <Field label="Nombre del titular" value={nombre} onChangeText={setNombre} placeholder="Nombre completo" />
              </>
            )}

            <Field label="Monto enviado ($)" value={monto} onChangeText={(text) => setMonto(onlyDecimal(text))} placeholder="Ej. 25.00" keyboardType="decimal-pad" />

            {esPagoParcial && (
              <View style={styles.infoNoteCard}>
                <Text style={styles.infoNoteText}>
                  ℹ️ Este sería un abono parcial. Restante después de este pago: ${restante.toFixed(2)} de ${totalNumber?.toFixed(2)}
                </Text>
              </View>
            )}

            {excedeElTotal && (
              <View style={styles.warningCard}>
                <Text style={styles.warningText}>
                  ⚠️ El monto no puede ser mayor al total del pedido (${totalNumber?.toFixed(2)})
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
            ⏳ Una vez enviado, un motorizado será asignado tan pronto tu pago sea confirmado por completo.
          </Text>
        </ScrollView>
      </LinearGradient>
      </KeyboardAvoidingView>
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
  cedulaRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  cedulaLetterGroup: { flexDirection: 'row', gap: 6 },
  cedulaLetterBtn: {
    width: 44,
    height: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#d0d8ff',
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cedulaLetterBtnActive: { borderColor: '#17247a', backgroundColor: '#17247a' },
  cedulaLetterText: { fontSize: 15, fontWeight: '700', color: '#17247a' },
  cedulaLetterTextActive: { color: '#fff' },
  cedulaInput: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#d0d8ff',
    fontSize: 14,
    color: '#17247a',
  },
  infoNoteCard: {
    backgroundColor: '#e0e7ff',
    borderRadius: 12,
    padding: 12,
    marginTop: -4,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#c7d2fe',
  },
  infoNoteText: { fontSize: 13, color: '#17247a', fontWeight: '600' },
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