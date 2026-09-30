import { useCallback, useEffect, useState } from 'react'
import { api } from '../../../services/api'
import KpiRow from './KpiRow'
import SectionState from './SectionState'
import PartsSection from './PartsSection'
import OrdersSection from './OrdersSection'
import { useReportFilters } from './useReportFilters'
import { formatDay, formatRange } from './dateRange'
import type { ClientHistory, PartsReport, PendingReport, PeriodReport } from './reports.types'
import { formatFullName } from '../../../utils/formatName'

const money = (n: number) => `$${n.toFixed(2)}`

export default function PeriodTab() {
  const { filters, apiParams } = useReportFilters()
  const [period, setPeriod] = useState<PeriodReport | null>(null)
  const [parts, setParts] = useState<PartsReport | null>(null)
  const [pending, setPending] = useState<PendingReport | null>(null)
  const [history, setHistory] = useState<ClientHistory | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState({ period: '', parts: '' })
  const paramsKey = JSON.stringify(apiParams(true))
  const rangeLabel = formatRange(filters.from, filters.to)

  const load = useCallback(async () => {
    setLoading(true)
    const params = JSON.parse(paramsKey)
    const { from: _from, to: _to, clientId: _clientId, ...noDates } = params
    const [p, r, q] = await Promise.allSettled([
      api.get('/api/reports/period', { params }),
      api.get('/api/reports/parts', { params }),
      api.get('/api/reports/pending', { params: noDates }),
    ])
    setPeriod(p.status === 'fulfilled' ? p.value.data.data : null)
    setParts(r.status === 'fulfilled' ? r.value.data.data : null)
    setPending(q.status === 'fulfilled' ? q.value.data.data : null)
    setError({
      period: p.status === 'rejected' ? 'No se pudo cargar el resumen del período.' : '',
      parts: r.status === 'rejected' ? 'No se pudieron cargar los repuestos.' : '',
    })
    setLoading(false)
  }, [paramsKey])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!filters.cliCedula) { setHistory(null); return }
    api.get(`/api/reports/client-history/${encodeURIComponent(filters.cliCedula)}`)
      .then((r) => setHistory(r.data.data)).catch(() => setHistory(null))
  }, [filters.cliCedula])

  return (
    <>
      <p className="print-only form-hint">Reporte del {rangeLabel}</p>
      <KpiRow loading={loading} items={[
        { label: 'Cobrado', value: money(period?.money.total ?? 0), detail: period ? `Revisión y delivery ${money(period.money.revision)} · Reparación ${money(period.money.repair)}` : undefined },
        { label: 'Equipos', value: `${period?.activity.received ?? 0} entraron · ${period?.activity.delivered ?? 0} salieron` },
        { label: 'Por cobrar al día de hoy', value: money(pending?.toCollect.total ?? 0), detail: pending ? `${pending.toCollect.pendingConfirmation.count + pending.toCollect.balanceDue.count} órdenes` : undefined },
      ]} />

      {history && (
        <section className="card">
          <h2 style={{ marginTop: 0 }}>Expediente de {formatFullName(history.client.name, history.client.lastName)} <span className="form-hint">(todas las fechas)</span></h2>
          <p>{history.client.idNumber} · {history.client.phone} · Equipos ingresados: <strong>{history.devicesIngresados}</strong> · Total pagado: <strong>{money(history.totalPaid)}</strong> · Posibles garantías (equipo que volvió antes de 30 días): <strong>{history.possibleWarrantyCases.length}</strong></p>
        </section>
      )}

      <section className="card">
        <h2 style={{ marginTop: 0 }}>Actividad por día</h2>
        <SectionState loading={loading} error={error.period} onRetry={load} empty={!period?.daily.length} emptyText={`Sin movimiento (${rangeLabel}). Prueba otro rango.`}>
          <div className="table-wrapper">
            <table className="styled-table">
              <thead><tr>
                <th scope="col">Día</th><th scope="col">Entraron</th><th scope="col">Entregadas</th>
                <th scope="col" className="money">Cobrado</th><th scope="col">Repuestos</th><th scope="col" className="money">Repuestos $</th>
              </tr></thead>
              <tbody>
                {period?.daily.map((d) => (
                  <tr key={d.day}>
                    <td data-label="Día">{formatDay(d.day)}</td>
                    <td data-label="Entraron">{d.received}</td>
                    <td data-label="Entregadas">{d.delivered}</td>
                    <td className="money" data-label="Cobrado">{money(d.collected)}</td>
                    <td data-label="Repuestos">{d.partsUnits}</td>
                    <td className="money" data-label="Repuestos $">{money(d.partsAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionState>
      </section>

      <section className="card">
        <h2 style={{ marginTop: 0 }}>Dinero</h2>
        <SectionState loading={loading} error={error.period} onRetry={load} empty={!period || period.money.total === 0} emptyText={`No se confirmaron pagos (${rangeLabel}).`}>
          {period && (
            <dl className="money-breakdown">
              <dt>Revisión y delivery</dt><dd className="money">{money(period.money.revision)}</dd>
              <dt>Reparación y pago final</dt><dd className="money">{money(period.money.repair)}</dd>
              <dt>Mostrador</dt><dd className="money">{money(period.money.byChannel.WEB)}</dd>
              <dt>App</dt><dd className="money">{money(period.money.byChannel.APK)}</dd>
            </dl>
          )}
          <p className="form-hint">Cuenta los pagos que confirmaste en este período, por la fecha de confirmación.</p>
        </SectionState>
      </section>

      <PartsSection data={parts} loading={loading} error={error.parts} onRetry={load} rangeLabel={rangeLabel} />

      <section className="card">
        <h2 style={{ marginTop: 0 }}>Técnicos</h2>
        <SectionState loading={loading} error={error.period} onRetry={load} empty={!period?.technicians.length} emptyText={`Ningún técnico entregó órdenes (${rangeLabel}).`}>
          <div className="table-wrapper">
            <table className="styled-table">
              <thead><tr><th scope="col">Técnico</th><th scope="col">Entregadas</th><th scope="col">Días promedio</th><th scope="col" className="money">Comisión</th></tr></thead>
              <tbody>
                {period?.technicians.map((t) => (
                  <tr key={t.technicianId}>
                    <td data-label="Técnico">{t.technicianName}</td>
                    <td data-label="Entregadas">{t.delivered}</td>
                    <td data-label="Días promedio">{t.avgDays ?? '—'}</td>
                    <td className="money" data-label="Comisión">{money(t.commission)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionState>
      </section>

      <OrdersSection />
    </>
  )
}
