const DEFAULT_PREFIXES = ['V', 'E', 'J', 'G']
const DEFAULT_MAX_DIGITS = 9

interface IdNumberInputProps {
  value: string
  onChange: (value: string) => void
  required?: boolean
  disabled?: boolean
  /** Prefijos permitidos en el <select>. Default: V/E/J/G (caso general — cliente). */
  prefixes?: readonly string[]
  /** Mínimo de dígitos exigido (HTML minLength). Default: sin mínimo. */
  minDigits?: number
  /** Máximo de dígitos aceptado. Default: 9 (caso más largo, RIF jurídico). */
  maxDigits?: number
}

// Cédula/RIF venezolano: select de prefijo (V/E persona natural, J/G jurídico
// o gobierno) + input solo de dígitos. `prefixes`/`minDigits`/`maxDigits` permiten
// que un formulario más estricto (ej. personal: solo V/E, 7-8 dígitos) reutilice
// este mismo componente sin afectar a quienes lo usan con el rango general (cliente).
export default function IdNumberInput({
  value,
  onChange,
  required,
  disabled,
  prefixes = DEFAULT_PREFIXES,
  minDigits,
  maxDigits = DEFAULT_MAX_DIGITS,
}: IdNumberInputProps) {
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
        minLength={minDigits}
        maxLength={maxDigits}
        placeholder="12345678"
        onChange={(e) => emit(prefix, e.target.value.replace(/\D/g, '').slice(0, maxDigits))}
        required={required}
        disabled={disabled}
      />
    </div>
  )
}
