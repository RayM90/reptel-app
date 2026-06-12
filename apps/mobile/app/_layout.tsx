import { Stack, router } from 'expo-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StatusBar } from 'expo-status-bar'
import { TouchableOpacity, Text, StyleSheet } from 'react-native'
import { useAuthStore } from '../src/store/auth.store'

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
  return (
    <QueryClientProvider client={queryClient}>
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

        {/* Pantallas CON header */}
        <Stack.Screen name="(admin)/dashboard"
          options={{ title: 'Panel Principal', headerLeft: () => null }} />
        <Stack.Screen name="(admin)/orders"
          options={{ title: 'Órdenes' }} />
        <Stack.Screen name="(admin)/create-order"
          options={{ title: 'Nueva Orden' }} />
        <Stack.Screen name="(technician)/orders"
          options={{ title: 'Mis Órdenes' }} />
        <Stack.Screen name="(client)/tracking"
          options={{ title: 'Rastrear Equipo' }} />
      </Stack>
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