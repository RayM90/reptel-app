import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native'
import { router } from 'expo-router'
import { useAuthStore } from '../../src/store/auth.store'
import { api } from '../../src/services/api'

export default function LoginScreen() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('' )
  const [loading, setLoading]   = useState(false)
  const { setUser } = useAuthStore()

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Por favor completa todos los campos')
      return
    }
    try {
      setLoading(true)
      const response = await api.post('/api/auth/login', { email, password })
      const { user, token } = response.data.data
      setUser(user, token)

      switch (user.role) {
        case 'ADMIN':
        case 'MANAGER':
        case 'CASHIER':
          router.replace('/(admin)/dashboard')
          break
        case 'TECHNICIAN':
        case 'TECHNICIAN_DELIVERY':
          router.replace('/(technician)/orders')
          break
        case 'CLIENT':
          router.replace('/(client)/tracking')
          break
        default:
          router.replace('/welcome')
      }
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || 'Credenciales incorrectas')
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.container}>

        {/* ── Header ── */}
        <View style={styles.header}>
          <Text style={styles.logo}>🔧</Text>
          <Text style={styles.title}>RepTel</Text>
          <Text style={styles.subtitle}>Acceso para empleados</Text>
        </View>

        {/* ── Formulario ── */}
        <View style={styles.form}>
          <Text style={styles.label}>Correo electrónico</Text>
          <TextInput
            style={styles.input}
            placeholder="correo@ejemplo.com"
            placeholderTextColor="#999"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <Text style={styles.label}>Contraseña</Text>
          <TextInput
            style={styles.input}
            placeholder="••••••••"
            placeholderTextColor="#999"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.buttonText}>Iniciar sesión</Text>
            }
          </TouchableOpacity>
        </View>

        {/* ── Volver ── */}
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.replace('/welcome')}
        >
          <Text style={styles.backText}>← Volver al inicio</Text>
        </TouchableOpacity>

      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container:     { flex: 1, backgroundColor: '#1E3A5F', justifyContent: 'center', padding: 24 },
  header:        { alignItems: 'center', marginBottom: 32 },
  logo:          { fontSize: 56 },
  title:         { fontSize: 42, fontWeight: 'bold', color: '#fff', letterSpacing: 4, marginTop: 8 },
  subtitle:      { fontSize: 15, color: '#A8C4E0', marginTop: 4 },
  form:          { backgroundColor: '#fff', borderRadius: 16, padding: 24 },
  label:         { fontSize: 14, fontWeight: '600', color: '#1E3A5F', marginBottom: 8, marginTop: 16 },
  input:         { borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 8, padding: 12,
                   fontSize: 16, color: '#333', backgroundColor: '#F9F9F9' },
  button:        { backgroundColor: '#1a73e8', borderRadius: 8, padding: 16,
                   alignItems: 'center', marginTop: 24 },
  buttonDisabled:{ opacity: 0.6 },
  buttonText:    { color: '#fff', fontSize: 16, fontWeight: '600' },
  backBtn:       { alignItems: 'center', marginTop: 24 },
  backText:      { color: '#A8C4E0', fontSize: 15 },
})