import { View, Text, StyleSheet } from 'react-native'
import { colors } from '../theme/colors'
import type { ProgressStep } from '../utils/orderProgress'

const formatStepDate = (iso: string) =>
  new Date(iso).toLocaleString('es-VE', { day: 'numeric', month: 'numeric', hour: 'numeric', minute: '2-digit' })

const MARKER: Record<ProgressStep['state'], string> = {
  done: '✓',
  rejected: '✕',
  current: '',
  pending: '',
}

export default function OrderProgress({ steps }: { steps: ProgressStep[] }) {
  return (
    <View style={styles.container}>
      {steps.map((step, i) => {
        const isLast = i === steps.length - 1
        return (
          <View key={step.label} style={styles.row}>
            <View style={styles.rail}>
              <View style={[styles.dot, dotStyle[step.state]]}>
                <Text style={styles.dotMark}>{MARKER[step.state]}</Text>
              </View>
              {!isLast && (
                <View style={[styles.line, step.state === 'done' || step.state === 'rejected' ? styles.lineDone : null]} />
              )}
            </View>
            <View style={styles.body}>
              <Text style={[styles.label, labelStyle[step.state]]}>{step.label}</Text>
              {step.state === 'current' && <Text style={styles.hereTag}>Estás aquí</Text>}
              {step.date && step.state !== 'pending' && (
                <Text style={styles.date}>{formatStepDate(step.date)}</Text>
              )}
            </View>
          </View>
        )
      })}
    </View>
  )
}

const DOT = 22

const styles = StyleSheet.create({
  container: { marginBottom: 12, marginTop: 4 },
  row: { flexDirection: 'row' },
  rail: { width: DOT, alignItems: 'center' },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  dotMark: { color: colors.onPrimary, fontSize: 12, fontWeight: '700' },
  line: { flex: 1, width: 2, minHeight: 18, backgroundColor: colors.border },
  lineDone: { backgroundColor: colors.success },
  body: { flex: 1, marginLeft: 12, paddingBottom: 14, paddingTop: 1 },
  label: { fontSize: 13, lineHeight: 18 },
  hereTag: { fontSize: 11, color: colors.secondary, fontWeight: '700', marginTop: 2 },
  date: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
})

const dotStyle = StyleSheet.create({
  done: { backgroundColor: colors.success, borderColor: colors.success },
  rejected: { backgroundColor: colors.danger, borderColor: colors.danger },
  current: { backgroundColor: colors.surface, borderColor: colors.secondary, borderWidth: 6 },
  pending: { backgroundColor: colors.surface, borderColor: colors.border },
})

const labelStyle = StyleSheet.create({
  done: { color: colors.text, fontWeight: '600' },
  rejected: { color: colors.danger, fontWeight: '600' },
  current: { color: colors.secondary, fontWeight: '700' },
  pending: { color: colors.textMuted },
})
