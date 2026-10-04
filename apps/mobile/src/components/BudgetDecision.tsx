import { useState } from 'react'
import { View, Text, TouchableOpacity, TextInput, StyleSheet } from 'react-native'

// Decisión del cliente ante un presupuesto (o un repuesto adicional): primero
// Sí / No; luego, con Sí, pagar el mínimo o todo; con No, el motivo (solo en
// el presupuesto — el rechazo del repuesto no lleva motivo en el servidor).

const REJECT_REASONS = ['El precio es muy alto', 'Voy a comprar un equipo nuevo', 'Otro motivo'] as const

interface BudgetDecisionProps {
  kind: 'budget' | 'extra'
  minimumAmount: number
  fullAmount: number
  pendingReview: number
  loading: boolean
  onPay: (preset: 'minimum' | 'full') => void
  onReject: (reason?: string) => void
}

export default function BudgetDecision({ kind, minimumAmount, fullAmount, pendingReview, loading, onPay, onReject }: BudgetDecisionProps) {
  const [choice, setChoice] = useState<'yes' | 'no' | null>(null)
  const hasMinimum = minimumAmount > 0.009 && minimumAmount + 0.009 < fullAmount
  const [preset, setPreset] = useState<'minimum' | 'full'>(hasMinimum ? 'minimum' : 'full')
  const [reason, setReason] = useState<string | null>(null)
  const [otherReason, setOtherReason] = useState('')

  const isBudget = kind === 'budget'
  const payAmount = preset === 'minimum' ? minimumAmount : fullAmount
  const finalReason = reason === 'Otro motivo' ? otherReason.trim() : reason ?? ''
  const canReject = !isBudget || !!finalReason

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{isBudget ? '¿Qué decides con este presupuesto?' : 'Tu reparación necesita un repuesto adicional'}</Text>
      {pendingReview > 0.009 && (
        <Text style={styles.note}>Tienes ${pendingReview.toFixed(2)} en revisión por el local.</Text>
      )}

      <View style={styles.choiceRow}>
        <TouchableOpacity
          style={[styles.choiceBtn, styles.yesBtn, choice === 'yes' && styles.yesBtnActive]}
          onPress={(e) => { e.stopPropagation(); setChoice('yes') }}
        >
          <Text style={[styles.choiceText, styles.yesText, choice === 'yes' && styles.activeText]}>
            ✓ {isBudget ? 'Sí, reparar' : 'Sí, continuar'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.choiceBtn, styles.noBtn, choice === 'no' && styles.noBtnActive]}
          onPress={(e) => { e.stopPropagation(); setChoice('no') }}
        >
          <Text style={[styles.choiceText, styles.noText, choice === 'no' && styles.activeText]}>
            ✕ {isBudget ? 'No reparar' : 'No quiero el repuesto'}
          </Text>
        </TouchableOpacity>
      </View>

      {choice === 'yes' && fullAmount > 0.009 && (
        <>
          {hasMinimum && (
            <TouchableOpacity
              style={[styles.option, preset === 'minimum' && styles.optionActive]}
              onPress={(e) => { e.stopPropagation(); setPreset('minimum') }}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.optionLabel}>Pagar el mínimo · ${minimumAmount.toFixed(2)}</Text>
                <Text style={styles.optionSub}>
                  {isBudget ? 'El técnico empieza; el resto lo pagas al retirar' : 'El técnico continúa; el resto lo pagas al retirar'}
                </Text>
              </View>
              <View style={[styles.radio, preset === 'minimum' && styles.radioActive]} />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.option, preset === 'full' && styles.optionActive]}
            onPress={(e) => { e.stopPropagation(); setPreset('full') }}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.optionLabel}>Pagar todo · ${fullAmount.toFixed(2)}</Text>
              <Text style={styles.optionSub}>No tendrás nada pendiente al retirar</Text>
            </View>
            <View style={[styles.radio, preset === 'full' && styles.radioActive]} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.primaryBtn} onPress={(e) => { e.stopPropagation(); onPay(preset) }}>
            <Text style={styles.primaryBtnText}>Continuar al pago · ${payAmount.toFixed(2)}</Text>
          </TouchableOpacity>
        </>
      )}

      {choice === 'no' && (
        <>
          {isBudget ? (
            <>
              <Text style={styles.note}>Cuéntanos por qué:</Text>
              {REJECT_REASONS.map((r) => (
                <TouchableOpacity
                  key={r}
                  style={[styles.reason, reason === r && styles.reasonActive]}
                  onPress={(e) => { e.stopPropagation(); setReason(r) }}
                >
                  <Text style={[styles.reasonText, reason === r && styles.reasonTextActive]}>
                    {reason === r ? '●' : '○'} {r}
                  </Text>
                </TouchableOpacity>
              ))}
              {reason === 'Otro motivo' && (
                <TextInput
                  style={styles.input}
                  placeholder="Cuéntanos el motivo..."
                  placeholderTextColor="#9aa5cc"
                  value={otherReason}
                  onChangeText={setOtherReason}
                  onTouchStart={(e) => e.stopPropagation()}
                />
              )}
            </>
          ) : (
            <Text style={styles.note}>
              Si rechazas el repuesto, la reparación puede no quedar al 100% y es tu responsabilidad. Lo que ya pagaste no se devuelve.
            </Text>
          )}
          <TouchableOpacity
            style={[styles.rejectBtn, (!canReject || loading) && styles.disabled]}
            disabled={!canReject || loading}
            onPress={(e) => { e.stopPropagation(); onReject(isBudget ? finalReason : undefined) }}
          >
            <Text style={styles.primaryBtnText}>
              {isBudget ? 'Confirmar que no deseo reparar' : 'Confirmar que no quiero el repuesto'}
            </Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  )
}

