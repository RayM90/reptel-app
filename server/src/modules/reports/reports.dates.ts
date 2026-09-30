// Venezuela usa UTC-4 todo el año (sin horario de verano). Los filtros de
// Reportes mandan días "YYYY-MM-DD" del calendario local: antes se parseaban
// como medianoche UTC y el rango quedaba corrido 4 horas hacia atrás (un
// filtro de un solo día buscaba entre las 20:00 y las 23:59 del día anterior).
const VE_OFFSET = '-04:00'
const VE_OFFSET_MS = 4 * 60 * 60 * 1000
const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/

export const parseVenezuelaDay = (day: string, edge: 'start' | 'end'): Date | null => {
  const match = DAY_RE.exec(day)
  if (!match) return null
  const [, y, m, d] = match.map(Number)
  const probe = new Date(Date.UTC(y, m - 1, d))
  if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== m - 1 || probe.getUTCDate() !== d) return null
  const time = edge === 'start' ? '00:00:00.000' : '23:59:59.999'
  return new Date(`${day}T${time}${VE_OFFSET}`)
}

export const venezuelaDayKey = (date: Date): string =>
  new Date(date.getTime() - VE_OFFSET_MS).toISOString().slice(0, 10)
