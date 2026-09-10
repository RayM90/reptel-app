import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native'
import { PHONE_PREFIXES, PHONE_DIGITS_LENGTH } from '../constants/venezuela'

interface PhoneInputProps {
  value: string
  onChange: (value: string) => void
}

// Teléfono venezolano: botones de prefijo de operadora (0412/0414/0416/0424/0426)
// + input solo de dígitos con el límite correcto (prefijo + 7 dígitos = 11 total).
// `value` siempre es el string completo (ej. "04121234567").
export default function PhoneInput({ value, onChange }: PhoneInputProps) {
  const knownPrefix = PHONE_PREFIXES.find((p) => value.startsWith(p))
  const prefix = knownPrefix ?? PHONE_PREFIXES[0]
  const digits = knownPrefix ? value.slice(4) : value.replace(/\D/g, '').slice(0, PHONE_DIGITS_LENGTH)

  // Si no hay dígitos todavía, el valor completo es '' — así un campo opcional
  // sin tocar no manda "0412" (prefijo solo) como si fuera un teléfono real.
  const emit = (nextPrefix: string, nextDigits: string) => onChange(nextDigits ? `${nextPrefix}${nextDigits}` : '')

  return (
    <View>
      <View style={styles.prefixRow}>
        {PHONE_PREFIXES.map((p) => (
          <TouchableOpacity
            key={p}
            style={[styles.prefixBtn, prefix === p && styles.prefixBtnActive]}
            onPress={() => emit(p, digits)}
          >
            <Text style={[styles.prefixBtnText, prefix === p && styles.prefixBtnTextActive]}>{p}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <TextInput
        style={styles.digitsInput}
        value={digits}
        onChangeText={(text) => emit(prefix, text.replace(/\D/g, '').slice(0, PHONE_DIGITS_LENGTH))}
        keyboardType="number-pad"
        maxLength={PHONE_DIGITS_LENGTH}
        placeholder={'1'.repeat(PHONE_DIGITS_LENGTH)}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  prefixRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  prefixBtn: {
    paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, borderWidth: 2,
    borderColor: '#e0e0e0', backgroundColor: '#f9f9f9',
  },
  prefixBtnActive: { borderColor: '#5564ad', backgroundColor: '#eef2ff' },
  prefixBtnText: { fontSize: 14, color: '#666', fontWeight: '600' },
  prefixBtnTextActive: { color: '#17247a' },
  digitsInput: {
    borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, fontSize: 15,
  },
})
