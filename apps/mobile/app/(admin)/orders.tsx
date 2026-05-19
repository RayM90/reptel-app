import { View, Text, StyleSheet } from 'react-native'

export default function AdminOrdersScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Gestión de órdenes — próximamente</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F7FA' },
  text: { color: '#1E3A5F', fontSize: 18 },
})