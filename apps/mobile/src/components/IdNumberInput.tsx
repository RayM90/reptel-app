import { View, StyleSheet } from 'react-native'
import SelectField from './SelectField'
import { ID_NUMBER_PREFIXES, ID_NUMBER_COMPANY_PREFIXES, ID_NUMBER_MAX_DIGITS } from '../constants/venezuela'
import PhoneInput from './PhoneInput'

interface IdNumberInputProps {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}

// Cédula/RIF venezolano: SelectField compacto (V/E persona natural, J/G
// jurídico o gobierno) + input de dígitos, en una sola fila. Mismo formato
// que valida el backend: "V-12345678".
export default function IdNumberInput({ value, onChange, disabled }: IdNumberInputProps) {
  const knownPrefix = ID_NUMBER_PREFIXES.find((p) => value.startsWith(`${p}-`))
  const prefix = knownPrefix ?? ID_NUMBER_PREFIXES[0]
  const digits = knownPrefix ? value.slice(2) : value.replace(/\D/g, '').slice(0, ID_NUMBER_MAX_DIGITS)

  const emit = (nextPrefix: string, nextDigits: string) => onChange(nextDigits ? `${nextPrefix}-${nextDigits}` : '')

  return (
    <View style={styles.row}>
      <SelectField
        compact
        label="Prefijo"
        value={prefix}
        options={[...ID_NUMBER_PREFIXES]}
        onChange={(p) => emit(p, digits)}
      />
      <PhoneInput.DigitsInput
        value={digits}
        onChangeText={(text: string) => emit(prefix, text.replace(/\D/g, '').slice(0, ID_NUMBER_MAX_DIGITS))}
        maxLength={ID_NUMBER_MAX_DIGITS}
        placeholder="12345678"
        editable={!disabled}
      />
    </View>
  )
}

export const isCompanyIdPrefix = (idNumber: string): boolean =>
  ID_NUMBER_COMPANY_PREFIXES.some((p) => idNumber.startsWith(`${p}-`))

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
})
