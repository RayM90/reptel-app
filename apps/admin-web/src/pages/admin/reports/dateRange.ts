export type Preset = 'hoy' | 'semana' | 'mes' | 'personalizado'

const pad = (n: number) => String(n).padStart(2, '0')

// Fecha del calendario local (Venezuela). toISOString() la pasaba a UTC y
// después de las 20:00 "Hoy" mostraba el día siguiente.
export function toInputDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function presetRange(preset: Exclude<Preset, 'personalizado'>, now = new Date()): { from: string; to: string } {
  if (preset === 'hoy') return { from: toInputDate(now), to: toInputDate(now) }
  if (preset === 'semana') {
    const monday = new Date(now)
    monday.setDate(now.getDate() - ((now.getDay() + 6) % 7))
    const sunday = new Date(monday)
    sunday.setDate(monday.getDate() + 6)
    return { from: toInputDate(monday), to: toInputDate(sunday) }
  }
  const first = new Date(now.getFullYear(), now.getMonth(), 1)
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  return { from: toInputDate(first), to: toInputDate(last) }
}

const parseDay = (day: string) => {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function formatDay(day: string): string {
  return parseDay(day).toLocaleDateString('es-VE', { weekday: 'short', day: 'numeric', month: 'short' })
}

export function formatRange(from: string, to: string): string {
  if (from === to) return parseDay(from).toLocaleDateString('es-VE', { day: 'numeric', month: 'long', year: 'numeric' })
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }
  return `${parseDay(from).toLocaleDateString('es-VE', opts)} – ${parseDay(to).toLocaleDateString('es-VE', { ...opts, year: 'numeric' })}`
}
