import { useState } from 'react'
import { View, TextInput, StyleSheet, TextInputProps } from 'react-native'
import SelectField from './SelectField'
import { PHONE_PREFIXES, PHONE_DIGITS_LENGTH } from '../constants/venezuela'

interface PhoneInputProps {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}

// Input de dígitos compartido por PhoneInput e IdNumberInput: mismo estilo,
// mismo comportamiento de foco resaltado ("estados de foco ágiles").
function DigitsInput({ style, ...rest }: TextInputProps) {
  const [focused, setFocused] = useState(false)
  return (
    <TextInput
      style={[styles.digitsInput, focused && styles.digitsInputFocused, style]}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      keyboardType="number-pad"
      {...rest}
    />
  )
}

// Teléfono venezolano: SelectField compacto de prefijo (0412/0414/0416/0424/0426)
// + input de dígitos, en una sola fila. `value` siempre es el string completo
// (ej. "04121234567").
export default function PhoneInput({ value, onChange, disabled }: PhoneInputProps) {
  const knownPrefix = PHONE_PREFIXES.find((p) => value.startsWith(p))
  const prefix = knownPrefix ?? PHONE_PREFIXES[0]
  const digits = knownPrefix ? value.slice(4) : value.replace(/\D/g, '').slice(0, PHONE_DIGITS_LENGTH)

  // Si no hay dígitos todavía, el valor completo es '' — así un campo opcional
  // sin tocar no manda "0412" (prefijo solo) como si fuera un teléfono real.
  const emit = (nextPrefix: string, nextDigits: string) => onChange(nextDigits ? `${nextPrefix}${nextDigits}` : '')

  return (
    <View style={styles.row}>
      <SelectField
        compact
        label="Código"
        value={prefix}
        options={[...PHONE_PREFIXES]}
        onChange={(p) => emit(p, digits)}
      />
      <DigitsInput
        value={digits}
        onChangeText={(text) => emit(prefix, text.replace(/\D/g, '').slice(0, PHONE_DIGITS_LENGTH))}
        maxLength={PHONE_DIGITS_LENGTH}
        placeholder={'1'.repeat(PHONE_DIGITS_LENGTH)}
        editable={!disabled}
      />
    </View>
  )
}

PhoneInput.DigitsInput = DigitsInput

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  digitsInput: {
    flex: 1, borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, fontSize: 15,
  },
  digitsInputFocused: { borderColor: '#5564ad', borderWidth: 1.5 },
})
