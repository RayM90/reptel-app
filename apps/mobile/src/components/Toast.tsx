import { useEffect, useRef } from 'react'
import { Animated, StyleSheet, Text } from 'react-native'
import { useToastStore } from '../store/toast.store'

const COLORS = {
  success: { bg: '#dcfce7', text: '#15803d', border: '#86efac' },
  error: { bg: '#fee2e2', text: '#b91c1c', border: '#fca5a5' },
  info: { bg: '#e0e7ff', text: '#17247a', border: '#c7d2fe' },
}

export default function Toast() {
  const visible = useToastStore((state) => state.visible)
  const message = useToastStore((state) => state.message)
  const type = useToastStore((state) => state.type)
  const translateY = useRef(new Animated.Value(-120)).current

  useEffect(() => {
    Animated.timing(translateY, {
      toValue: visible ? 0 : -120,
      duration: 250,
      useNativeDriver: true,
    }).start()
  }, [visible])

  if (!message) return null

  const palette = COLORS[type]

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.container,
        {
          backgroundColor: palette.bg,
          borderColor: palette.border,
          transform: [{ translateY }],
        },
      ]}
    >
      <Text style={[styles.text, { color: palette.text }]}>{message}</Text>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 50,
    left: 16,
    right: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    paddingVertical: 14,
    paddingHorizontal: 16,
    zIndex: 9999,
    elevation: 10,
  },
  text: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
})