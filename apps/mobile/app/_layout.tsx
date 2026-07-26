import { useEffect } from 'react'
import { Stack, router } from 'expo-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StatusBar } from 'expo-status-bar'
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native'
import { useAuthStore } from '../src/store/auth.store'
import Toast from '../src/components/Toast'
import ConfirmDialog from '../src/components/ConfirmDialog'

const queryClient = new QueryClient()

// ── Botón atrás personalizado ────────────────────────────────────
function BackButton() {
  return (
    <TouchableOpacity style={styles.headerBtn} onPress={() => router.back()}>
      <Text style={styles.headerBtnText}>← Atrás</Text>
    </TouchableOpacity>
  )
}

// ── Botón home ───────────────────────────────────────────────────
function HomeButton() {
  const { logout } = useAuthStore()

  const handleHome = () => {
    logout()
    router.replace('/welcome')
  }

  return (
    <TouchableOpacity style={styles.headerBtn} onPress={handleHome}>
      <Text style={styles.headerBtnText}>🏠 Inicio</Text>
    </TouchableOpacity>
  )
}

export default function RootLayout() {
  useEffect(() => {
    if (useAuthStore.persist.hasHydrated()) {
      useAuthStore.getState().resumeSession()
    } else {
      const unsubscribe = useAuthStore.persist.onFinishHydration(() => {
        useAuthStore.getState().resumeSession()
      })
      return unsubscribe
    }
  }, [])

  return (
    <QueryClientProvider client={queryClient}>
      {/* View envolvente para que Toast y ConfirmDialog puedan superponerse
          sobre cualquier pantalla de la app, sin depender de cada Screen. */}
      <View style={{ flex: 1 }}>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: true,
            headerStyle: { backgroundColor: '#1a73e8' },
            headerTintColor: '#fff',
            headerTitleStyle: { fontWeight: 'bold', color: '#fff' },
            headerLeft: () => <BackButton />,
            headerRight: () => <HomeButton />,
          }}
        >
          {/* Pantallas SIN header */}
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="welcome" options={{ headerShown: false }} />

          {/* Pantallas de auth SIN header */}
          <Stack.Screen name="(auth)/login" options={{ headerShown: false }} />
          <Stack.Screen name="(auth)/register" options={{ headerShown: false }} />

          {/* Home del cliente — controla su propio header internamente */}
          <Stack.Screen name="(client)/home-client" options={{ headerShown: false }} />
        </Stack>

        <Toast />
        <ConfirmDialog />
      </View>
    </QueryClientProvider>
  )
}

const styles = StyleSheet.create({
  headerBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  headerBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
})