import { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native'
import { router } from 'expo-router'
import { useAuthStore } from '../../src/store/auth.store'
import { api } from '../../src/services/api'

export default function LoginScreen() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
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
          router.replace('/(admin)/dashboard')
          break
        case 'TECHNICIAN':
          router.replace('/(technician)/orders')
          break
        case 'CLIENT':
          router.replace('/(client)/tracking')
          break
      }
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || 'Credenciales incorrectas')
    } finally {
      setLoading(false)
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>RepTel</Text>
        <Text style={styles.subtitle}>Servicio Técnico</Text>
      </View>

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

      {/* Botón de tracking para clientes sin cuenta */}
      <TouchableOpacity
        style={styles.trackingButton}
        onPress={() => router.push('/(client)/tracking')}
      >
        <Text style={styles.trackingIcon}>📦</Text>
        <Text style={styles.trackingText}>Rastrear mi reparación</Text>
      </TouchableOpacity>

      <Text style={styles.trackingHint}>
        No necesitas iniciar sesión para rastrear tu orden
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1E3A5F',
    justifyContent: 'center',
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
  },
  title: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#ffffff',
    letterSpacing: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#A8C4E0',
    marginTop: 8,
  },
  form: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E3A5F',
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#333',
    backgroundColor: '#F9F9F9',
  },
  button: {
    backgroundColor: '#1E3A5F',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },

  // Botón tracking
  trackingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 12,
    padding: 16,
    marginTop: 24,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  trackingIcon: { fontSize: 20 },
  trackingText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  trackingHint: {
    color: '#A8C4E0',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
  },
})