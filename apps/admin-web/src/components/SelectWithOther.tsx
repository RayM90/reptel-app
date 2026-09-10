import { useState } from 'react'

const OTHER = '__OTRO__'

interface SelectWithOtherProps {
  value: string
  options: string[]
  onChange: (value: string) => void
  disabledPlaceholder?: string
}

// Select + opción "Otro" (revela un input de texto libre) — usado para
// marca, modelo (dependiente de marca), color y banco en los formularios
// de intake (Registro.tsx, y los de pago móvil/transferencia en mobile).
export default function SelectWithOther({ value, options, onChange, disabledPlaceholder }: SelectWithOtherProps) {
  const [otherMode, setOtherMode] = useState(() => value !== '' && !options.includes(value))

  if (otherMode) {
    return (
      <div style={{ display: 'flex', gap: 8 }}>
        <input type="text" value={value} onChange={(e) => onChange(e.target.value)} />
        <button type="button" className="btn btn-outline" onClick={() => { setOtherMode(false); onChange('') }}>
          Elegir de la lista
        </button>
      </div>
    )
  }

  if (disabledPlaceholder && options.length === 0) {
    return <select disabled><option>{disabledPlaceholder}</option></select>
  }

  return (
    <select
      value={value}
      onChange={(e) => {
        if (e.target.value === OTHER) {
          setOtherMode(true)
          onChange('')
        } else {
          onChange(e.target.value)
        }
      }}
    >
      <option value="">— Seleccionar —</option>
      {options.map((o) => (
        <option key={o} value={o}>{o}</option>
      ))}
      <option value={OTHER}>Otro</option>
    </select>
  )
}
