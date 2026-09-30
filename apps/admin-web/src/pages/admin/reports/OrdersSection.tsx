import { useCallback, useEffect, useState } from 'react'
import { api } from '../../../services/api'
import { getStatusBadge } from '../../../utils/statusBadge'
import SectionState from './SectionState'
import { useReportFilters } from './useReportFilters'
import { formatRange } from './dateRange'
import type { AuditOrderRow } from './reports.types'

const STATUS_GROUPS = [
  { label: 'Por pagar o recibir', statuses: ['PENDING_PAYMENT', 'RECEIVED', 'ON_THE_WAY'] },
  { label: 'En revisión', statuses: ['DIAGNOSING', 'WAITING_APPROVAL'] },
  { label: 'En reparación', statuses: ['APPROVED', 'REPAIRING', 'WAITING_EXTRA_PAYMENT'] },
  { label: 'Listas y entregas', statuses: ['READY', 'PAID_PENDING_DELIVERY', 'DELIVERED'] },
  { label: 'Rechazadas o canceladas', statuses: ['REJECTED_PENDING_PICKUP', 'CANCELLED'] },
]
const money = (n: number) => `$${n.toFixed(2)}`
const date = (s: string | null) => (s ? new Date(s).toLocaleDateString('es-VE', { day: 'numeric', month: 'short' }) : '—')
const CHANNEL = { WEB: 'Mostrador', APK: 'App' } as const

export default function OrdersSection() {
  const { filters, update, apiParams } = useReportFilters()
  const [rows, setRows] = useState<AuditOrderRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [receiptError, setReceiptError] = useState('')
  const paramsKey = JSON.stringify({ ...apiParams(true), status: filters.estado || undefined })

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const r = await api.get('/api/reports/audit', { params: JSON.parse(paramsKey) })
      setRows(r.data.data)
    } catch {
      setError('No se pudieron cargar las órdenes.')
    } finally {
      setLoading(false)
    }
  }, [paramsKey])

  useEffect(() => { load() }, [load])

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

  return (
    <details className="card">
      <summary><h2 style={{ display: 'inline', fontSize: 'inherit' }}>Órdenes creadas en el período</h2></summary>
      <div className="filter-bar no-print" style={{ margin: '12px 0' }}>
        <div className="form-group">
          <label htmlFor="rep-estado">Estado</label>
          <select id="rep-estado" value={filters.estado} onChange={(e) => update({ estado: e.target.value })}>
            <option value="">Todos los estados</option>
            {STATUS_GROUPS.map((g) => (
              <optgroup key={g.label} label={g.label}>
                {g.statuses.map((s) => <option key={s} value={s}>{getStatusBadge('order', s).label}</option>)}
              </optgroup>
            ))}
          </select>
        </div>
      </div>
      {receiptError && <p role="alert" className="form-hint">{receiptError}</p>}
      <SectionState loading={loading} error={error} onRetry={load} empty={rows.length === 0}
        emptyText={`No se crearon órdenes ${filters.estado ? 'con ese estado ' : ''}(${formatRange(filters.from, filters.to)}).`}>
        <div className="table-wrapper">
          <table className="styled-table">
            <thead><tr>
              <th scope="col">Orden</th><th scope="col">Creada</th><th scope="col">Entregada</th><th scope="col">Cliente</th>
              <th scope="col">Técnico</th><th scope="col">Estado</th><th scope="col">Canal</th><th scope="col">Repuestos</th>
              <th scope="col" className="money">Monto</th><th scope="col" className="no-print">Recibos</th>
            </tr></thead>
            <tbody>
              {rows.map((o) => (
                <tr key={o.orderId}>
                  <td data-label="Orden">{o.orderNumber}</td>
                  <td data-label="Creada">{date(o.receivedAt)}</td>
                  <td data-label="Entregada">{date(o.deliveredAt)}</td>
                  <td data-label="Cliente">{o.clientName}<div className="form-hint">{o.clientIdNumber}</div></td>
                  <td data-label="Técnico">{o.technicianName}</td>
                  <td data-label="Estado">{getStatusBadge('order', o.status).label}</td>
                  <td data-label="Canal">{CHANNEL[o.channel]}</td>
                  <td data-label="Repuestos">
                    {o.partsUsed.length === 0 ? '—' : o.partsUsed.map((p, i) => <div key={i}>{p.productName} ×{p.quantity} · {money(p.amount)}</div>)}
                  </td>
                  <td className="money" data-label="Monto">{money(o.totalAmount)}</td>
                  <td data-label="Recibos" className="no-print">
                    {o.status !== 'PENDING_PAYMENT' && <button className="btn btn-outline" onClick={() => downloadReceipt(o, 'intake')}>Recepción</button>}{' '}
                    {o.status === 'DELIVERED' && <button className="btn btn-outline" onClick={() => downloadReceipt(o, 'final')}>Entrega</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionState>
    </details>
  )
}
