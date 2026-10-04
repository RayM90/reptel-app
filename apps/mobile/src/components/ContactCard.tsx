import { View, Text, TouchableOpacity, StyleSheet, Linking } from 'react-native'

// Tarjeta de contacto del seguimiento: el técnico asignado (para coordinar
// dirección y retiro) y el local (atención al cliente, reclamos). Aparece
// desde que el pago del anticipo está confirmado hasta la entrega.

interface Props {
  technician: { name: string; lastName?: string | null; phone?: string | null } | null | undefined
  storePhone?: string | null
  // false en el panel de Soporte del inicio: solo la fila del local.
  showTechnician?: boolean
}

const digitsOf = (phone: string) => phone.replace(/\D/g, '')

// 0412-1234567 → 584121234567 (formato internacional que pide WhatsApp).
const whatsappUrl = (phone: string) => {
  const digits = digitsOf(phone)
  return `https://wa.me/${digits.startsWith('0') ? `58${digits.slice(1)}` : digits}`
}

function ContactRow({ title, name, phone }: { title: string; name: string; phone?: string | null }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowTitle}>{title}</Text>
      <Text style={styles.rowName}>{name}</Text>
      {phone ? (
        <>
          <Text style={styles.rowPhone}>{phone}</Text>
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={(e) => { e.stopPropagation(); Linking.openURL(`tel:${digitsOf(phone)}`) }}
            >
              <Text style={styles.actionText}>📞 Llamar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, styles.whatsappBtn]}
              onPress={(e) => { e.stopPropagation(); Linking.openURL(whatsappUrl(phone)) }}
            >
              <Text style={[styles.actionText, styles.whatsappText]}>💬 WhatsApp</Text>
            </TouchableOpacity>
          </View>
        </>
      ) : (
        <Text style={styles.rowPhone}>Teléfono no disponible — comunícate con el local</Text>
      )}
    </View>
  )
}

export default function ContactCard({ technician, storePhone, showTechnician = true }: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Contacto</Text>
      {showTechnician && (technician ? (
        <ContactRow
          title="👤 Tu técnico"
          name={[technician.name, technician.lastName].filter(Boolean).join(' ')}
          phone={technician.phone}
        />
      ) : (
        <View style={styles.row}>
          <Text style={styles.rowTitle}>👤 Tu técnico</Text>
          <Text style={styles.rowPhone}>Estamos buscando un técnico disponible</Text>
        </View>
      ))}
      <ContactRow title="🏪 Atención al cliente" name="RepTel" phone={storePhone} />
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#f5f7ff',
    borderRadius: 14,
    padding: 14,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#d5ddff',
  },
  cardTitle: { fontSize: 13, fontWeight: '700', color: '#17247a', marginBottom: 8 },
  row: { paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#e3e8ff' },
  rowTitle: { fontSize: 12, color: '#5a6399', marginBottom: 2 },
  rowName: { fontSize: 15, fontWeight: '600', color: '#17247a' },
  rowPhone: { fontSize: 13, color: '#3b4478', marginTop: 2 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 8 },
  actionBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#17247a',
  },
  actionText: { color: '#ffffff', fontWeight: '600', fontSize: 14 },
  whatsappBtn: { backgroundColor: '#1E7A3D' },
  whatsappText: { color: '#ffffff' },
})
