import { useEffect, useState, Fragment } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../services/api'

interface TechnicianRow {
  technicianId: string
  technicianName: string
  ordersCount: number
  totalCommission: number
}

interface ServicioClientRow {
  clientId: string
  clientName: string
  ordersCount: number
  totalBudget: number
}

interface ClientSearchResult {
  id: string
  name: string
  lastName: string
  idNumber: string
}

interface ServicioOrderRow {
  orderId: string
  orderNumber: string
  clientName: string
  clientIdNumber: string
  technicianName: string
  deliveredAt: string | null
  budget: number
  technicianCommission: number
  channel: 'WEB' | 'APK'
}

interface ReportSummary {
  servicio: {
    totalBudget: number
    totalTechnicianCommission: number
    ordersCount: number
    byTechnician: TechnicianRow[]
    byClient: ServicioClientRow[]
    orders: ServicioOrderRow[]
  }
  mermas: { total: number; count: number }
}

interface Technician {
  id: string
  name: string
  idNumber: string | null
}

interface AuditOrderRow {
  orderId: string
  orderNumber: string
  receivedAt: string
  deliveredAt: string | null
  status: string
  channel: 'WEB' | 'APK'
  clientName: string
  clientIdNumber: string
  technicianName: string
  technicianCommission: number
  diagnosis: string | null
  totalAmount: number
  partsUsed: { productName: string; quantity: number }[]
}

interface ClientHistory {
  client: { id: string; name: string; lastName: string; idNumber: string; phone: string; email: string | null }
  devicesIngresados: number
  totalPaid: number
  activeOrders: { orderId: string; orderNumber: string; status: string; deviceId: string }[]
  possibleWarrantyCases: { orderId: string; orderNumber: string }[]
  history: {
    orderId: string
    orderNumber: string
    receivedAt: string
    deliveredAt: string | null
    status: string
    deviceLabel: string
    totalAmount: number
  }[]
}

const ORDER_STATUSES = [
  'PENDING_PAYMENT', 'RECEIVED', 'DIAGNOSING', 'WAITING_APPROVAL', 'APPROVED',
  'REPAIRING', 'WAITING_PART', 'READY', 'PAID_PENDING_DELIVERY',
  'REJECTED_PENDING_PICKUP', 'DELIVERED', 'CANCELLED',
]

function toInputDate(date: Date) {
  return date.toISOString().slice(0, 10)
}

function getWeekRange(date = new Date()) {
  const day = date.getDay()
  const diffToMonday = day === 0 ? -6 : 1 - day
  const monday = new Date(date)
  monday.setDate(date.getDate() + diffToMonday)
  const saturday = new Date(monday)
  saturday.setDate(monday.getDate() + 5)
  return { from: monday, to: saturday }
}

