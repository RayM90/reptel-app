import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../services/api'

type Tab = 'entradas' | 'salidas'

interface Movement {
  id: string
  type: 'IN' | 'OUT'
  channel: 'MOSTRADOR' | 'SERVICIO_TECNICO' | 'AJUSTE_MANUAL' | 'MERMA'
  quantity: number
  reason: string
  supplierName: string | null
  destination: 'TIENDA' | 'DOMICILIO_CLIENTE' | 'TALLER' | 'OTRO' | null
  lossReason: 'DEFECTUOSO' | 'DANIO_INSTALACION' | 'PERDIDA' | 'GARANTIA' | 'OTRO' | null
  createdAt: string
  product: { id: string; name: string }
  user: { id: string; name: string; lastName: string | null; role: string } | null
}

const CHANNEL_LABELS: Record<Movement['channel'], string> = {
  MOSTRADOR: 'Mostrador (histórico)',
  SERVICIO_TECNICO: 'Servicio técnico',
  AJUSTE_MANUAL: 'Ajuste manual',
  MERMA: 'Merma',
}

const DESTINATION_LABELS: Record<string, string> = {
  TIENDA: 'Tienda física',
  DOMICILIO_CLIENTE: 'Domicilio del cliente',
  TALLER: 'Taller',
  OTRO: 'Otro',
}

const LOSS_REASON_LABELS: Record<string, string> = {
  DEFECTUOSO: 'Defectuoso',
  DANIO_INSTALACION: 'Dañado en instalación',
  PERDIDA: 'Pérdida',
  GARANTIA: 'Garantía',
  OTRO: 'Otro',
}

