const PREFIXES = ['V', 'E', 'J', 'G']
const MAX_DIGITS = 9

interface IdNumberInputProps {
  value: string
  onChange: (value: string) => void
  required?: boolean
  disabled?: boolean
}

// Cédula/RIF venezolano: select de prefijo (V/E persona natural, J/G jurídico
// o gobierno) + input solo de dígitos, limitado a 9 (RIF es el caso más largo).
export default function IdNumberInput({ value, onChange, required, disabled }: IdNumberInputProps) {
  const knownPrefix = PREFIXES.find((p) => value.startsWith(`${p}-`))
  const prefix = knownPrefix ?? PREFIXES[0]
  const digits = knownPrefix ? value.slice(2) : value.replace(/\D/g, '').slice(0, MAX_DIGITS)

  const emit = (nextPrefix: string, nextDigits: string) => onChange(nextDigits ? `${nextPrefix}-${nextDigits}` : '')

  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <select
        value={prefix}
        onChange={(e) => emit(e.target.value, digits)}
        style={{ maxWidth: 70 }}
        required={required}
        disabled={disabled}
      >
        {PREFIXES.map((p) => (
          <option key={p} value={p}>{p}</option>
        ))}
      </select>
      <input
        type="text"
        inputMode="numeric"
        value={digits}
        maxLength={MAX_DIGITS}
        placeholder="12345678"
        onChange={(e) => emit(prefix, e.target.value.replace(/\D/g, '').slice(0, MAX_DIGITS))}
        required={required}
        disabled={disabled}
      />
    </div>
  )
}
