import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../../../services/api'
import { badgeClassName, getStatusBadge } from '../../../utils/statusBadge'
import SectionState from './SectionState'
import { useReportFilters } from './useReportFilters'
import { formatRange } from './dateRange'
import { STATUS_GROUPS, countByGroup, groupOf, matchesSearch, resolutionLabel, type GroupKey } from './ordersTable'
import type { AuditOrderRow } from './reports.types'

const money = (n: number) => `$${n.toFixed(2)}`
const date = (s: string | null) => (s ? new Date(s).toLocaleDateString('es-VE', { day: 'numeric', month: 'short' }) : '—')
const CHANNEL = { WEB: 'Mostrador', APK: 'App' } as const

export default function OrdersSection() {
  const { filters, update, apiParams } = useReportFilters()
  const [rows, setRows] = useState<AuditOrderRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [receiptError, setReceiptError] = useState('')
  const [search, setSearch] = useState(filters.q)
  const reqRef = useRef(0)
  // Sin `status`: se cargan todas las órdenes del período para que las
  // tarjetas cuenten sobre lo mismo que muestra la tabla.
  const paramsKey = JSON.stringify(apiParams(true))

  const load = useCallback(async () => {
    const id = ++reqRef.current
    setLoading(true)
    setError('')
    try {
      const r = await api.get('/api/reports/audit', { params: JSON.parse(paramsKey) })
      if (id !== reqRef.current) return
      setRows(r.data.data)
    } catch {
      if (id !== reqRef.current) return
      setError('No se pudieron cargar las órdenes.')
    } finally {
      if (id === reqRef.current) setLoading(false)
    }
  }, [paramsKey])

  useEffect(() => { load() }, [load])

  // La búsqueda se guarda en la URL 300 ms después de dejar de escribir.
  useEffect(() => { setSearch(filters.q) }, [filters.q])
  useEffect(() => {
    if (search === filters.q) return
    const t = setTimeout(() => update({ q: search }), 300)
    return () => clearTimeout(t)
  }, [search, filters.q, update])

  const searched = useMemo(() => rows.filter((o) => matchesSearch(o, filters.q)), [rows, filters.q])
  const counts = useMemo(() => countByGroup(searched), [searched])
  const visible = useMemo(() => searched.filter((o) =>
    (!filters.grupo || groupOf(o.status) === filters.grupo) && (!filters.estado || o.status === filters.estado),
  ), [searched, filters.grupo, filters.estado])

  const toggleGroup = (key: GroupKey) => update({ grupo: filters.grupo === key ? '' : key, estado: '' })

  const downloadReceipt = async (o: AuditOrderRow, type: 'intake' | 'final') => {
    setReceiptError('')
    try {
      const response = await api.get(`/api/orders/${o.orderId}/receipt/${type}`, { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }))
      const link = document.createElement('a')
      link.href = url
      link.download = `recibo-${type === 'intake' ? 'recepcion' : 'entrega'}-${o.orderNumber}.pdf`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch {
      setReceiptError(`No se pudo descargar el recibo de ${o.orderNumber}.`)
    }
  }

  const emptyText = filters.q || filters.grupo || filters.estado
    ? 'Ninguna orden coincide con la búsqueda o el estado elegido.'
    : `No se crearon órdenes (${formatRange(filters.from, filters.to)}).`

  return (
    <details className="card" open>
      <summary className="report-summary"><h2 style={{ display: 'inline', fontSize: 'inherit' }}>Órdenes creadas en el período</h2></summary>

      <div className="status-cards" role="group" aria-label="Filtrar por estado">
        {STATUS_GROUPS.map((g) => (
          <button key={g.key} type="button" className="status-card" aria-pressed={filters.grupo === g.key} onClick={() => toggleGroup(g.key)}>
            <span className="status-card-value">{loading ? '…' : counts[g.key]}</span>
            <span className="status-card-label">{g.label}</span>
          </button>
        ))}
      </div>

      <div className="filter-bar no-print" style={{ margin: '12px 0' }}>
        <div className="form-group">
          <label htmlFor="rep-buscar">Buscar</label>
          <input id="rep-buscar" type="search" placeholder="N° de orden o cédula/RIF…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="form-group">
          <label htmlFor="rep-estado">Estado</label>
          <select id="rep-estado" value={filters.estado} onChange={(e) => update({ estado: e.target.value, grupo: '' })}>
            <option value="">Todos los estados</option>
            {STATUS_GROUPS.map((g) => (
              <optgroup key={g.key} label={g.label}>
                {g.statuses.map((s) => <option key={s} value={s}>{getStatusBadge('order', s).label}</option>)}
              </optgroup>
            ))}
          </select>
        </div>
      </div>
      {receiptError && <p role="alert" className="form-hint">{receiptError}</p>}
      <SectionState loading={loading} error={error} onRetry={load} empty={visible.length === 0} emptyText={emptyText}>
        <div className="table-wrapper">
          <table className="styled-table orders-table">
            <thead><tr>
              <th scope="col">Orden</th><th scope="col">Creada</th><th scope="col">Entregada</th><th scope="col">Tiempo</th>
              <th scope="col">Cliente</th><th scope="col">Técnico</th><th scope="col">Estado</th><th scope="col">Canal</th>
              <th scope="col">Repuestos</th><th scope="col" className="money">Comisión</th><th scope="col" className="money">Monto</th>
              <th scope="col" className="no-print">Recibos</th>
            </tr></thead>
            <tbody>
              {visible.map((o) => {
                const badge = getStatusBadge('order', o.status)
                return (
                  <tr key={o.orderId}>
                    <td data-label="Orden" className="nowrap"><strong>{o.orderNumber}</strong></td>
                    <td data-label="Creada" className="nowrap">{date(o.receivedAt)}</td>
                    <td data-label="Entregada" className="nowrap">{date(o.deliveredAt)}</td>
                    <td data-label="Tiempo" className="nowrap">{resolutionLabel(o.receivedAt, o.deliveredAt)}</td>
                    <td data-label="Cliente">{o.clientName}<div className="form-hint nowrap">{o.clientIdNumber}</div></td>
                    <td data-label="Técnico">{o.technicianName}</td>
                    <td data-label="Estado"><span className={badgeClassName(badge.variant)}>{badge.label}</span></td>
                    <td data-label="Canal">{CHANNEL[o.channel]}</td>
                    <td data-label="Repuestos">
                      {o.partsUsed.length === 0 ? 'No' : o.partsUsed.map((p, i) => <div key={i}>{p.productName} ×{p.quantity} · {money(p.amount)}</div>)}
                    </td>
                    <td className="money" data-label="Comisión">{o.technicianCommission > 0 ? money(o.technicianCommission) : '—'}</td>
                    <td className="money" data-label="Monto">{money(o.totalAmount)}</td>
                    <td data-label="Recibos" className="no-print">
                      <div className="receipt-actions">
                        {o.status !== 'PENDING_PAYMENT' && <button className="btn btn-outline btn-compact" onClick={() => downloadReceipt(o, 'intake')}>Recepción</button>}
                        {o.status === 'DELIVERED' && <button className="btn btn-outline btn-compact" onClick={() => downloadReceipt(o, 'final')}>Entrega</button>}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </SectionState>
    </details>
  )
}
