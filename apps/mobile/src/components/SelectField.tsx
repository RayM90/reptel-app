import { useState } from 'react'
import { View, Text, TouchableOpacity, Modal, FlatList, StyleSheet, TextInput } from 'react-native'

const OTHER = '__OTRO__'

interface SelectFieldProps {
  label: string
  value: string
  options: string[]
  onChange: (value: string) => void
  allowOther?: boolean
  placeholder?: string
  compact?: boolean // sin label propio, trigger angosto — para usar dentro de una fila (ej. prefijo de teléfono/cédula)
}

// Select genérico con modal — usado para marca, modelo (dependiente de marca),
// color y banco en los formularios de intake. Sin librería de picker nueva:
// RN no trae <select>, esto reutiliza solo componentes core (Modal/FlatList).
export default function SelectField({ label, value, options, onChange, allowOther, placeholder, compact }: SelectFieldProps) {
  const [open, setOpen] = useState(false)
  const [otherMode, setOtherMode] = useState(() => !!allowOther && value !== '' && !options.includes(value))

  if (otherMode) {
    return (
      <View style={{ marginBottom: 12 }}>
        <Text style={styles.label}>{label}</Text>
        <TextInput
          style={styles.otherInput}
          value={value}
          onChangeText={onChange}
          placeholder={`${label} (escribe aquí)`}
        />
        <TouchableOpacity onPress={() => { setOtherMode(false); onChange('') }}>
          <Text style={styles.switchBack}>← Elegir de la lista</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <View style={compact ? undefined : { marginBottom: 12 }}>
      {!compact && <Text style={styles.label}>{label}</Text>}
      <TouchableOpacity style={compact ? styles.triggerCompact : styles.trigger} onPress={() => setOpen(true)}>
        <Text style={value ? styles.triggerText : styles.triggerPlaceholder}>
          {value || placeholder || 'Seleccionar…'}
        </Text>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setOpen(false)}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>{label}</Text>
            <FlatList
              data={allowOther ? [...options, OTHER] : options}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.option}
                  onPress={() => {
                    setOpen(false)
                    if (item === OTHER) {
                      setOtherMode(true)
                      onChange('')
                    } else {
                      onChange(item)
                    }
                  }}
                >
                  <Text style={styles.optionText}>{item === OTHER ? 'Otro' : item}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  label: { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 6 },
  trigger: {
    borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, backgroundColor: '#fff',
  },
  triggerCompact: {
    borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingVertical: 12, paddingHorizontal: 10,
    backgroundColor: '#fff', minWidth: 64, alignItems: 'center',
  },
  triggerText: { fontSize: 15, color: '#222' },
  triggerPlaceholder: { fontSize: 15, color: '#999' },
  otherInput: {
    borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, fontSize: 15,
  },
  switchBack: { fontSize: 13, color: '#5564ad', marginTop: 6 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: '60%', padding: 16 },
  sheetTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
  option: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  optionText: { fontSize: 15, color: '#222' },
})
