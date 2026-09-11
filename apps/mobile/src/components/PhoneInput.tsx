import { View, TextInput, StyleSheet } from 'react-native'
import { PHONE_PREFIXES, PHONE_DIGITS_LENGTH } from '../constants/venezuela'
import SelectField from './SelectField'

interface PhoneInputProps {
  value: string
  onChange: (value: string) => void
}

// Teléfono venezolano: SelectField (modal + lista) para el prefijo de
// operadora (0412/0414/0416/0424/0426) + input solo de dígitos con el
// límite correcto (prefijo + 7 dígitos = 11 total).
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
      <SelectField
        label="Código"
        value={prefix}
        options={[...PHONE_PREFIXES]}
        onChange={(p) => emit(p, digits)}
      />
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
  digitsInput: {
    borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, fontSize: 15, marginTop: 8,
  },
})