// Colores de la tarjeta de decisión actual (decisionCard / approveBtn / rejectBtn).
const styles = StyleSheet.create({
  card: { backgroundColor: '#f5f7ff', borderRadius: 12, padding: 12, marginTop: 12, borderWidth: 1, borderColor: '#d5ddff' },
  title: { fontSize: 13, fontWeight: '700', color: '#17247a', marginBottom: 8 },
  note: { fontSize: 12, color: '#5364ad', marginBottom: 8, marginTop: 4 },
  choiceRow: { flexDirection: 'row', gap: 8, marginBottom: 6 },
  choiceBtn: { flex: 1, minHeight: 44, borderRadius: 12, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6, backgroundColor: '#fff' },
  yesBtn: { borderColor: '#1E7A3D' },
  yesBtnActive: { backgroundColor: '#1E7A3D' },
  noBtn: { borderColor: '#B3261E' },
  noBtnActive: { backgroundColor: '#B3261E' },
  choiceText: { fontSize: 13, fontWeight: '700', textAlign: 'center' },
  yesText: { color: '#1E7A3D' },
  noText: { color: '#B3261E' },
  activeText: { color: '#fff' },
  option: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#d0d8ff', borderRadius: 12, padding: 10, marginTop: 8, minHeight: 44 },
  optionActive: { borderColor: '#17247a', backgroundColor: '#f0f3ff' },
  optionLabel: { fontSize: 13, fontWeight: '700', color: '#17247a' },
  optionSub: { fontSize: 11, color: '#5364ad', marginTop: 2 },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: '#d0d8ff', marginLeft: 8 },
  radioActive: { borderColor: '#17247a', backgroundColor: '#17247a' },
  primaryBtn: { backgroundColor: '#17247a', borderRadius: 12, minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  primaryBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  reason: { borderWidth: 1.5, borderColor: '#d0d8ff', borderRadius: 12, minHeight: 44, justifyContent: 'center', paddingHorizontal: 12, marginTop: 6, backgroundColor: '#fff' },
  reasonActive: { borderColor: '#B3261E', backgroundColor: '#fee2e2' },
  reasonText: { fontSize: 12, color: '#17247a', fontWeight: '600' },
  reasonTextActive: { color: '#B3261E' },
  input: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#d0d8ff', borderRadius: 10, padding: 10, fontSize: 13, color: '#17247a', marginTop: 8 },
  rejectBtn: { backgroundColor: '#B3261E', borderRadius: 12, minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  disabled: { opacity: 0.5 },
})
