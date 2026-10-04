import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'

// Encabezado de las pantallas del cliente: respeta el área segura (notch /
// isla del iPhone) y mantiene los estilos de texto que ya usaban.
interface ScreenHeaderProps {
  backLabel?: string
  onBack?: () => void
  step?: string
  title: string
  subtitle?: string
}

export default function ScreenHeader({ backLabel, onBack, step, title, subtitle }: ScreenHeaderProps) {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  return (
    <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
      {backLabel && (
        <TouchableOpacity
          onPress={onBack ?? (() => router.back())}
          style={styles.backBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.backText}>{backLabel}</Text>
        </TouchableOpacity>
      )}
      {step && <Text style={styles.step}>{step}</Text>}
      <Text style={styles.title}>{title}</Text>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
    </View>
  )
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 22, paddingBottom: 16 },
  backBtn: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  backText: { color: '#5364ad', fontSize: 14, fontWeight: '500' },
  step: { fontSize: 12, fontWeight: '700', color: '#5364ad', letterSpacing: 0.4, marginBottom: 2 },
  title: { fontSize: 26, fontWeight: '800', color: '#17247a', marginBottom: 2 },
  subtitle: { fontSize: 14, color: '#5364ad', lineHeight: 20 },
})
