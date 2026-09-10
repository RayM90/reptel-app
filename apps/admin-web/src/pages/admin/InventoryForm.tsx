import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../../services/api'

interface Category {
  id: string
  name: string
}

export default function InventoryForm() {
  const { id } = useParams()
  const isEditMode = Boolean(id)
  const navigate = useNavigate()

  const [categories, setCategories] = useState<Category[]>([])
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [stock, setStock] = useState('0')
  const [minStock, setMinStock] = useState('3')
  const [imageUrl, setImageUrl] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [requiresInstallation, setRequiresInstallation] = useState(false)
  const [isActive, setIsActive] = useState(true)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [loaded, setLoaded] = useState(!isEditMode)

  useEffect(() => {
    fetchCategories()
    if (isEditMode) {
      fetchProduct()
    }
  }, [id])

  const fetchCategories = async () => {
    try {
      const response = await api.get('/api/products/categories')
      const cats: Category[] = response.data.data.map((c: { id: string; name: string }) => ({
        id: c.id,
        name: c.name,
      }))
      setCategories(cats)
      if (!isEditMode && cats.length > 0) {
        setCategoryId(cats[0].id)
      }
    } catch (err) {
      setError('No se pudieron cargar las categorías')
    }
  }

  const fetchProduct = async () => {
    try {
      const response = await api.get(`/api/products/${id}`)
      const p = response.data.data
      setName(p.name)
      setDescription(p.description || '')
      setPrice(String(p.price))
      setStock(String(p.stock))
      setMinStock(String(p.minStock))
      setImageUrl(p.imageUrl || '')
      setCategoryId(p.category.id)
      setRequiresInstallation(p.requiresInstallation)
      setIsActive(p.isActive)
      setLoaded(true)
    } catch (err) {
      setError('No se pudo cargar el producto')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const payload = {
        name,
        description,
        price: Number(price),
        stock: Number(stock),
        minStock: Number(minStock),
        imageUrl,
        categoryId,
        requiresInstallation,
        ...(isEditMode ? { isActive } : {}),
      }
      if (isEditMode) {
        await api.put(`/api/products/${id}`, payload)
      } else {
        await api.post('/api/products', payload)
      }
      navigate('/admin/inventory')
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Error al guardar el producto')
    } finally {
      setLoading(false)
    }
  }

  if (isEditMode && !loaded) {
    return (
      <div className="page-container">
        <h1>Editar producto</h1>
        <p><Link to="/admin/inventory">← Volver al inventario</Link></p>
        <div className="card" style={{ maxWidth: 480 }}>
          {error ? <p className="alert-error">{error}</p> : <p>Cargando producto…</p>}
        </div>
      </div>
    )
  }

  return (
    <div className="page-container">
      <h1>{isEditMode ? 'Editar producto' : 'Agregar producto'}</h1>
      <p><Link to="/admin/inventory">← Volver al inventario</Link></p>

      <div className="card" style={{ maxWidth: 480 }}>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Nombre comercial</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>

          <div className="form-group">
            <label>Descripción</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

          <div className="form-group">
            <label>Precio</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label>Stock</label>
            <input type="number" min="0" value={stock} onChange={(e) => setStock(e.target.value)} />
          </div>

          <div className="form-group">
            <label>Stock mínimo</label>
            <input type="number" min="0" value={minStock} onChange={(e) => setMinStock(e.target.value)} />
            <p className="form-hint">Cuando el stock llegue a este número o menos, se resalta en la tabla.</p>
          </div>

          <div className="form-group">
            <label>Categoría</label>
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} required>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Imagen (ruta relativa)</label>
            <input
              type="text"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="products/nombre-del-archivo.jpg"
            />
            <p className="form-hint">
              Ruta dentro de apps/mobile/assets/images/ — la imagen real se agrega por separado.
            </p>
          </div>

          <div className="form-group">
            <label>
              <input
                type="checkbox"
                checked={requiresInstallation}
                onChange={(e) => setRequiresInstallation(e.target.checked)}
              />{' '}
              Requiere instalación
            </label>
          </div>

          {isEditMode && (
            <div className="form-group">
              <label>
                <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />{' '}
                Activo (disponible en inventario)
              </label>
            </div>
          )}

          {error && <p className="alert-error">{error}</p>}

          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? 'Guardando…' : 'Guardar'}
          </button>
        </form>
      </div>
    </div>
  )
}
