import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../services/api'

interface Movement {
  id: string
  type: 'IN' | 'OUT'
  channel: 'MOSTRADOR' | 'SERVICIO_TECNICO' | 'AJUSTE_MANUAL'
  quantity: number
  reason: string
  createdAt: string
  product: { id: string; name: string }
  user: { id: string; name: string; lastName: string | null } | null
  lossReportedAt: string | null
  lossDescription: string | null
  order: { deliveryAmount: string | null } | null
}

const CHANNEL_LABELS: Record<Movement['channel'], string> = {
  MOSTRADOR: 'Mostrador',
  SERVICIO_TECNICO: 'Servicio técnico',
  AJUSTE_MANUAL: 'Ajuste manual',
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('es-VE', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

export default function InventoryMovements() {
  const [movements, setMovements] = useState<Movement[]>([])
  const [channel, setChannel] = useState('')
  const [origin, setOrigin] = useState<'' | 'MOSTRADOR' | 'APP'>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const fetchMovements = async (filterChannel: string) => {
    setLoading(true)
    setError(false)
    try {
      const response = await api.get('/api/products/movements', {
        params: filterChannel ? { channel: filterChannel } : undefined,
      })
      setMovements(response.data.data)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMovements(channel)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const visibleMovements = origin
    ? movements.filter((m) => (origin === 'APP' ? m.order?.deliveryAmount != null : m.order?.deliveryAmount == null))
    : movements

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Historial de Inventario</h1>
        <button className="btn btn-secondary" onClick={() => fetchMovements(channel)}>
          ↻ Actualizar
        </button>
      </div>
      <p><Link to="/admin/inventory">← Volver al Inventario</Link></p>

      <div className="form-group" style={{ maxWidth: 250 }}>
        <label>Canal</label>
        <select
          value={origin ? `SERVICIO_TECNICO_${origin}` : channel}
          onChange={(e) => {
            const value = e.target.value
            if (value === 'SERVICIO_TECNICO_MOSTRADOR' || value === 'SERVICIO_TECNICO_APP') {
              setOrigin(value === 'SERVICIO_TECNICO_APP' ? 'APP' : 'MOSTRADOR')
              setChannel('SERVICIO_TECNICO')
              fetchMovements('SERVICIO_TECNICO')
            } else {
              setOrigin('')
              setChannel(value)
              fetchMovements(value)
            }
          }}
        >
          <option value="">Todos</option>
          <option value="MOSTRADOR">Mostrador</option>
          <option value="SERVICIO_TECNICO_MOSTRADOR">Servicio técnico – Mostrador</option>
          <option value="SERVICIO_TECNICO_APP">Servicio técnico – App</option>
          <option value="AJUSTE_MANUAL">Ajuste manual</option>
        </select>
      </div>

      {loading && <p>Cargando…</p>}
      {error && <p className="alert-error">No se pudo cargar el historial</p>}

      {!loading && !error && (
        <div className="table-wrapper">
          <table className="styled-table">
            <thead>
              <tr>
                <th scope="col">Fecha</th>
                <th scope="col">Producto</th>
                <th scope="col">Tipo</th>
                <th scope="col">Cantidad</th>
                <th scope="col">Motivo</th>
                <th scope="col">Canal</th>
                <th scope="col">Quién</th>
              </tr>
            </thead>
            <tbody>
              {visibleMovements.length === 0 ? (
                <tr><td colSpan={7}>No hay movimientos registrados</td></tr>
              ) : (
                visibleMovements.map((m) => (
                  <tr key={m.id}>
                    <td data-label="Fecha">{formatDate(m.createdAt)}</td>
                    <td data-label="Producto">{m.product.name}</td>
                    <td data-label="Tipo">
                      <span className={m.type === 'IN' ? 'badge badge-success' : 'badge badge-danger'}>
                        {m.type === 'IN' ? 'Entrada' : 'Salida'}
                      </span>
                    </td>
                    <td data-label="Cantidad">{m.quantity}</td>
                    <td data-label="Motivo">
                      {m.reason}
                      {m.lossReportedAt && (
                        <>
                          <br />
                          <span className="badge badge-danger">🔴 Merma: {m.lossDescription}</span>
                        </>
                      )}
                    </td>
                    <td data-label="Canal">
                      {m.channel === 'SERVICIO_TECNICO'
                        ? `Servicio técnico – ${m.order?.deliveryAmount != null ? 'App' : 'Mostrador'}`
                        : CHANNEL_LABELS[m.channel]}
                    </td>
                    <td data-label="Quién">{m.user ? `${m.user.name} ${m.user.lastName ?? ''}`.trim() : '—'}</td>
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
