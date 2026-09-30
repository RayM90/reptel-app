import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { presetRange, type Preset } from './dateRange'

export interface ReportFilterState {
  tab: 'hoy' | 'periodo'
  preset: Preset
  from: string
  to: string
  tec: string
  tecNombre: string
  cli: string
  cliNombre: string
  cliCedula: string
  canal: '' | 'WEB' | 'APK'
  estado: string
}

const KEYS: (keyof ReportFilterState)[] = ['tab', 'preset', 'from', 'to', 'tec', 'tecNombre', 'cli', 'cliNombre', 'cliCedula', 'canal', 'estado']

export function useReportFilters() {
  const [params, setParams] = useSearchParams()

  const filters = useMemo<ReportFilterState>(() => {
    const preset = (params.get('preset') as Preset) || 'mes'
    const fallback = presetRange(preset === 'personalizado' ? 'mes' : preset)
    return {
      tab: params.get('tab') === 'periodo' ? 'periodo' : 'hoy',
      preset,
      // Los presets se recalculan siempre: un enlace de "Esta semana" guardado
      // la semana pasada muestra la semana actual.
      from: preset === 'personalizado' ? params.get('from') || fallback.from : fallback.from,
      to: preset === 'personalizado' ? params.get('to') || fallback.to : fallback.to,
      tec: params.get('tec') || '',
      tecNombre: params.get('tecNombre') || '',
      cli: params.get('cli') || '',
      cliNombre: params.get('cliNombre') || '',
      cliCedula: params.get('cliCedula') || '',
      canal: (params.get('canal') as '' | 'WEB' | 'APK') || '',
      estado: params.get('estado') || '',
    }
  }, [params])

  const update = useCallback((patch: Partial<ReportFilterState>) => {
    const next = { ...filters, ...patch }
    const out = new URLSearchParams()
    for (const key of KEYS) {
      const value = next[key]
      if (!value) continue
      if ((key === 'from' || key === 'to') && next.preset !== 'personalizado') continue
      out.set(key, value)
    }
    setParams(out, { replace: true })
  }, [filters, setParams])

  const clearAll = useCallback(() => update({ tec: '', tecNombre: '', cli: '', cliNombre: '', cliCedula: '', canal: '', estado: '' }), [update])

  const apiParams = useCallback((withDates: boolean) => {
    const p: Record<string, string> = {}
    if (withDates) { p.from = filters.from; p.to = filters.to }
    if (filters.tec) p.technicianId = filters.tec
    if (filters.cli && withDates) p.clientId = filters.cli
    if (filters.canal) p.channel = filters.canal
    return p
  }, [filters])

  return { filters, update, clearAll, apiParams }
}
