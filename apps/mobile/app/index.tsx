import { useEffect } from 'react'
import { View, ActivityIndicator } from 'react-native'
import { router } from 'expo-router'
import { useAuthStore } from '../src/store/auth.store'

export default function Index() {
  const { isAuthenticated } = useAuthStore()

  useEffect(() => {
    setTimeout(() => {
      if (!isAuthenticated) {
        // Sin sesión → pantalla de bienvenida
        router.replace('/welcome')
      } else {
        // Con sesión → home del cliente
        router.replace('/(client)/home-client')
      }
    }, 500)
  }, [isAuthenticated])

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center',
                   backgroundColor: '#1a73e8' }}>
      <ActivityIndicator size="large" color="#ffffff" />
    </View>
  )
}