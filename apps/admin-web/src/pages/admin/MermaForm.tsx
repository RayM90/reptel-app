import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../services/api'
import { useAuthStore } from '../../store/auth.store'

interface ProductOption {
  id: string
  name: string
  stock: number
}

const LOSS_REASON_LABELS: Record<string, string> = {
  DEFECTUOSO: 'Defectuoso (se encontró así)',
  DANIO_INSTALACION: 'Dañado durante la instalación',
  PERDIDA: 'Pérdida',
  GARANTIA: 'Garantía',
  OTRO: 'Otro',
}

const DESTINATION_LABELS: Record<string, string> = {
  TIENDA: 'Tienda física',
  DOMICILIO_CLIENTE: 'Domicilio del cliente',
  TALLER: 'Taller',
  OTRO: 'Otro',
}

// Mismo criterio que deriveDestination() en el backend (products.service.ts) — aquí solo
// precarga el default visual, el backend sigue siendo quien decide si no se manda destination.
function defaultDestinationForRole(role: string | undefined): string {
  if (role === 'TECHNICIAN_DELIVERY') return 'DOMICILIO_CLIENTE'
  if (role === 'TECHNICIAN') return 'TALLER'
  return 'TIENDA'
}

export default function MermaForm() {
  const role = useAuthStore((state) => state.user?.role)

  const [products, setProducts] = useState<ProductOption[]>([])
  const [productId, setProductId] = useState('')
  const [quantity, setQuantity] = useState('')
  const [lossReason, setLossReason] = useState('DEFECTUOSO')
  const [destination, setDestination] = useState(defaultDestinationForRole(role))
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    api.get('/api/products').then((res) => setProducts(res.data.data)).catch(() => {})
  }, [])

  const selectedProduct = products.find((p) => p.id === productId)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    if (!productId) {
      setError('Selecciona un producto')
      return
    }
    const qty = Number(quantity)
    if (!qty || qty <= 0) {
      setError('Ingresa una cantidad mayor a 0')
      return
    }
    if (!reason.trim()) {
      setError('Detalla qué pasó con el producto')
      return
    }
    setLoading(true)
    try {
      await api.post(`/api/products/${productId}/merma`, {
        quantity: qty,
        lossReason,
        destination,
        reason: reason.trim(),
      })
      setSuccess('Merma registrada. El stock ya quedó actualizado.')
      setProductId('')
      setQuantity('')
      setReason('')
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Error al registrar la merma')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page-container">
      <h1>Registrar merma</h1>
      <p>
        <Link to={role === 'ADMIN' ? '/admin/inventory' : '/technician'}>← Volver</Link>
      </p>

      <div className="card" style={{ maxWidth: 480 }}>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Producto</label>
            <select value={productId} onChange={(e) => setProductId(e.target.value)}>
              <option value="">Selecciona un producto…</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.name} (stock: {p.stock})</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Cantidad</label>
            <input
              type="number"
              min={1}
              max={selectedProduct?.stock}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
            {selectedProduct && <p className="form-hint">Stock disponible: {selectedProduct.stock}</p>}
          </div>

          <div className="form-group">
            <label>Motivo</label>
            <select value={lossReason} onChange={(e) => setLossReason(e.target.value)}>
              {Object.entries(LOSS_REASON_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Destino/lugar</label>
            <select value={destination} onChange={(e) => setDestination(e.target.value)}>
              {Object.entries(DESTINATION_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>¿Qué pasó con el producto?</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="Ej. Pantalla rota al ensamblar la carcasa"
            />
          </div>

          {error && <p className="alert-error">{error}</p>}
          {success && <p className="alert-success">{success}</p>}

          <button className="btn btn-danger" type="submit" disabled={loading}>
            {loading ? 'Guardando…' : 'Registrar merma'}
          </button>
        </form>
      </div>
    </div>
  )
}
