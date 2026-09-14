import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native'
import { EMAIL_DOMAIN_SUGGESTIONS } from '../constants/venezuela'

interface EmailAutocompleteInputProps {
  value: string
  onChange: (value: string) => void
}

// Email con chips de autocompletado de dominio: aparecen sobre el teclado
// mientras el usuario escribe después del "@", filtrados por lo ya tipeado.
// Desaparecen al perder el foco o al completar un dominio ya válido.
export default function EmailAutocompleteInput({ value, onChange }: EmailAutocompleteInputProps) {
  const [focused, setFocused] = useState(false)

  const atIndex = value.indexOf('@')
  const domainTyped = atIndex >= 0 ? value.slice(atIndex + 1) : null
  const domainAlreadyComplete = domainTyped !== null && (EMAIL_DOMAIN_SUGGESTIONS as readonly string[]).includes(domainTyped)
  const matchingDomains =
    domainTyped !== null && !domainAlreadyComplete
      ? EMAIL_DOMAIN_SUGGESTIONS.filter((d) => d.startsWith(domainTyped))
      : []
  const showChips = focused && matchingDomains.length > 0

  const applyDomain = (domain: string) => {
    const localPart = atIndex >= 0 ? value.slice(0, atIndex) : value
    onChange(`${localPart}@${domain}`)
  }

  return (
    <View>
      <TextInput
        style={[styles.input, focused && styles.inputFocused]}
        value={value}
        onChangeText={onChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        placeholder="correo@ejemplo.com"
        placeholderTextColor="#9ca3af"
      />
      {showChips && (
        <View style={styles.chipsRow}>
          {matchingDomains.map((domain) => (
            <TouchableOpacity key={domain} style={styles.chip} onPress={() => applyDomain(domain)}>
              <Text style={styles.chipText}>@{domain}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1.5, borderColor: '#d0d8ff', borderRadius: 12, padding: 13, fontSize: 15,
    color: '#1a1a6e', backgroundColor: '#f0f4ff',
  },
  inputFocused: { borderColor: '#5564ad' },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  chip: {
    paddingVertical: 6, paddingHorizontal: 10, borderRadius: 16, backgroundColor: '#eef2ff',
    borderWidth: 1, borderColor: '#c7d2fe',
  },
  chipText: { fontSize: 13, color: '#3730a3', fontWeight: '600' },
})
