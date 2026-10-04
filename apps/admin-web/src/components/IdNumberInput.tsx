const PREFIXES = ['V', 'E', 'J', 'G']
const COMPANY_PREFIXES = ['J', 'G']
const MAX_DIGITS = 9

// J- (jurídico/empresa) y G- (gobierno) no tienen apellido — Registro.tsx
// lo usa para adaptar labels y campos requeridos.
export const isCompanyIdPrefix = (idNumber: string): boolean =>
  COMPANY_PREFIXES.some((p) => idNumber.startsWith(`${p}-`))

interface IdNumberInputProps {
  value: string
  onChange: (value: string) => void
  required?: boolean
  disabled?: boolean
  prefixes?: string[]
  maxDigits?: number
}

// Cédula/RIF venezolano: select de prefijo (V/E persona natural, J/G jurídico
// o gobierno) + input solo de dígitos, limitado a 9 (RIF es el caso más largo).
export default function IdNumberInput({ value, onChange, required, disabled, prefixes = PREFIXES, maxDigits = MAX_DIGITS }: IdNumberInputProps) {
  const knownPrefix = prefixes.find((p) => value.startsWith(`${p}-`))
  const prefix = knownPrefix ?? prefixes[0]
  const digits = knownPrefix ? value.slice(2) : value.replace(/\D/g, '').slice(0, maxDigits)

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
        {prefixes.map((p) => (
          <option key={p} value={p}>{p}</option>
        ))}
      </select>
      <input
        type="text"
        inputMode="numeric"
        value={digits}
        maxLength={maxDigits}
        placeholder="12345678"
        onChange={(e) => emit(prefix, e.target.value.replace(/\D/g, '').slice(0, maxDigits))}
        required={required}
        disabled={disabled}
      />
    </div>
  )
}
