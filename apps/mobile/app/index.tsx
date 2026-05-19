import { useEffect } from 'react'
import { View, ActivityIndicator } from 'react-native'
import { router } from 'expo-router'
import { useAuthStore } from '../src/store/auth.store'

export default function Index() {
  const { isAuthenticated, user } = useAuthStore()

  useEffect(() => {
    setTimeout(() => {
      if (!isAuthenticated) {
        router.replace('/(auth)/login')
      } else {
        switch (user?.role) {
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
          default:
            router.replace('/(auth)/login')
        }
      }
    }, 500)
  }, [isAuthenticated])

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1E3A5F' }}>
      <ActivityIndicator size="large" color="#ffffff" />
    </View>
  )
}