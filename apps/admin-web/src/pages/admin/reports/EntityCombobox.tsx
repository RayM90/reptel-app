import { useEffect, useId, useState } from 'react'

export interface ComboOption { id: string; label: string; sub?: string }

interface Props {
  label: string
  placeholder: string
  selectedLabel: string
  onSelect: (opt: ComboOption) => void
  onClear: () => void
  search: (q: string) => Promise<ComboOption[]>
}

export default function EntityCombobox({ label, placeholder, selectedLabel, onSelect, onClear, search }: Props) {
  const id = useId()
  const [query, setQuery] = useState('')
  const [options, setOptions] = useState<ComboOption[]>([])
  const [active, setActive] = useState(0)

  useEffect(() => {
    if (query.trim().length < 2) { setOptions([]); return }
    const t = setTimeout(() => { search(query).then((r) => { setOptions(r); setActive(0) }).catch(() => setOptions([])) }, 250)
    return () => clearTimeout(t)
  }, [query, search])

  const choose = (opt: ComboOption) => { onSelect(opt); setQuery(''); setOptions([]) }

  if (selectedLabel) {
    return (
      <div className="form-group">
        <span className="form-label" id={`${id}-l`}>{label}</span>
        <span className="chip" aria-labelledby={`${id}-l`}>
          {selectedLabel}
          <button type="button" onClick={onClear} aria-label={`Quitar filtro de ${label.toLowerCase()}`}>✕</button>
        </span>
      </div>
    )
  }

  return (
    <div className="form-group" style={{ position: 'relative' }}>
      <label htmlFor={`${id}-i`}>{label}</label>
      <input
        id={`${id}-i`}
        type="text"
        role="combobox"
        aria-expanded={options.length > 0}
        aria-controls={`${id}-list`}
        aria-activedescendant={options.length ? `${id}-o${active}` : undefined}
        aria-autocomplete="list"
        placeholder={placeholder}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (!options.length) return
          if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => (a + 1) % options.length) }
          if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => (a - 1 + options.length) % options.length) }
          if (e.key === 'Enter') { e.preventDefault(); choose(options[active]) }
          if (e.key === 'Escape') setOptions([])
        }}
      />
      {options.length > 0 && (
        <ul className="autocomplete-list" role="listbox" id={`${id}-list`}>
          {options.map((o, i) => (
            <li key={o.id} id={`${id}-o${i}`} role="option" aria-selected={i === active}
              onMouseDown={(e) => { e.preventDefault(); choose(o) }}>
              {o.label}{o.sub ? ` — ${o.sub}` : ''}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