function getMonthRange(date = new Date()) {
  const from = new Date(date.getFullYear(), date.getMonth(), 1)
  const to = new Date(date.getFullYear(), date.getMonth() + 1, 0)
  return { from, to }
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('es-VE', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

export default function Reports() {
  const today = new Date()
  const [from, setFrom] = useState(toInputDate(today))
  const [to, setTo] = useState(toInputDate(today))
  const [status, setStatus] = useState('')
  const [channel, setChannel] = useState<'' | 'WEB' | 'APK'>('')

  const [technicians, setTechnicians] = useState<Technician[]>([])
  const [technicianQuery, setTechnicianQuery] = useState('')
  const [technicianId, setTechnicianId] = useState('')
  const [selectedTechnicianName, setSelectedTechnicianName] = useState('')

  const [clientQuery, setClientQuery] = useState('')
  const [clientResults, setClientResults] = useState<ClientSearchResult[]>([])
  const [clientId, setClientId] = useState('')
  const [selectedClientName, setSelectedClientName] = useState('')
  const [selectedClientIdNumber, setSelectedClientIdNumber] = useState('')

  const [data, setData] = useState<ReportSummary | null>(null)
  const [auditOrders, setAuditOrders] = useState<AuditOrderRow[]>([])
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null)
  const [clientHistory, setClientHistory] = useState<ClientHistory | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get('/api/reports/technicians').then((res) => setTechnicians(res.data.data))
  }, [])

  useEffect(() => {
    if (clientQuery.trim().length < 2) {
      setClientResults([])
      return
    }
    const timeout = setTimeout(() => {
      api.get('/api/clients/search', { params: { q: clientQuery } })
        .then((res) => setClientResults(res.data.data))
    }, 300)
    return () => clearTimeout(timeout)
  }, [clientQuery])

  useEffect(() => {
    if (!selectedClientIdNumber) {
      setClientHistory(null)
      return
    }
    api.get(`/api/reports/client-history/${encodeURIComponent(selectedClientIdNumber)}`)
      .then((res) => setClientHistory(res.data.data))
      .catch(() => setClientHistory(null))
  }, [selectedClientIdNumber])

  const technicianResults = technicianQuery.trim().length >= 2
    ? technicians.filter((t) =>
        t.name.toLowerCase().includes(technicianQuery.toLowerCase()) ||
        (t.idNumber ?? '').toLowerCase().includes(technicianQuery.toLowerCase())
      ).slice(0, 10)
    : []

  const selectClient = (client: ClientSearchResult) => {
    setClientId(client.id)
    setSelectedClientName(`${client.name} ${client.lastName}`)
    setSelectedClientIdNumber(client.idNumber)
    setClientQuery('')
    setClientResults([])
  }

  const clearClient = () => {
    setClientId('')
    setSelectedClientName('')
    setSelectedClientIdNumber('')
    setClientHistory(null)
  }

  const selectTechnician = (t: Technician) => {
    setTechnicianId(t.id)
    setSelectedTechnicianName(t.name)
    setTechnicianQuery('')
  }

  const clearTechnician = () => {
    setTechnicianId('')
    setSelectedTechnicianName('')
  }

  const fetchReports = async (
    fromDate: string, toDate: string, tech: string, client: string, st: string, ch: string
  ) => {
    setLoading(true)
    setError('')
    try {
      const [summaryRes, auditRes] = await Promise.all([
        api.get('/api/reports/summary', {
          params: { from: fromDate, to: toDate, technicianId: tech || undefined, clientId: client || undefined, channel: ch || undefined },
        }),
        api.get('/api/reports/audit', {
          params: { from: fromDate, to: toDate, technicianId: tech || undefined, clientId: client || undefined, status: st || undefined, channel: ch || undefined },
        }),
      ])
      setData(summaryRes.data.data)
      setAuditOrders(auditRes.data.data)
    } catch {
      setError('No se pudo generar el reporte')
      setData(null)
      setAuditOrders([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchReports(from, to, technicianId, clientId, status, channel)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Forzar que los <details className="card"> se muestren expandidos al
  // exportar a PDF — ver comentario original conservado, misma técnica.
  useEffect(() => {
    const detailsToRestore: HTMLDetailsElement[] = []
    const handleBeforePrint = () => {
      document.querySelectorAll<HTMLDetailsElement>('details.card').forEach((d) => {
        if (!d.open) {
          d.open = true
          detailsToRestore.push(d)
        }
      })
    }
    const handleAfterPrint = () => {
      detailsToRestore.forEach((d) => { d.open = false })
      detailsToRestore.length = 0
    }
    window.addEventListener('beforeprint', handleBeforePrint)
    window.addEventListener('afterprint', handleAfterPrint)
    return () => {
      window.removeEventListener('beforeprint', handleBeforePrint)
      window.removeEventListener('afterprint', handleAfterPrint)
    }
  }, [])

  const applyPreset = (preset: 'hoy' | 'semana' | 'mes') => {
    const now = new Date()
    let range: { from: Date; to: Date }
    if (preset === 'hoy') range = { from: now, to: now }
    else if (preset === 'semana') range = getWeekRange(now)
    else range = getMonthRange(now)

    const newFrom = toInputDate(range.from)
    const newTo = toInputDate(range.to)
    setFrom(newFrom)
    setTo(newTo)
    fetchReports(newFrom, newTo, technicianId, clientId, status, channel)
  }

  const handleFilter = () => fetchReports(from, to, technicianId, clientId, status, channel)

  const downloadReceipt = async (order: ServicioOrderRow, type: 'intake' | 'final') => {
    try {
      const response = await api.get(`/api/orders/${order.orderId}/receipt/${type}`, { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }))
      const link = document.createElement('a')
      link.href = url
      link.download = `recibo-${type === 'intake' ? 'recepcion' : 'entrega'}-${order.orderNumber}.pdf`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch {
      setError('Error al descargar el recibo')
    }
  }

  return (
    <div className="page-container">
      <div className="no-print page-header">
        <h1>Reportes</h1>
        <Link to="/admin" className="btn btn-secondary">← Volver al panel</Link>
      </div>

      <div className="card no-print">
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <button className="btn btn-outline" onClick={() => applyPreset('hoy')}>Hoy</button>
          <button className="btn btn-outline" onClick={() => applyPreset('semana')}>Esta semana</button>
          <button className="btn btn-outline" onClick={() => applyPreset('mes')}>Este mes</button>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="form-group">
            <label>Desde</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Hasta</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="form-group" style={{ position: 'relative' }}>
            <label>Técnico (cédula o nombre)</label>
            {selectedTechnicianName ? (
              <div>
                {selectedTechnicianName}{' '}
                <button className="btn btn-outline" onClick={clearTechnician}>✕</button>
              </div>
            ) : (
              <>
                <input
                  type="text"
                  placeholder="Buscar por nombre o cédula…"
                  value={technicianQuery}
                  onChange={(e) => setTechnicianQuery(e.target.value)}
                />
                {technicianResults.length > 0 && (
                  <ul className="autocomplete-list">
                    {technicianResults.map((t) => (
                      <li key={t.id} onClick={() => selectTechnician(t)}>
                        {t.name}{t.idNumber ? ` — ${t.idNumber}` : ''}
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>
          <div className="form-group" style={{ position: 'relative' }}>
            <label>Cliente (cédula/RIF o nombre)</label>
            {selectedClientName ? (
              <div>
                {selectedClientName}{' '}
                <button className="btn btn-outline" onClick={clearClient}>✕</button>
              </div>
            ) : (
              <>
                <input
                  type="text"
                  placeholder="Buscar por nombre o cédula/RIF…"
                  value={clientQuery}
                  onChange={(e) => setClientQuery(e.target.value)}
                />
                {clientResults.length > 0 && (
                  <ul className="autocomplete-list">
                    {clientResults.map((c) => (
                      <li key={c.id} onClick={() => selectClient(c)}>
                        {c.name} {c.lastName} — {c.idNumber}
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>
          <div className="form-group">
            <label>Estado (auditoría)</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">Todos</option>
              {ORDER_STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Canal</label>
            <select value={channel} onChange={(e) => setChannel(e.target.value as '' | 'WEB' | 'APK')}>
              <option value="">Todos</option>
              <option value="WEB">Web</option>
              <option value="APK">APK</option>
            </select>
          </div>
          <button className="btn btn-primary" onClick={handleFilter}>Filtrar</button>
          <button className="btn btn-accent" onClick={() => window.print()}>🖨️ Exportar PDF</button>
        </div>
      </div>

      {loading && <p>Cargando…</p>}
      {error && <p className="alert-error">{error}</p>}

      {data && (
        <>
          <h2>Servicio Técnico</h2>
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            <div className="card">
              <h3>Ingresos</h3>
              <p>${data.servicio.totalBudget.toFixed(2)}</p>
            </div>
            <div className="card">
              <h3>Reparaciones</h3>
              <p>{data.servicio.ordersCount}</p>
            </div>
            <div className="card">
              <h3>Comisiones</h3>
              <p>${data.servicio.totalTechnicianCommission.toFixed(2)}</p>
            </div>
            <div className="card">
              <h3>Mermas</h3>
              <p>${data.mermas.total.toFixed(2)} <span className="form-hint">({data.mermas.count} mov.)</span></p>
            </div>
          </div>

          {clientHistory && (
            <section className="card">
              <h3>Expediente de Cliente</h3>
              <p>
                <strong>{clientHistory.client.name} {clientHistory.client.lastName}</strong>
                {' — '}{clientHistory.client.idNumber} · {clientHistory.client.phone}
              </p>
              <p>
                Equipos ingresados: <strong>{clientHistory.devicesIngresados}</strong>
                {' · '}Total pagado: <strong>${clientHistory.totalPaid.toFixed(2)}</strong>
                {' · '}Casos de garantía: <strong>{clientHistory.possibleWarrantyCases.length}</strong>
              </p>
              {clientHistory.activeOrders.length > 0 && (
                <p>
                  Equipos con orden activa: {clientHistory.activeOrders.map((o) => o.orderNumber).join(', ')}
                </p>
              )}
              <details className="card">
                <summary><h4 style={{ display: 'inline' }}>Historial completo</h4></summary>
                <div className="table-wrapper">
                  <table className="styled-table">
                    <thead>
                      <tr>
                        <th scope="col">Orden</th><th scope="col">Fecha</th><th scope="col">Equipo</th>
                        <th scope="col">Estado</th><th scope="col" className="money">Monto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clientHistory.history.map((h) => (
                        <tr key={h.orderId}>
                          <td data-label="Orden">{h.orderNumber}</td>
                          <td data-label="Fecha">{formatDate(h.receivedAt)}</td>
                          <td data-label="Equipo">{h.deviceLabel}</td>
                          <td data-label="Estado">{h.status}</td>
                          <td className="money" data-label="Monto">${h.totalAmount.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            </section>
          )}

          <section className="card">
            <h3>Por técnico</h3>
            {data.servicio.byTechnician.length === 0 ? (
              <p>No hay datos en este período</p>
            ) : (
              <div className="table-wrapper">
                <table className="styled-table">
                  <thead>
                    <tr><th scope="col">Técnico</th><th scope="col">Órdenes</th><th scope="col" className="money">Comisión</th></tr>
                  </thead>
                  <tbody>
                    {data.servicio.byTechnician.map((t) => (
                      <tr key={t.technicianId}>
                        <td data-label="Técnico">{t.technicianName}</td>
                        <td data-label="Órdenes">{t.ordersCount}</td>
                        <td className="money" data-label="Comisión">${t.totalCommission.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="card">
            <h3>Por cliente</h3>
            {data.servicio.byClient.length === 0 ? (
              <p>No hay datos en este período</p>
            ) : (
              <div className="table-wrapper">
                <table className="styled-table">
                  <thead>
                    <tr><th scope="col">Cliente</th><th scope="col">Órdenes</th><th scope="col" className="money">Presupuesto</th></tr>
                  </thead>
                  <tbody>
                    {data.servicio.byClient.map((c) => (
                      <tr key={c.clientId}>
                        <td data-label="Cliente">{c.clientName}</td>
                        <td data-label="Órdenes">{c.ordersCount}</td>
                        <td className="money" data-label="Presupuesto">${c.totalBudget.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <details className="card">
            <summary><h3 style={{ display: 'inline' }}>Recibos de órdenes entregadas</h3></summary>
            {data.servicio.orders.length === 0 ? (
              <p>No hay datos en este período</p>
            ) : (
              <div className="table-wrapper">
                <table className="styled-table">
                  <thead>
                    <tr>
                      <th scope="col">Orden</th><th scope="col">Cliente</th><th scope="col">Técnico</th>
                      <th scope="col">Canal</th>
                      <th scope="col" className="money">Presupuesto</th><th scope="col" className="money">Comisión</th><th scope="col">Entregado</th>
                      <th scope="col" className="no-print">Recibos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.servicio.orders.map((o) => (
                      <tr key={o.orderNumber}>
                        <td data-label="Orden">{o.orderNumber}</td>
                        <td data-label="Cliente">{o.clientName} — {o.clientIdNumber}</td>
                        <td data-label="Técnico">{o.technicianName}</td>
                        <td data-label="Canal">{o.channel}</td>
                        <td className="money" data-label="Presupuesto">${o.budget.toFixed(2)}</td>
                        <td className="money" data-label="Comisión">${o.technicianCommission.toFixed(2)}</td>
                        <td data-label="Entregado">{formatDate(o.deliveredAt)}</td>
                        <td data-label="Recibos" className="no-print">
                          <button className="btn btn-outline" onClick={() => downloadReceipt(o, 'intake')}>📄 Recepción</button>{' '}
                          <button className="btn btn-outline" onClick={() => downloadReceipt(o, 'final')}>📄 Entrega</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </details>

          <details className="card">
            <summary><h3 style={{ display: 'inline' }}>Tabla de Auditoría</h3></summary>
            {auditOrders.length === 0 ? (
              <p>No hay datos en este período</p>
            ) : (
              <div className="table-wrapper">
                <table className="styled-table">
                  <thead>
                    <tr>
                      <th scope="col">Folio</th><th scope="col">Creación</th><th scope="col">Entrega</th>
                      <th scope="col">Cliente</th><th scope="col">Técnico</th><th scope="col">Estado</th>
                      <th scope="col">Canal</th><th scope="col" className="money">Monto</th><th scope="col" className="no-print">Detalle</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditOrders.map((o) => (
                      <Fragment key={o.orderId}>
                        <tr>
                          <td data-label="Folio">{o.orderNumber}</td>
                          <td data-label="Creación">{formatDate(o.receivedAt)}</td>
                          <td data-label="Entrega">{formatDate(o.deliveredAt)}</td>
                          <td data-label="Cliente">{o.clientName} — {o.clientIdNumber}</td>
                          <td data-label="Técnico">{o.technicianName}</td>
                          <td data-label="Estado">{o.status}</td>
                          <td data-label="Canal">{o.channel}</td>
                          <td className="money" data-label="Monto">${o.totalAmount.toFixed(2)}</td>
                          <td data-label="Detalle" className="no-print">
                            <button
                              className="btn btn-outline"
                              onClick={() => setExpandedOrderId(expandedOrderId === o.orderId ? null : o.orderId)}
                            >
                              {expandedOrderId === o.orderId ? '▲' : '▶'}
                            </button>
                          </td>
                        </tr>
                        {expandedOrderId === o.orderId && (
                          <tr>
                            <td colSpan={9}>
                              <p><strong>Diagnóstico:</strong> {o.diagnosis || '—'}</p>
                              <p><strong>Comisión del técnico:</strong> ${o.technicianCommission.toFixed(2)}</p>
                              <p><strong>Repuestos usados:</strong></p>
                              {o.partsUsed.length === 0 ? (
                                <p>Sin repuestos registrados</p>
                              ) : (
                                <ul>
                                  {o.partsUsed.map((p, i) => (
                                    <li key={i}>{p.productName} × {p.quantity}</li>
                                  ))}
                                </ul>
                              )}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </details>
        </>
      )}
    </div>
  )
}
