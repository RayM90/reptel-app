import { ReactNode } from 'react'
import { View, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

// Contenedor del botón principal fijo al pie de la pantalla (fuera del
// ScrollView), siempre a mano y por encima del indicador de inicio del iPhone.
export default function StickyFooter({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets()
  return <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) + 4 }]}>{children}</View>
}

const styles = StyleSheet.create({
  footer: { paddingHorizontal: 22, paddingTop: 10 },
})
