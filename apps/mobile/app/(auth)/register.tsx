import { View, Text, StyleSheet } from 'react-native'

export default function RegisterScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Registro — próximamente</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1E3A5F' },
  text: { color: '#fff', fontSize: 18 },
})