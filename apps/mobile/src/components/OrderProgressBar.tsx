import { View, Text, StyleSheet } from 'react-native'

// Barrita "Paso N de M" de la tarjeta de una orden activa.
export default function OrderProgressBar({ current, total }: { current: number; total: number }) {
  return (
    <View>
      <View style={styles.row}>
        {Array.from({ length: total }, (_, i) => (
          <View key={i} style={[styles.seg, i < current && styles.segOn]} />
        ))}
      </View>
      <Text style={styles.text}>Paso {current} de {total}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 3, marginTop: 10, marginBottom: 4 },
  seg: { flex: 1, height: 5, borderRadius: 3, backgroundColor: '#e3e8ff' },
  segOn: { backgroundColor: '#17247a' },
  text: { fontSize: 11, color: '#5364ad' },
})
