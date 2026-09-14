import { useState } from 'react'
import { View, Text, TextInput, StyleSheet } from 'react-native'

export interface AddressValues {
  addressState: string
  addressCity: string
  addressNeighborhood: string
  addressStreet: string
  addressBuilding: string
}

interface AddressFieldsProps {
  values: AddressValues
  onChange: (values: AddressValues) => void
  disabled?: boolean
}

const FIELDS: { key: keyof AddressValues; label: string; placeholder: string }[] = [
  { key: 'addressState', label: 'Estado', placeholder: 'Ej: Carabobo' },
  { key: 'addressCity', label: 'Municipio', placeholder: 'Ej: Valencia' },
  { key: 'addressNeighborhood', label: 'Barrio/Urb.', placeholder: 'Ej: La Trigaleña' },
  { key: 'addressStreet', label: 'Calle', placeholder: 'Ej: Calle 5' },
  { key: 'addressBuilding', label: 'Edificio/Casa', placeholder: 'Ej: Casa 12' },
]

// Bloque reutilizable de 5 campos de dirección — mismos nombres/labels que
// admin-web (Registro.tsx), para que la BD quede idéntica venga de donde venga.
export default function AddressFields({ values, onChange, disabled }: AddressFieldsProps) {
  const [focusedField, setFocusedField] = useState<keyof AddressValues | null>(null)

  return (
    <View>
      {FIELDS.map(({ key, label, placeholder }) => (
        <View key={key} style={styles.fieldGroup}>
          <Text style={styles.label}>{label}</Text>
          <TextInput
            style={[styles.input, focusedField === key && styles.inputFocused]}
            value={values[key]}
            onChangeText={(text) => onChange({ ...values, [key]: text })}
            onFocus={() => setFocusedField(key)}
            onBlur={() => setFocusedField(null)}
            placeholder={placeholder}
            placeholderTextColor="#9ca3af"
            autoCapitalize="words"
            editable={!disabled}
          />
        </View>
      ))}
    </View>
  )
}

export const emptyAddressValues: AddressValues = {
  addressState: '', addressCity: '', addressNeighborhood: '', addressStreet: '', addressBuilding: '',
}

export const isAddressComplete = (v: AddressValues): boolean =>
  !!v.addressState.trim() && !!v.addressCity.trim() && !!v.addressNeighborhood.trim() && !!v.addressStreet.trim() && !!v.addressBuilding.trim()

export const isAddressEmpty = (v: AddressValues): boolean =>
  !v.addressState.trim() && !v.addressCity.trim() && !v.addressNeighborhood.trim() && !v.addressStreet.trim() && !v.addressBuilding.trim()

const styles = StyleSheet.create({
  fieldGroup: { marginBottom: 12 },
  label: { fontSize: 13, fontWeight: '600', color: '#1a1a6e', marginBottom: 6 },
  input: {
    borderWidth: 1.5, borderColor: '#d0d8ff', borderRadius: 12, padding: 13, fontSize: 15,
    color: '#1a1a6e', backgroundColor: '#f0f4ff',
  },
  inputFocused: { borderColor: '#5564ad' },
})
