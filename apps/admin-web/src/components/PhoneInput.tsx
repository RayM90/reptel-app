import { PHONE_PREFIXES, PHONE_DIGITS_LENGTH } from '../constants/venezuela'

interface PhoneInputProps {
  value: string
  onChange: (value: string) => void
  required?: boolean
}

// Teléfono venezolano: select de prefijo de operadora (0412/0414/0416/0424/0426)
// + input solo de dígitos con el límite correcto (prefijo + 7 dígitos = 11 total).
// `value` siempre se maneja como el string completo (ej. "04121234567") para no
// cambiar la forma en la que el resto del formulario/API espera el teléfono.
export default function PhoneInput({ value, onChange, required }: PhoneInputProps) {
  const knownPrefix = PHONE_PREFIXES.find((p) => value.startsWith(p))
  const prefix = knownPrefix ?? PHONE_PREFIXES[0]
  const digits = knownPrefix ? value.slice(4) : value.replace(/\D/g, '').slice(0, PHONE_DIGITS_LENGTH)

  // Si no hay dígitos todavía, el valor completo es '' — así un campo opcional
  // sin tocar no manda "0412" (prefijo solo) como si fuera un teléfono real.
  const emit = (nextPrefix: string, nextDigits: string) => onChange(nextDigits ? `${nextPrefix}${nextDigits}` : '')

  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <select
        value={prefix}
        onChange={(e) => emit(e.target.value, digits)}
        style={{ maxWidth: 90 }}
        required={required}
      >
        {PHONE_PREFIXES.map((p) => (
          <option key={p} value={p}>{p}</option>
        ))}
      </select>
      <input
        type="text"
        inputMode="numeric"
        value={digits}
        maxLength={PHONE_DIGITS_LENGTH}
        placeholder={'1'.repeat(PHONE_DIGITS_LENGTH)}
        onChange={(e) => emit(prefix, e.target.value.replace(/\D/g, '').slice(0, PHONE_DIGITS_LENGTH))}
        required={required}
      />
    </div>
  )
}
