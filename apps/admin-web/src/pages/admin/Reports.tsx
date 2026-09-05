import { useEffect, useState } from 'react'
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

interface TiendaClientRow {
  clientId: string
  clientName: string
  ordersCount: number
  totalSales: number
}

interface ClientSearchResult {
  id: string
  name: string
  lastName: string
}

interface ServicioOrderRow {
  orderNumber: string
  clientName: string
  technicianName: string
  deliveredAt: string | null
  budget: number
  technicianCommission: number
}

interface MotorizadoRow {
  agentId: string
  agentName: string
  deliveriesCount: number
  totalCommission: number
}

interface TiendaOrderRow {
  id: string
  clientName: string
  agentName: string
  deliveredAt: string | null
  total: number
  deliveryCommission: number
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
  tienda: {
    totalSales: number
    totalDeliveryCommission: number
    ordersCount: number
    byMotorizado: MotorizadoRow[]
    byClient: TiendaClientRow[]
    orders: TiendaOrderRow[]
  }
}

interface Technician {
  id: string
  name: string
}

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
  const [technicianId, setTechnicianId] = useState('')
  const [technicians, setTechnicians] = useState<Technician[]>([])
  const [clientQuery, setClientQuery] = useState('')
  const [clientResults, setClientResults] = useState<ClientSearchResult[]>([])
  const [clientId, setClientId] = useState('')
  const [selectedClientName, setSelectedClientName] = useState('')
  const [data, setData] = useState<ReportSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get('/api/orders/technicians').then((res) => setTechnicians(res.data.data))
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

  const selectClient = (client: ClientSearchResult) => {
    setClientId(client.id)
    setSelectedClientName(`${client.name} ${client.lastName}`)
    setClientQuery('')
    setClientResults([])
  }

  const clearClient = () => {
    setClientId('')
    setSelectedClientName('')
  }

  const fetchReport = async (fromDate: string, toDate: string, tech: string, client: string) => {
    setLoading(true)
    setError('')
    try {
      const res = await api.get('/api/reports/summary', {
        params: { from: fromDate, to: toDate, technicianId: tech || undefined, clientId: client || undefined },
      })
      setData(res.data.data)
    } catch {
      setError('No se pudo generar el reporte')
      setData(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchReport(from, to, technicianId, clientId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    fetchReport(newFrom, newTo, technicianId, clientId)
  }

  const handleFilter = () => fetchReport(from, to, technicianId, clientId)

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
          <div className="form-group">
            <label>Técnico</label>
            <select value={technicianId} onChange={(e) => setTechnicianId(e.target.value)}>
              <option value="">Todos</option>
              {technicians.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          <div className="form-group" style={{ position: 'relative' }}>
            <label>Cliente</label>
            {selectedClientName ? (
              <div>
                {selectedClientName}{' '}
                <button className="btn btn-outline" onClick={clearClient}>✕</button>
              </div>
            ) : (
              <>
                <input
                  type="text"
                  placeholder="Buscar por nombre o cédula…"
                  value={clientQuery}
                  onChange={(e) => setClientQuery(e.target.value)}
                />
                {clientResults.length > 0 && (
                  <ul className="autocomplete-list">
                    {clientResults.map((c) => (
                      <li key={c.id} onClick={() => selectClient(c)}>
                        {c.name} {c.lastName}
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
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
              <h3>Órdenes completadas</h3>
              <p>{data.servicio.ordersCount}</p>
            </div>
            <div className="card">
              <h3>Presupuesto total</h3>
              <p>${data.servicio.totalBudget.toFixed(2)}</p>
            </div>
            <div className="card">
              <h3>Comisión de técnicos</h3>
              <p>${data.servicio.totalTechnicianCommission.toFixed(2)}</p>
            </div>
          </div>

          <section className="card">
            <h3>Por técnico</h3>
            {data.servicio.byTechnician.length === 0 ? (
              <p>No hay datos en este período</p>
            ) : (
              <div className="table-wrapper">
                <table className="styled-table">
                  <thead>
                    <tr><th>Técnico</th><th>Órdenes</th><th className="money">Comisión</th></tr>
                  </thead>
                  <tbody>
                    {data.servicio.byTechnician.map((t) => (
                      <tr key={t.technicianId}>
                        <td>{t.technicianName}</td>
                        <td>{t.ordersCount}</td>
                        <td className="money">${t.totalCommission.toFixed(2)}</td>
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
                    <tr><th>Cliente</th><th>Órdenes</th><th className="money">Presupuesto</th></tr>
                  </thead>
                  <tbody>
                    {data.servicio.byClient.map((c) => (
                      <tr key={c.clientId}>
                        <td>{c.clientName}</td>
                        <td>{c.ordersCount}</td>
                        <td className="money">${c.totalBudget.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <details className="card">
            <summary><h3 style={{ display: 'inline' }}>Detalle de órdenes</h3></summary>
            {data.servicio.orders.length === 0 ? (
              <p>No hay datos en este período</p>
            ) : (
              <div className="table-wrapper">
                <table className="styled-table">
                  <thead>
                    <tr>
                      <th>Orden</th><th>Cliente</th><th>Técnico</th>
                      <th className="money">Presupuesto</th><th className="money">Comisión</th><th>Entregado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.servicio.orders.map((o) => (
                      <tr key={o.orderNumber}>
                        <td>{o.orderNumber}</td>
                        <td>{o.clientName}</td>
                        <td>{o.technicianName}</td>
                        <td className="money">${o.budget.toFixed(2)}</td>
                        <td className="money">${o.technicianCommission.toFixed(2)}</td>
                        <td>{formatDate(o.deliveredAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </details>

          <h2 className="print-break">Tienda</h2>
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            <div className="card">
              <h3>Pedidos completados</h3>
              <p>{data.tienda.ordersCount}</p>
            </div>
            <div className="card">
              <h3>Ventas totales</h3>
              <p>${data.tienda.totalSales.toFixed(2)}</p>
            </div>
            <div className="card">
              <h3>Comisión de motorizados</h3>
              <p>${data.tienda.totalDeliveryCommission.toFixed(2)}</p>
            </div>
          </div>

          <section className="card">
            <h3>Por motorizado</h3>
            {data.tienda.byMotorizado.length === 0 ? (
              <p>No hay datos en este período</p>
            ) : (
              <div className="table-wrapper">
                <table className="styled-table">
                  <thead>
                    <tr><th>Motorizado</th><th>Entregas</th><th className="money">Comisión</th></tr>
                  </thead>
                  <tbody>
                    {data.tienda.byMotorizado.map((m) => (
                      <tr key={m.agentId}>
                        <td>{m.agentName}</td>
                        <td>{m.deliveriesCount}</td>
                        <td className="money">${m.totalCommission.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="card">
            <h3>Por cliente</h3>
            {data.tienda.byClient.length === 0 ? (
              <p>No hay datos en este período</p>
            ) : (
              <div className="table-wrapper">
                <table className="styled-table">
                  <thead>
                    <tr><th>Cliente</th><th>Pedidos</th><th className="money">Ventas</th></tr>
                  </thead>
                  <tbody>
                    {data.tienda.byClient.map((c) => (
                      <tr key={c.clientId}>
                        <td>{c.clientName}</td>
                        <td>{c.ordersCount}</td>
                        <td className="money">${c.totalSales.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <details className="card">
            <summary><h3 style={{ display: 'inline' }}>Detalle de pedidos</h3></summary>
            {data.tienda.orders.length === 0 ? (
              <p>No hay datos en este período</p>
            ) : (
              <div className="table-wrapper">
                <table className="styled-table">
                  <thead>
                    <tr>
                      <th>Cliente</th><th>Motorizado</th>
                      <th className="money">Total</th><th className="money">Comisión</th><th>Entregado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.tienda.orders.map((po) => (
                      <tr key={po.id}>
                        <td>{po.clientName}</td>
                        <td>{po.agentName}</td>
                        <td className="money">${po.total.toFixed(2)}</td>
                        <td className="money">${po.deliveryCommission.toFixed(2)}</td>
                        <td>{formatDate(po.deliveredAt)}</td>
                      </tr>
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
