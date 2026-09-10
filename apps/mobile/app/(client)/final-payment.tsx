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
import { ordersAPI } from '../../src/services/api'
import { useToastStore } from '../../src/store/toast.store'
import { usePaymentDraft } from '../../src/hooks/usePaymentDraft'
import { usePaymentInfo, formatPaymentInfo } from '../../src/hooks/usePaymentInfo'
import PhoneInput from '../../src/components/PhoneInput'
import SelectField from '../../src/components/SelectField'
import { VENEZUELAN_BANKS } from '../../src/constants/venezuela'

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

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  PAGO_MOVIL: '📱 Pago Móvil',
  TRANSFERENCIA: '🏦 Transferencia Bancaria',
  BINANCE: '₿ Binance',
}

export default function FinalPaymentScreen() {
  const router = useRouter()
  const { orderId, orderNumber, budget, revisionAmount } = useLocalSearchParams<{
    orderId: string
    orderNumber: string
    budget: string
    revisionAmount: string
  }>()

  const budgetNumber = budget ? Number(budget) : 0
  const revisionNumber = revisionAmount ? Number(revisionAmount) : 0
  const totalNumber = Math.max(budgetNumber - revisionNumber, 0)

  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null)
  const { data: paymentSettings } = usePaymentInfo()

  const [banco, setBanco] = useState('')
  const [telefono, setTelefono] = useState('')
  const [referencia, setReferencia] = useState('')
  const [monto, setMonto] = useState(String(totalNumber.toFixed(2)))
  const [titular, setTitular] = useState('')
  const [cedulaLetter, setCedulaLetter] = useState<'V' | 'E'>('V')
  const [cedulaNumber, setCedulaNumber] = useState('')
  const cedula = cedulaNumber ? `${cedulaLetter}-${cedulaNumber}` : ''
  const [correo, setCorreo] = useState('')
  const [uid, setUid] = useState('')
  const [nombre, setNombre] = useState('')

  const { clearDraft } = usePaymentDraft(
    'final-payment',
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
  const faltante = totalNumber - montoNumber
  const montoInsuficiente = faltante > 0.009

  const isFormValid = () => {
    if (!selectedMethod) return false
    if (!monto || montoInsuficiente) return false
    if (selectedMethod === 'PAGO_MOVIL') return !!banco && !!telefono && !!referencia
    if (selectedMethod === 'TRANSFERENCIA') return !!banco && !!titular && !!cedula && !!referencia
    if (selectedMethod === 'BINANCE') return !!correo && !!uid && !!nombre
    return false
  }

  const handleSubmit = async () => {
    if (!isFormValid()) {
      showToast('Selecciona un método de pago y completa todos los campos requeridos.', 'error')
      return
    }
    if (!orderId) {
      showToast('No se encontró el ID de la orden. Vuelve a intentarlo.', 'error')
      return
    }

    let paymentDetails: Record<string, string> = { monto }

    if (selectedMethod === 'PAGO_MOVIL') {
      paymentDetails = { ...paymentDetails, banco, telefono, referencia }
    } else if (selectedMethod === 'TRANSFERENCIA') {
      paymentDetails = { ...paymentDetails, banco, titular, cedula, referencia }
    } else if (selectedMethod === 'BINANCE') {
      paymentDetails = { ...paymentDetails, correo, uid, nombre }
    }

    setLoading(true)
    try {
      await ordersAPI.submitFinalPayment(orderId, paymentDetails)
      clearDraft()
      // El Alert original solo tenía un botón ("Ver mis órdenes") que
      // navegaba — mostramos el toast de éxito y navegamos directo.
      showToast(
        '✅ Datos enviados. El equipo de RepTel los revisará y confirmará tu pago pronto.',
        'success'
      )
      router.replace('/(client)/my-technical-orders')
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
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backText}>← Atrás</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Pago Final</Text>
          <Text style={styles.subtitle}>Orden {orderNumber} — reparación completada</Text>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>💰 Resumen del saldo final</Text>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Presupuesto de reparación</Text>
              <Text style={styles.summaryValue}>${budgetNumber.toFixed(2)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Ya pagado (anticipo de revisión)</Text>
              <Text style={styles.summaryValueNegative}>-${revisionNumber.toFixed(2)}</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabelBold}>Total a pagar ahora</Text>
              <Text style={styles.summaryValueBold}>${totalNumber.toFixed(2)}</Text>
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

          {selectedMethod && (
            <View style={styles.form}>
              <Text style={styles.sectionTitle}>📝 Datos del pago</Text>

              {selectedMethod === 'PAGO_MOVIL' && (
                <>
                  <SelectField label="Banco" value={banco} options={VENEZUELAN_BANKS.map((b) => b.name)} onChange={setBanco} allowOther />
                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>Teléfono emisor</Text>
                    <PhoneInput value={telefono} onChange={setTelefono} />
                  </View>
                  <Field label="Últimos 4 dígitos de la referencia" value={referencia} onChangeText={(text) => setReferencia(onlyDigits(text))} placeholder="Ej. 1234" keyboardType="number-pad" maxLength={4} />
                </>
              )}

              {selectedMethod === 'TRANSFERENCIA' && (
                <>
                  <SelectField label="Banco" value={banco} options={VENEZUELAN_BANKS.map((b) => b.name)} onChange={setBanco} allowOther />
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

              {selectedMethod === 'BINANCE' && (
                <>
                  <Field label="Correo de la cuenta" value={correo} onChangeText={setCorreo} placeholder="correo@ejemplo.com" keyboardType="email-address" />
                  <Field label="UID de Binance" value={uid} onChangeText={(text) => setUid(onlyDigits(text))} placeholder="Ej. 123456789" />
                  <Field label="Nombre del titular" value={nombre} onChangeText={setNombre} placeholder="Nombre completo" />
                </>
              )}

              <Field label="Monto enviado ($)" value={monto} onChangeText={(text) => setMonto(onlyDecimal(text))} placeholder="Ej. 35.00" keyboardType="decimal-pad" />

              {montoInsuficiente && (
                <View style={styles.warningCard}>
                  <Text style={styles.warningText}>
                    ⚠️ Faltan ${faltante.toFixed(2)} para completar el pago total de ${totalNumber.toFixed(2)}
                  </Text>
                </View>
              )}
            </View>
          )}

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
            ⏳ Una vez confirmado tu pago, tu orden quedará marcada como completada.
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
  backBtn: { marginBottom: 8 },
  backText: { color: '#5364ad', fontSize: 14, fontWeight: '500' },
  title: { fontSize: 26, fontWeight: '800', color: '#17247a', marginBottom: 6 },
  subtitle: { fontSize: 14, color: '#5364ad', lineHeight: 20 },
  scrollContent: { paddingHorizontal: 22, paddingBottom: 40 },
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