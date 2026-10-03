import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../../../services/api'
import KpiRow from './KpiRow'
import SectionState from './SectionState'
import { useReportFilters } from './useReportFilters'
import { formatDay, formatRange } from './dateRange'
import type { PartsDetail, PartUseStatus } from './reports.types'

const money = (n: number) => `$${n.toFixed(2)}`
const STATUS: Record<PartUseStatus, { label: string; className: string }> = {
  USED: { label: 'Usado', className: 'badge badge-success' },
  RETURNED: { label: 'Devuelto', className: 'badge' },
  LOSS: { label: 'Merma', className: 'badge badge-danger' },
}

export default function PartsTab() {
  const { filters, update, apiParams } = useReportFilters()
  const [data, setData] = useState<PartsDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const reqRef = useRef(0)
  const paramsKey = JSON.stringify(apiParams(true))
  const rangeLabel = formatRange(filters.from, filters.to)

  const load = useCallback(async () => {
    const id = ++reqRef.current
    setLoading(true)
    setError('')
    try {
      const r = await api.get('/api/reports/parts/detail', { params: JSON.parse(paramsKey) })
      if (id !== reqRef.current) return
      setData(r.data.data)
    } catch {
      if (id !== reqRef.current) return
      setData(null)
      setError('No se pudo cargar el detalle de repuestos.')
    } finally {
      if (id === reqRef.current) setLoading(false)
    }
  }, [paramsKey])

  useEffect(() => { load() }, [load])

  const products = useMemo(() => {
    const m = new Map<string, string>()
    data?.rows.forEach((r) => m.set(r.productId, r.productName))
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]))
  }, [data])
  const rows = useMemo(() => (data?.rows ?? []).filter((r) => !filters.rep || r.productId === filters.rep), [data, filters.rep])
  const used = rows.filter((r) => r.status === 'USED')
  const loss = rows.filter((r) => r.status === 'LOSS')
  const sum = (list: typeof rows, k: 'quantity' | 'amount') => list.reduce((t, r) => t + r[k], 0)

  return (
    <>
      <KpiRow loading={loading} items={[
        { label: 'Repuestos usados', value: `${sum(used, 'quantity')}`, failed: !data, detail: 'unidades instaladas en reparaciones' },
        { label: 'Cobrado en repuestos', value: money(sum(used, 'amount')), failed: !data, detail: 'a precio del momento' },
        { label: 'Mermas', value: `${sum(loss, 'quantity')}`, failed: !data, detail: `${money(sum(loss, 'amount'))} que no se cobraron` },
      ]} />

      <section className="card">
        <div className="section-head">
          <h2 style={{ margin: 0 }}>Uso de repuestos</h2>
          <div className="form-group no-print">
            <label htmlFor="rep-producto">Repuesto</label>
            <select id="rep-producto" value={filters.rep} onChange={(e) => update({ rep: e.target.value })}>
              <option value="">Todos los repuestos</option>
              {products.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </select>
          </div>
        </div>
        <SectionState loading={loading} error={error} onRetry={load} empty={rows.length === 0}
          emptyText={`No se cargaron repuestos a órdenes (${rangeLabel}).`}>
          <div className="table-wrapper">
            <table className="styled-table orders-table">
              <thead><tr>
                <th scope="col">Fecha</th><th scope="col">Repuesto</th><th scope="col">Cant.</th><th scope="col">Orden</th>
                <th scope="col">Técnico</th><th scope="col">Cliente</th><th scope="col" className="money">Precio</th><th scope="col">Estado</th>
              </tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.movementId}>
                    <td data-label="Fecha" className="nowrap">{formatDay(r.day)}</td>
                    <td data-label="Repuesto">{r.productName}</td>
                    <td data-label="Cant.">{r.quantity}</td>
                    <td data-label="Orden" className="nowrap"><strong>{r.orderNumber}</strong></td>
                    <td data-label="Técnico">{r.technicianName}</td>
                    <td data-label="Cliente">{r.clientName}</td>
                    <td data-label="Precio" className="money">{money(r.amount)}</td>
                    <td data-label="Estado"><span className={STATUS[r.status].className}>{STATUS[r.status].label}</span></td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="parts-total-row">
                  <td colSpan={2}>Total usado</td><td>{sum(used, 'quantity')}</td><td colSpan={3} />
                  <td className="money">{money(sum(used, 'amount'))}</td><td />
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="form-hint">Devuelto: se quitó de la orden y volvió al inventario. Merma: se dañó en manos del técnico y no se cobró.</p>
        </SectionState>
      </section>
    </>
  )
}
