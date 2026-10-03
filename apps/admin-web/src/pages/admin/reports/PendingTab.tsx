import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../../../services/api'
import { badgeClassName, getStatusBadge } from '../../../utils/statusBadge'
import KpiRow from './KpiRow'
import SectionState from './SectionState'
import { useReportFilters } from './useReportFilters'
import { presetRange } from './dateRange'
import type { PeriodReport, PendingReport } from './reports.types'

const money = (n: number) => `$${n.toFixed(2)}`
const CHANNEL = { WEB: 'Mostrador', APK: 'App' } as const

export default function PendingTab() {
  const { filters, apiParams } = useReportFilters()
  const [today, setToday] = useState<PeriodReport | null>(null)
  const [pending, setPending] = useState<PendingReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState({ today: '', pending: '' })
  const reqRef = useRef(0)
  const paramsKey = JSON.stringify(apiParams(false))

  const load = useCallback(async () => {
    const id = ++reqRef.current
    setLoading(true)
    const base = JSON.parse(paramsKey)
    const [t, p] = await Promise.allSettled([
      api.get('/api/reports/period', { params: { ...base, ...presetRange('hoy') } }),
      api.get('/api/reports/pending', { params: base }),
    ])
    if (id !== reqRef.current) return
    setToday(t.status === 'fulfilled' ? t.value.data.data : null)
    setPending(p.status === 'fulfilled' ? p.value.data.data : null)
    setError({
      today: t.status === 'rejected' ? 'No se pudieron cargar los datos de hoy.' : '',
      pending: p.status === 'rejected' ? 'No se pudieron cargar los pendientes.' : '',
    })
    setLoading(false)
  }, [paramsKey])

  useEffect(() => { load() }, [load])

  const filterLine = ['Reporte de hoy y pendientes',
    filters.tecNombre && `Técnico: ${filters.tecNombre}`,
    filters.canal && `Canal: ${CHANNEL[filters.canal]}`].filter(Boolean).join(' · ')
  const totalOpen = pending?.groups.reduce((s, g) => s + g.count, 0) ?? 0

  return (
    <>
      <p className="print-only form-hint">{filterLine}</p>
      <KpiRow loading={loading} items={[
        { label: 'Cobrado hoy', value: money(today?.money.total ?? 0), failed: !today, detail: today ? `Revisión y delivery ${money(today.money.revision)} · Reparación ${money(today.money.repair)}` : undefined },
        { label: 'Equipos hoy', value: `${today?.activity.received ?? 0} / ${today?.activity.delivered ?? 0}`, failed: !today, detail: 'entraron / salieron' },
        { label: 'Por cobrar ahora', value: money(pending?.toCollect.total ?? 0), failed: !pending, detail: pending ? `${money(pending.toCollect.pendingConfirmation.amount)} por confirmar · ${money(pending.toCollect.balanceDue.amount)} sin pagar` : undefined },
      ]} />

      <section className="card">
        <h2 style={{ marginTop: 0 }}>Pendientes</h2>
        <SectionState loading={loading} error={error.pending} empty={totalOpen === 0} emptyText="Todo al día: no hay órdenes pendientes." onRetry={load}>
          {pending?.groups.map((g) => (
            <details key={g.key} className="pending-group" data-empty={g.count === 0} open={g.key === 'payment' && g.count > 0}>
              <summary aria-disabled={g.count === 0} onClick={(e) => { if (g.count === 0) e.preventDefault() }}>
                <span>{g.label}</span><span className="count">{g.count}</span>
              </summary>
              {g.count > 0 && (
                <div className="table-wrapper">
                  <table className="styled-table">
                    <thead><tr>
                      <th scope="col">Orden</th><th scope="col">Cliente</th><th scope="col">Técnico</th><th scope="col">Canal</th>
                      <th scope="col">Estado</th><th scope="col">Días abierta</th><th scope="col" className="money">Pendiente</th>
                    </tr></thead>
                    <tbody>
                      {g.orders.map((o) => (
                        <tr key={o.orderId}>
                          <td data-label="Orden" className="nowrap"><strong>{o.orderNumber}</strong></td>
                          <td data-label="Cliente">{o.clientName}</td>
                          <td data-label="Técnico">{o.technicianName}</td>
                          <td data-label="Canal">{CHANNEL[o.channel]}</td>
                          <td data-label="Estado"><span className={badgeClassName(getStatusBadge('order', o.status).variant)}>{getStatusBadge('order', o.status).label}</span></td>
                          <td data-label="Días abierta">{o.daysOpen}</td>
                          <td className="money" data-label="Pendiente">
                            {o.pendingConfirmation > 0 && <div>{money(o.pendingConfirmation)} por confirmar</div>}
                            {o.balanceDue > 0 && <div>{money(o.balanceDue)} sin pagar</div>}
                            {o.pendingConfirmation === 0 && o.balanceDue === 0 && '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </details>
          ))}
        </SectionState>
      </section>
    </>
  )
}