const TECHNICIAN_ROLE_LABELS: Record<string, string> = {
  TECHNICIAN: 'Mostrador',
  TECHNICIAN_DELIVERY: 'Motorizado',
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('es-VE', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

export default function InventoryMovements() {
  const [tab, setTab] = useState<Tab>('entradas')
  const [movements, setMovements] = useState<Movement[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  // Filtros — Entradas
  const [supplierName, setSupplierName] = useState('')
  // Filtros — Salidas
  const [technicianRole, setTechnicianRole] = useState('')
  const [destination, setDestination] = useState('')
  const [channel, setChannel] = useState('')
  // Filtros compartidos
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const fetchMovements = async (activeTab: Tab) => {
    setLoading(true)
    setError(false)
    try {
      const params: Record<string, string> = { type: activeTab === 'entradas' ? 'IN' : 'OUT' }
      if (from) params.from = from
      if (to) params.to = to
      if (activeTab === 'entradas' && supplierName) params.supplierName = supplierName
      if (activeTab === 'salidas') {
        if (technicianRole) params.technicianRole = technicianRole
        if (destination) params.destination = destination
        if (channel) params.channel = channel
      }
      const response = await api.get('/api/products/movements', { params })
      setMovements(response.data.data)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMovements(tab)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  const switchTab = (next: Tab) => {
    setTab(next)
  }

  const knownSuppliers = [...new Set(movements.map((m) => m.supplierName).filter(Boolean) as string[])]

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Historial de Inventario</h1>
        <button className="btn btn-secondary" onClick={() => fetchMovements(tab)}>
          ↻ Actualizar
        </button>
      </div>
      <p><Link to="/admin/inventory">← Volver al Inventario</Link></p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, borderBottom: '1px solid var(--color-border)' }}>
        <button
          className={tab === 'entradas' ? 'btn btn-primary' : 'btn btn-outline'}
          style={{ borderRadius: '6px 6px 0 0' }}
          onClick={() => switchTab('entradas')}
        >
          📥 Entradas / Reabastecimiento
        </button>
        <button
          className={tab === 'salidas' ? 'btn btn-primary' : 'btn btn-outline'}
          style={{ borderRadius: '6px 6px 0 0' }}
          onClick={() => switchTab('salidas')}
        >
          📤 Salida / Vida de uso
        </button>
      </div>

      <div className="card" style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div className="form-group" style={{ maxWidth: 180, marginBottom: 0 }}>
          <label>Desde</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="form-group" style={{ maxWidth: 180, marginBottom: 0 }}>
          <label>Hasta</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>

        {tab === 'entradas' ? (
          <div className="form-group" style={{ maxWidth: 220, marginBottom: 0 }}>
            <label>Proveedor</label>
            <input
              type="text"
              list="movements-supplier-options"
              value={supplierName}
              onChange={(e) => setSupplierName(e.target.value)}
              placeholder="Todos"
            />
            <datalist id="movements-supplier-options">
              {knownSuppliers.map((s) => <option key={s} value={s} />)}
            </datalist>
          </div>
        ) : (
          <>
            <div className="form-group" style={{ maxWidth: 180, marginBottom: 0 }}>
              <label>Técnico</label>
              <select value={technicianRole} onChange={(e) => setTechnicianRole(e.target.value)}>
                <option value="">Todos</option>
                <option value="TECHNICIAN">Mostrador</option>
                <option value="TECHNICIAN_DELIVERY">Motorizado</option>
              </select>
            </div>
            <div className="form-group" style={{ maxWidth: 180, marginBottom: 0 }}>
              <label>Destino</label>
              <select value={destination} onChange={(e) => setDestination(e.target.value)}>
                <option value="">Todos</option>
                {Object.entries(DESTINATION_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div className="form-group" style={{ maxWidth: 180, marginBottom: 0 }}>
              <label>Canal</label>
              <select value={channel} onChange={(e) => setChannel(e.target.value)}>
                <option value="">Todos</option>
                <option value="SERVICIO_TECNICO">Servicio técnico</option>
                <option value="MERMA">Merma</option>
                <option value="MOSTRADOR">Mostrador (histórico)</option>
                <option value="AJUSTE_MANUAL">Ajuste manual</option>
              </select>
            </div>
          </>
        )}

        <button className="btn btn-secondary" style={{ marginBottom: 0 }} onClick={() => fetchMovements(tab)}>
          Filtrar
        </button>
      </div>

      {loading && <p>Cargando…</p>}
      {error && <p className="alert-error">No se pudo cargar el historial</p>}

      {!loading && !error && tab === 'entradas' && (
        <div className="table-wrapper">
          <table className="styled-table">
            <thead>
              <tr>
                <th scope="col">Fecha</th>
                <th scope="col">Producto</th>
                <th scope="col">Cantidad</th>
                <th scope="col">Proveedor</th>
                <th scope="col">Usuario</th>
                <th scope="col">Motivo</th>
              </tr>
            </thead>
            <tbody>
              {movements.length === 0 ? (
                <tr><td colSpan={6}>No hay entradas registradas</td></tr>
              ) : (
                movements.map((m) => (
                  <tr key={m.id}>
                    <td data-label="Fecha">{formatDate(m.createdAt)}</td>
                    <td data-label="Producto">{m.product.name}</td>
                    <td data-label="Cantidad">{m.quantity}</td>
                    <td data-label="Proveedor">{m.supplierName ?? '—'}</td>
                    <td data-label="Usuario">{m.user ? `${m.user.name} ${m.user.lastName ?? ''}`.trim() : '—'}</td>
                    <td data-label="Motivo">{m.reason}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {!loading && !error && tab === 'salidas' && (
        <div className="table-wrapper">
          <table className="styled-table">
            <thead>
              <tr>
                <th scope="col">Fecha</th>
                <th scope="col">Producto</th>
                <th scope="col">Cantidad</th>
                <th scope="col">Canal</th>
                <th scope="col">Técnico</th>
                <th scope="col">Destino</th>
                <th scope="col">Motivo</th>
                <th scope="col">Tipo de daño</th>
              </tr>
            </thead>
            <tbody>
              {movements.length === 0 ? (
                <tr><td colSpan={8}>No hay salidas registradas</td></tr>
              ) : (
                movements.map((m) => (
                  <tr key={m.id}>
                    <td data-label="Fecha">{formatDate(m.createdAt)}</td>
                    <td data-label="Producto">{m.product.name}</td>
                    <td data-label="Cantidad">{m.quantity}</td>
                    <td data-label="Canal">
                      <span className={m.channel === 'MERMA' ? 'badge badge-danger' : 'badge'}>
                        {CHANNEL_LABELS[m.channel]}
                      </span>
                    </td>
                    <td data-label="Técnico">
                      {m.user && TECHNICIAN_ROLE_LABELS[m.user.role]
                        ? <span className="badge badge-info">{TECHNICIAN_ROLE_LABELS[m.user.role]}</span>
                        : '—'}
                    </td>
                    <td data-label="Destino">{m.destination ? DESTINATION_LABELS[m.destination] : '—'}</td>
                    <td data-label="Motivo">{m.reason}</td>
                    <td data-label="Tipo de daño">{m.lossReason ? LOSS_REASON_LABELS[m.lossReason] : '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
