import { Modal, View, Text, TouchableOpacity, StyleSheet, Pressable } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import ContactCard from './ContactCard'
import { usePaymentInfo } from '../hooks/usePaymentInfo'

// Soporte del inicio: la misma tarjeta de Contacto de las órdenes, solo con
// la fila de atención al cliente (teléfono configurado en el panel).
export default function SupportSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets()
  const { data: paymentSettings } = usePaymentInfo()
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 12) + 8 }]}>
        <View style={styles.grab} />
        <ContactCard technician={null} storePhone={paymentSettings?.pagoMovilTelefono} showTechnician={false} />
        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
          <Text style={styles.closeText}>Cerrar</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(10,15,50,0.35)' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 18, paddingTop: 12 },
  grab: { width: 40, height: 5, borderRadius: 3, backgroundColor: '#d5ddff', alignSelf: 'center', marginBottom: 4 },
  closeBtn: { minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  closeText: { color: '#5364ad', fontSize: 14, fontWeight: '600' },
})
