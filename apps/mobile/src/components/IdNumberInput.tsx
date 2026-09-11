import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native'
import { ID_NUMBER_PREFIXES, ID_NUMBER_DIGITS_MAX_LENGTH } from '../constants/venezuela'

interface IdNumberInputProps {
  value: string
  onChange: (value: string) => void
}

// Cédula venezolana: botones de prefijo (V/E) + input solo de dígitos.
// `value` siempre es el string completo (ej. "V-12345678").
export default function IdNumberInput({ value, onChange }: IdNumberInputProps) {
  const knownPrefix = ID_NUMBER_PREFIXES.find((p) => value.startsWith(`${p}-`))
  const prefix = knownPrefix ?? ID_NUMBER_PREFIXES[0]
  const digits = knownPrefix ? value.slice(2) : value.replace(/\D/g, '').slice(0, ID_NUMBER_DIGITS_MAX_LENGTH)

  const emit = (nextPrefix: string, nextDigits: string) => onChange(nextDigits ? `${nextPrefix}-${nextDigits}` : '')

  return (
    <View>
      <View style={styles.prefixRow}>
        {ID_NUMBER_PREFIXES.map((p) => (
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
        onChangeText={(text) => emit(prefix, text.replace(/\D/g, '').slice(0, ID_NUMBER_DIGITS_MAX_LENGTH))}
        keyboardType="number-pad"
        maxLength={ID_NUMBER_DIGITS_MAX_LENGTH}
        placeholder="12345678"
      />
    </View>
  )
}

const styles = StyleSheet.create({
  prefixRow: { flexDirection: 'row', gap: 6, marginBottom: 8 },
  prefixBtn: {
    paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8, borderWidth: 2,
    borderColor: '#e0e0e0', backgroundColor: '#f9f9f9',
  },
  prefixBtnActive: { borderColor: '#5564ad', backgroundColor: '#eef2ff' },
  prefixBtnText: { fontSize: 14, color: '#666', fontWeight: '600' },
  prefixBtnTextActive: { color: '#17247a' },
  digitsInput: {
    borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, fontSize: 15,
  },
})
