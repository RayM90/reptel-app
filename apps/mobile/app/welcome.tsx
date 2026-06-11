import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native'
import { useRouter } from 'expo-router'

export default function WelcomeScreen() {
  const router = useRouter()

  return (
    <View style={styles.container}>

      {/* ── Logo / Título ── */}
      <View style={styles.logoBox}>
        <Text style={styles.logo}>🔧</Text>
        <Text style={styles.title}>RepTel</Text>
        <Text style={styles.subtitle}>Servicio técnico de confianza</Text>
      </View>

      {/* ── Botones ── */}
      <View style={styles.buttonsBox}>
        <TouchableOpacity
          style={styles.btnClient}
          onPress={() => router.push('/(client)/tracking')}
        >
          <Text style={styles.btnIcon}>📱</Text>
          <Text style={styles.btnTitle}>Soy Cliente</Text>
          <Text style={styles.btnDesc}>Rastrea tu equipo o compra accesorios</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.btnEmployee}
          onPress={() => router.push('/(auth)/login')}
        >
          <Text style={styles.btnIcon}>👤</Text>
          <Text style={styles.btnTitle}>Soy Empleado</Text>
          <Text style={styles.btnDesc}>Accede con tu usuario y contraseña</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.footer}>RepTel App v1.0</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#1a73e8', justifyContent: 'space-between',
                 paddingVertical: 60, paddingHorizontal: 24 },
  logoBox:     { alignItems: 'center', marginTop: 40 },
  logo:        { fontSize: 72 },
  title:       { fontSize: 42, fontWeight: 'bold', color: '#fff', marginTop: 8 },
  subtitle:    { fontSize: 16, color: '#c8e0ff', marginTop: 4 },
  buttonsBox:  { gap: 16 },
  btnClient:   { backgroundColor: '#fff', borderRadius: 16, padding: 20, alignItems: 'center' },
  btnEmployee: { backgroundColor: '#0d47a1', borderRadius: 16, padding: 20,
                 alignItems: 'center', borderWidth: 2, borderColor: '#fff' },
  btnIcon:     { fontSize: 36, marginBottom: 8 },
  btnTitle:    { fontSize: 20, fontWeight: 'bold', color: '#1a73e8', marginBottom: 4 },
  btnDesc:     { fontSize: 13, color: '#666', textAlign: 'center' },
  footer:      { textAlign: 'center', color: '#c8e0ff', fontSize: 12 },
})