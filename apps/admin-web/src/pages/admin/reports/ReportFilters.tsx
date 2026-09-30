import { useCallback, useEffect, useState } from 'react'
import { api } from '../../../services/api'
import { formatFullName } from '../../../utils/formatName'
import EntityCombobox, { type ComboOption } from './EntityCombobox'
import { useReportFilters } from './useReportFilters'
import { formatRange, presetRange, type Preset } from './dateRange'
import type { Technician, ClientSearchResult } from './reports.types'

const PRESETS: { key: Preset; label: string }[] = [
  { key: 'hoy', label: 'Hoy' }, { key: 'semana', label: 'Esta semana' }, { key: 'mes', label: 'Este mes' }, { key: 'personalizado', label: 'Personalizado' },
]
const CHANNEL_LABEL = { WEB: 'Mostrador', APK: 'App' } as const

export default function ReportFilters({ mode }: { mode: 'hoy' | 'periodo' }) {
  const { filters, update, clearAll } = useReportFilters()
  const [technicians, setTechnicians] = useState<Technician[]>([])
  const [draft, setDraft] = useState({ from: filters.from, to: filters.to })

  useEffect(() => { api.get('/api/reports/technicians').then((r) => setTechnicians(r.data.data)).catch(() => setTechnicians([])) }, [])
  useEffect(() => { setDraft({ from: filters.from, to: filters.to }) }, [filters.from, filters.to])

  // Fechas personalizadas: se aplican solas 300 ms después del último cambio.
  useEffect(() => {
    if (filters.preset !== 'personalizado') return
    if (draft.from === filters.from && draft.to === filters.to) return
    if (!draft.from || !draft.to || draft.from > draft.to) return
    const t = setTimeout(() => update({ from: draft.from, to: draft.to }), 300)
    return () => clearTimeout(t)
  }, [draft, filters, update])

  const searchTechnicians = useCallback(async (q: string): Promise<ComboOption[]> => {
    const needle = q.toLowerCase()
    return technicians
      .filter((t) => t.name.toLowerCase().includes(needle) || (t.idNumber ?? '').toLowerCase().includes(needle))
      .slice(0, 10)
      .map((t) => ({ id: t.id, label: t.name, sub: t.idNumber ?? undefined }))
  }, [technicians])

  const searchClients = useCallback(async (q: string): Promise<ComboOption[]> => {
    const r = await api.get('/api/clients/search', { params: { q } })
    return (r.data.data as ClientSearchResult[]).map((c) => ({ id: c.id, label: formatFullName(c.name, c.lastName), sub: c.idNumber }))
  }, [])

  const choosePreset = (key: Preset) => {
    if (key === 'personalizado') update({ preset: key, from: filters.from, to: filters.to })
    else update({ preset: key, ...presetRange(key) })
  }

  const chips: { label: string; clear: () => void }[] = []
  if (filters.tec) chips.push({ label: `Técnico: ${filters.tecNombre}`, clear: () => update({ tec: '', tecNombre: '' }) })
  if (mode === 'periodo' && filters.cli) chips.push({ label: `Cliente: ${filters.cliNombre}`, clear: () => update({ cli: '', cliNombre: '', cliCedula: '' }) })
  if (filters.canal) chips.push({ label: `Canal: ${CHANNEL_LABEL[filters.canal]}`, clear: () => update({ canal: '' }) })

  return (
    <div className="card no-print">
      <div className="filter-bar">
        {mode === 'periodo' && (
          <div className="form-group">
            <span className="form-label">Período</span>
            <div className="segmented">
              {PRESETS.map((p) => (
                <button key={p.key} type="button" aria-pressed={filters.preset === p.key} onClick={() => choosePreset(p.key)}>{p.label}</button>
              ))}
            </div>
          </div>
        )}
        {mode === 'periodo' && filters.preset === 'personalizado' && (
          <>
            <div className="form-group">
              <label htmlFor="rep-from">Desde</label>
              <input id="rep-from" type="date" value={draft.from} max={draft.to} onChange={(e) => setDraft((d) => ({ ...d, from: e.target.value }))} />
            </div>
            <div className="form-group">
              <label htmlFor="rep-to">Hasta</label>
              <input id="rep-to" type="date" value={draft.to} min={draft.from} onChange={(e) => setDraft((d) => ({ ...d, to: e.target.value }))} />
            </div>
          </>
        )}
        <EntityCombobox label="Técnico" placeholder="Nombre o cédula…" selectedLabel={filters.tecNombre}
          search={searchTechnicians} onSelect={(o) => update({ tec: o.id, tecNombre: o.label })} onClear={() => update({ tec: '', tecNombre: '' })} />
        {mode === 'periodo' && (
          <EntityCombobox label="Cliente" placeholder="Nombre o cédula/RIF…" selectedLabel={filters.cliNombre}
            search={searchClients} onSelect={(o) => update({ cli: o.id, cliNombre: o.label, cliCedula: o.sub ?? '' })}
            onClear={() => update({ cli: '', cliNombre: '', cliCedula: '' })} />
        )}
        <div className="form-group">
          <label htmlFor="rep-canal">Canal</label>
          <select id="rep-canal" value={filters.canal} onChange={(e) => update({ canal: e.target.value as '' | 'WEB' | 'APK' })}>
            <option value="">Mostrador y App</option>
            <option value="WEB">Solo Mostrador</option>
            <option value="APK">Solo App</option>
          </select>
        </div>
      </div>
      <p className="filter-chips" aria-live="polite">
        <span>{mode === 'periodo' ? `Mostrando: ${formatRange(filters.from, filters.to)}` : 'Mostrando: hoy y pendientes al momento'}</span>
        {chips.map((c) => (
          <span key={c.label} className="chip">{c.label}<button type="button" onClick={c.clear} aria-label={`Quitar ${c.label}`}>✕</button></span>
        ))}
        {chips.length > 1 && <button type="button" className="btn btn-outline" onClick={clearAll}>Limpiar filtros</button>}
      </p>
    </div>
  )
}
