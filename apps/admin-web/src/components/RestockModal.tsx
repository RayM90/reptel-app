import { useState } from 'react'
import { api } from '../services/api'

interface RestockModalProps {
  productId: string
  productName: string
  knownSuppliers: string[]
  onClose: () => void
  onSuccess: () => void
}

export default function RestockModal({ productId, productName, knownSuppliers, onClose, onSuccess }: RestockModalProps) {
  const [quantity, setQuantity] = useState('')
  const [supplierName, setSupplierName] = useState('')
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const qty = Number(quantity)
    if (!qty || qty <= 0) {
      setError('Ingresa una cantidad mayor a 0')
      return
    }
    setError('')
    setLoading(true)
    try {
      await api.post(`/api/products/${productId}/restock`, {
        quantity: qty,
        supplierName: supplierName.trim() || undefined,
        reason: reason.trim() || undefined,
      })
      onSuccess()
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Error al reabastecer el producto')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal-box" role="dialog" aria-modal="true" aria-labelledby="restock-title">
        <h3 id="restock-title">Reabastecer: {productName}</h3>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="restock-quantity">Cantidad a añadir</label>
            <input
              id="restock-quantity"
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              autoFocus
            />
          </div>

          <div className="form-group">
            <label htmlFor="restock-supplier">Proveedor</label>
            <input
              id="restock-supplier"
              type="text"
              list="restock-supplier-options"
              value={supplierName}
              onChange={(e) => setSupplierName(e.target.value)}
              placeholder="Ej. Distribuidora XYZ"
            />
            <datalist id="restock-supplier-options">
              {knownSuppliers.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>

          <div className="form-group">
            <label htmlFor="restock-reason">Nota (opcional)</label>
            <input
              id="restock-reason"
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          {error && <p className="alert-error">{error}</p>}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
            <button type="button" className="btn btn-outline" onClick={onClose} disabled={loading}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Guardando…' : 'Reabastecer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
