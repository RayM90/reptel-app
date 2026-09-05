import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../services/api'

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

  useEffect(() => {
    fetchProducts()
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

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Inventario</h1>
        <button className="btn btn-secondary" onClick={() => fetchProducts()}>
          ↻ Actualizar
        </button>
      </div>
      <p><Link to="/admin/inventory/new" className="btn btn-accent">➕ Agregar producto</Link></p>
      <p><Link to="/admin">← Volver al Panel de Administrador</Link></p>

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
              {products.map((product) => (
                <tr key={product.id}>
                  <td>{product.id.slice(0, 8)}…</td>
                  <td>{product.name}</td>
                  <td>{product.category.name}</td>
                  <td className="money">${Number(product.price).toFixed(2)}</td>
                  <td>
                    {product.stock <= product.minStock ? (
                      <span className="badge badge-danger">{product.stock}</span>
                    ) : (
                      product.stock
                    )}
                  </td>
                  <td>
                    <span className={product.isActive ? 'badge badge-success' : 'badge badge-danger'}>
                      {product.isActive ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td>
                    <Link to={`/admin/inventory/${product.id}/edit`}>Editar</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
