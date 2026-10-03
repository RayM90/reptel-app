import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { router } from 'expo-router'
import { useAuthStore } from '../store/auth.store'
import { useIdleLogout } from '../hooks/useIdleLogout'
import { colors } from '../theme/colors'
import { fonts } from '../theme/fonts'

const IDLE_MS = 30 * 60_000 // 30 min sin tocar la pantalla
const WARN_MS = 60_000      // 60 s de aviso

export default function IdleWarning() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const logout = useAuthStore((s) => s.logout)
  const close = () => { logout(); router.replace('/welcome') }
  const { warning, secondsLeft, stay } = useIdleLogout({ enabled: isAuthenticated, idleMs: IDLE_MS, warnMs: WARN_MS, onTimeout: close })

  return (
    <Modal visible={warning} transparent animationType="fade" onRequestClose={stay}>
      <View style={styles.overlay}>
        <View style={styles.box} accessibilityRole="alert">
          <Text style={styles.title}>¿Sigues ahí?</Text>
          <Text style={styles.message}>Por seguridad, la sesión se cerrará en {secondsLeft} s si no hay actividad.</Text>
          <TouchableOpacity style={styles.primary} onPress={stay} accessibilityRole="button">
            <Text style={styles.primaryText}>Seguir conectado</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondary} onPress={close} accessibilityRole="button">
            <Text style={styles.secondaryText}>Cerrar sesión</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(23,23,29,0.55)', justifyContent: 'center', padding: 24 },
  box: { backgroundColor: colors.surface, borderRadius: 16, padding: 24 },
  title: { fontFamily: fonts.headingSemiBold, fontSize: 22, color: colors.primary, marginBottom: 8 },
  message: { fontFamily: fonts.bodyRegular, fontSize: 15, color: colors.textMuted, marginBottom: 20, lineHeight: 21 },
  primary: { backgroundColor: colors.secondary, borderRadius: 10, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  primaryText: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.onPrimary },
  secondary: { minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  secondaryText: { fontFamily: fonts.bodySemiBold, fontSize: 15, color: colors.danger },
})
