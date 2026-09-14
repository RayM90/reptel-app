import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../services/api'
import RestockModal from '../../components/RestockModal'
import { getStockStatus, STOCK_STATUS_LABELS, STOCK_STATUS_BADGE_CLASS } from '../../utils/productStatus'

interface Product {
  id: string
  name: string
  description: string | null
  price: string
  stock: number
  minStock: number
  imageUrl: string | null
  isActive: boolean
  requiresInstallation: boolean
  category: { id: string; name: string }
}

export default function InventoryList() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [restockTarget, setRestockTarget] = useState<Product | null>(null)
  const [knownSuppliers, setKnownSuppliers] = useState<string[]>([])

  useEffect(() => {
    fetchProducts()
    fetchKnownSuppliers()
  }, [])

  const fetchProducts = async () => {
    setLoading(true)
    setError(false)
    try {
      const response = await api.get('/api/products/admin')
      setProducts(response.data.data)
    } catch (err) {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  const fetchKnownSuppliers = async () => {
    try {
      const response = await api.get('/api/products/movements', { params: { type: 'IN' } })
      const names = new Set<string>(
        response.data.data.map((m: { supplierName: string | null }) => m.supplierName).filter(Boolean)
      )
      setKnownSuppliers([...names])
    } catch {
      // silencioso — el datalist del modal simplemente queda vacío, no es bloqueante
    }
  }

  const lowStock = products.filter((p) => getStockStatus(p) === 'LOW_STOCK')
  const outOfStock = products.filter((p) => getStockStatus(p) === 'OUT_OF_STOCK')

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Inventario</h1>
        <button className="btn btn-secondary" onClick={() => fetchProducts()}>
          ↻ Actualizar
        </button>
      </div>
      <p>
        <Link to="/admin/inventory/new" className="btn btn-accent">➕ Agregar producto</Link>{' '}
        <Link to="/admin/inventory/movements" className="btn btn-secondary">📋 Historial de movimientos</Link>{' '}
        <Link to="/inventory/merma/new" className="btn btn-secondary">🔧 Registrar merma</Link>
      </p>
      <p><Link to="/admin">← Volver al Panel de Administrador</Link></p>

      {lowStock.length > 0 && (
        <p className="alert-error" style={{ background: '#fff3e0', borderColor: '#b45309', color: '#b45309' }}>
          ⚠️ Stock bajo ({lowStock.length}): {lowStock.map((p) => `${p.name} (${p.stock}/${p.minStock})`).join(', ')}
        </p>
      )}
      {outOfStock.length > 0 && (
        <p className="alert-error">
          🔴 Agotados ({outOfStock.length}): {outOfStock.map((p) => p.name).join(', ')}
        </p>
      )}

      {loading && <p>Cargando…</p>}
      {error && <p className="alert-error">No se pudo cargar el inventario</p>}

      {!loading && !error && (
        <div className="table-wrapper">
          <table className="styled-table styled-table--sticky-actions">
            <thead>
              <tr>
                <th scope="col">ID</th>
                <th scope="col">Nombre</th>
                <th scope="col">Categoría</th>
                <th scope="col" className="money">Precio</th>
                <th scope="col">Stock</th>
                <th scope="col">Estado</th>
                <th scope="col">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => {
                const status = getStockStatus(product)
                return (
                  <tr key={product.id}>
                    <td data-label="ID">{product.id.slice(0, 8)}…</td>
                    <td data-label="Nombre">{product.name}</td>
                    <td data-label="Categoría">{product.category.name}</td>
                    <td className="money" data-label="Precio">${Number(product.price).toFixed(2)}</td>
                    <td data-label="Stock">{product.stock}</td>
                    <td data-label="Estado">
                      <span className={STOCK_STATUS_BADGE_CLASS[status]}>{STOCK_STATUS_LABELS[status]}</span>
                    </td>
                    <td data-label="Acciones">
                      <Link to={`/admin/inventory/${product.id}/edit`}>Editar</Link>{' '}
                      <button className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: 13 }} onClick={() => setRestockTarget(product)}>
                        Reabastecer
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {restockTarget && (
        <RestockModal
          productId={restockTarget.id}
          productName={restockTarget.name}
          knownSuppliers={knownSuppliers}
          onClose={() => setRestockTarget(null)}
          onSuccess={() => {
            setRestockTarget(null)
            fetchProducts()
            fetchKnownSuppliers()
          }}
        />
      )}
    </div>
  )
}
