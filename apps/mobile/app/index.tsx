import { useEffect } from 'react'
import { View, ActivityIndicator } from 'react-native'
import { router } from 'expo-router'
import { useAuthStore } from '../src/store/auth.store'

export default function Index() {
  const { isAuthenticated, user } = useAuthStore()

  useEffect(() => {
    setTimeout(() => {
      if (!isAuthenticated) {
        // Sin sesión → pantalla de bienvenida
        router.replace('/welcome')
      } else {
        // Con sesión → redirige según rol
        switch (user?.role) {
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