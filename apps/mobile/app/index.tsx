import { useEffect } from 'react'
import { View, ActivityIndicator } from 'react-native'
import { router } from 'expo-router'
import { useAuthStore } from '../src/store/auth.store'

export default function Index() {
  useEffect(() => {
    const navigate = () => {
      const { isAuthenticated } = useAuthStore.getState()
      if (isAuthenticated) {
        router.replace('/(client)/home-client')
      } else {
        router.replace('/welcome')
      }
    }

    if (useAuthStore.persist.hasHydrated()) {
      navigate()
    } else {
      const unsubscribe = useAuthStore.persist.onFinishHydration(navigate)
      return unsubscribe
    }
  }, [])

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center',
                   backgroundColor: '#23262F' }}>
      <ActivityIndicator size="large" color="#ffffff" />
    </View>
  )
}
