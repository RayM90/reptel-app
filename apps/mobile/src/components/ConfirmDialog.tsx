import { Modal, View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native'
import { useConfirmStore } from '../store/confirmDialog.store'

export default function ConfirmDialog() {
  const visible = useConfirmStore((state) => state.visible)
  const options = useConfirmStore((state) => state.options)
  const inputValue = useConfirmStore((state) => state.inputValue)
  const setInputValue = useConfirmStore((state) => state.setInputValue)
  const resolve = useConfirmStore((state) => state.resolve)

  if (!visible || !options) return null

  const handleCancel = () => resolve(options.requireText ? null : false)

  const handleConfirm = () => {
    if (options.requireText && !inputValue.trim()) return
    resolve(options.requireText ? inputValue.trim() : true)
  }

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={handleCancel}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>{options.title}</Text>
          {options.message && <Text style={styles.message}>{options.message}</Text>}

          {options.requireText && (
            <>
              {options.textLabel && <Text style={styles.label}>{options.textLabel}</Text>}
              <TextInput
                style={styles.input}
                value={inputValue}
                onChangeText={setInputValue}
                multiline
                placeholder="Escribe aquí..."
                placeholderTextColor="#9aa5cc"
              />
            </>
          )}

          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel}>
              <Text style={styles.cancelBtnText}>{options.cancelLabel || 'Cancelar'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm}>
              <Text style={styles.confirmBtnText}>{options.confirmLabel || 'Confirmar'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(23, 36, 122, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 400,
  },
  title: { fontSize: 17, fontWeight: '800', color: '#17247a', marginBottom: 8 },
  message: { fontSize: 14, color: '#5364ad', marginBottom: 12, lineHeight: 20 },
  label: { fontSize: 12, color: '#9aa5cc', fontWeight: '600', marginBottom: 6 },
  input: {
    borderWidth: 1.5,
    borderColor: '#d0d8ff',
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: '#17247a',
    minHeight: 70,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  buttonRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 4 },
  cancelBtn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10 },
  cancelBtnText: { color: '#5364ad', fontWeight: '600', fontSize: 14 },
  confirmBtn: { backgroundColor: '#17247a', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10 },
  confirmBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
})