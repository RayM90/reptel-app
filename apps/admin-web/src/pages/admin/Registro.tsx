import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../services/api'
import { useToastStore } from '../../store/toast.store'

interface Client {
  id: string
  name: string
  lastName: string
  idNumber: string
  phone: string
  email: string | null
  addressState: string | null
  addressCity: string | null
  addressNeighborhood: string | null
  addressStreet: string | null
  addressBuilding: string | null
}

interface Product {
  id: string
  name: string
  price: string
  stock: number
  category: { id: string; name: string }
}

interface CartItem {
  productId: string
  name: string
  quantity: number
  stock: number
}

const emptyForm = {
  name: '',
  lastName: '',
  phone: '',
  email: '',
  addressState: '',
  addressCity: '',
  addressNeighborhood: '',
  addressStreet: '',
  addressBuilding: '',
}

export default function Registro() {
  const showToast = useToastStore((state) => state.showToast)

  const [step, setStep] = useState<'client' | 'sale'>('client')

  // ── Paso 1: identificar/crear cliente ──
  const [idNumber, setIdNumber] = useState('')
  const [searching, setSearching] = useState(false)
  const [searched, setSearched] = useState(false)
  const [clientExists, setClientExists] = useState<boolean | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [savingClient, setSavingClient] = useState(false)
  const [clientError, setClientError] = useState('')
  const [activeClient, setActiveClient] = useState<Client | null>(null)

  // ── Paso 2: venta de mostrador ──
  const [products, setProducts] = useState<Product[]>([])
  const [productsLoading, setProductsLoading] = useState(false)
  const [selectedProductId, setSelectedProductId] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [cart, setCart] = useState<CartItem[]>([])
  const [confirmingSale, setConfirmingSale] = useState(false)

  useEffect(() => {
    if (step === 'sale') fetchProducts()
  }, [step])

  const fetchProducts = async () => {
    setProductsLoading(true)
    try {
      const response = await api.get('/api/products')
      setProducts(response.data.data)
    } catch (err) {
      showToast('No se pudieron cargar los productos', 'error')
    } finally {
      setProductsLoading(false)
    }
  }

  const resetAll = () => {
    setStep('client')
    setIdNumber('')
    setSearched(false)
    setClientExists(null)
    setForm(emptyForm)
    setClientError('')
    setActiveClient(null)
    setCart([])
    setSelectedProductId('')
    setQuantity('1')
  }

  const handleSearch = async () => {
    if (!idNumber.trim()) return
    setSearching(true)
    setClientError('')
    try {
      const response = await api.get(`/api/clients/idnumber/${encodeURIComponent(idNumber.trim())}`)
      const client: Client = response.data.data
      setActiveClient(client)
      setClientExists(true)
      setForm({
        name: client.name,
        lastName: client.lastName,
        phone: client.phone,
        email: client.email || '',
        addressState: client.addressState || '',
        addressCity: client.addressCity || '',
        addressNeighborhood: client.addressNeighborhood || '',
        addressStreet: client.addressStreet || '',
        addressBuilding: client.addressBuilding || '',
      })
    } catch (err: any) {
      if (err?.response?.status === 404) {
        setClientExists(false)
        setActiveClient(null)
        setForm(emptyForm)
      } else {
        showToast('Error al buscar el cliente', 'error')
      }
    } finally {
      setSearching(false)
      setSearched(true)
    }
  }

  const handleContinue = async () => {
    if (clientExists) {
      setStep('sale')
      return
    }

    if (!form.name || !form.lastName || !form.phone) {
      setClientError('Nombre, apellido y teléfono son requeridos')
      return
    }

    setSavingClient(true)
    setClientError('')
    try {
      const response = await api.post('/api/clients', { ...form, idNumber: idNumber.trim() })
      setActiveClient(response.data.data)
      setStep('sale')
    } catch (err: any) {
      setClientError(err?.response?.data?.message || 'Error al crear el cliente')
    } finally {
      setSavingClient(false)
    }
  }

  const alreadyInCart = (productId: string) =>
    cart.filter((c) => c.productId === productId).reduce((sum, c) => sum + c.quantity, 0)

  const handleAddToCart = () => {
    const product = products.find((p) => p.id === selectedProductId)
    if (!product) return
    const qty = Number(quantity)
    if (!Number.isInteger(qty) || qty <= 0) {
      showToast('La cantidad debe ser un número entero mayor a 0', 'error')
      return
    }
    const available = product.stock - alreadyInCart(product.id)
    if (qty > available) {
      showToast(`Solo hay ${available} unidades disponibles de "${product.name}"`, 'error')
      return
    }
    setCart((prev) => [...prev, { productId: product.id, name: product.name, quantity: qty, stock: product.stock }])
    setQuantity('1')
  }

  const handleRemoveFromCart = (index: number) => {
    setCart((prev) => prev.filter((_, i) => i !== index))
  }

  const handleConfirmSale = async () => {
    if (cart.length === 0) return
    setConfirmingSale(true)
    try {
      for (const item of cart) {
        await api.post(`/api/products/${item.productId}/sell`, { quantity: item.quantity })
      }
      showToast(`✅ Venta registrada para ${activeClient?.name} ${activeClient?.lastName}`, 'success')
      resetAll()
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Error al registrar la venta', 'error')
      fetchProducts() // refrescar stock por si algún ítem sí se descontó antes del error
    } finally {
      setConfirmingSale(false)
    }
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Registro — Tienda Física</h1>
      </div>
      <p><Link to="/admin">← Volver al Panel de Administrador</Link></p>

      {step === 'client' && (
        <div className="card" style={{ maxWidth: 480 }}>
          <div className="form-group">
            <label>Cédula</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                value={idNumber}
                onChange={(e) => {
                  setIdNumber(e.target.value)
                  setSearched(false)
                  setClientExists(null)
                }}
                placeholder="V-12345678"
              />
              <button className="btn btn-secondary" onClick={handleSearch} disabled={searching || !idNumber.trim()}>
                {searching ? 'Buscando…' : 'Buscar'}
              </button>
            </div>
          </div>

          {searched && clientExists && (
            <p className="alert-success">Cliente encontrado: {form.name} {form.lastName}</p>
          )}
          {searched && clientExists === false && (
            <p className="form-hint">No existe un cliente con esa cédula — completa los datos para registrarlo.</p>
          )}

          {searched && (
            <>
              <div className="form-group">
                <label>Nombre</label>
                <input type="text" value={form.name} disabled={!!clientExists}
                  onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Apellido</label>
                <input type="text" value={form.lastName} disabled={!!clientExists}
                  onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Teléfono</label>
                <input type="text" value={form.phone} disabled={!!clientExists}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Correo (opcional)</label>
                <input type="email" value={form.email} disabled={!!clientExists}
                  onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Estado</label>
                <input type="text" value={form.addressState} disabled={!!clientExists}
                  onChange={(e) => setForm({ ...form, addressState: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Municipio</label>
                <input type="text" value={form.addressCity} disabled={!!clientExists}
                  onChange={(e) => setForm({ ...form, addressCity: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Barrio/Urb.</label>
                <input type="text" value={form.addressNeighborhood} disabled={!!clientExists}
                  onChange={(e) => setForm({ ...form, addressNeighborhood: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Calle</label>
                <input type="text" value={form.addressStreet} disabled={!!clientExists}
                  onChange={(e) => setForm({ ...form, addressStreet: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Edificio/Casa</label>
                <input type="text" value={form.addressBuilding} disabled={!!clientExists}
                  onChange={(e) => setForm({ ...form, addressBuilding: e.target.value })} />
              </div>

              {clientError && <p className="alert-error">{clientError}</p>}

              <button className="btn btn-primary" onClick={handleContinue} disabled={savingClient}>
                {savingClient ? 'Guardando…' : clientExists ? 'Continuar →' : 'Crear cliente y continuar →'}
              </button>
            </>
          )}
        </div>
      )}

      {step === 'sale' && activeClient && (
        <div className="card" style={{ maxWidth: 600 }}>
          <p><strong>Cliente:</strong> {activeClient.name} {activeClient.lastName} — {activeClient.phone}</p>
          <p><button className="btn btn-outline" onClick={resetAll}>← Buscar otro cliente</button></p>

          <h2>Venta de productos</h2>
          {productsLoading ? (
            <p>Cargando productos…</p>
          ) : (
            <>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginBottom: 12 }}>
                <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                  <label>Producto</label>
                  <select value={selectedProductId} onChange={(e) => setSelectedProductId(e.target.value)}>
                    <option value="">— Seleccionar —</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id} disabled={p.stock - alreadyInCart(p.id) <= 0}>
                        {p.name} (stock: {p.stock - alreadyInCart(p.id)}) — ${p.price}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group" style={{ width: 100, marginBottom: 0 }}>
                  <label>Cantidad</label>
                  <input type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
                </div>
                <button className="btn btn-secondary" onClick={handleAddToCart} disabled={!selectedProductId}>
                  Agregar
                </button>
              </div>

              {cart.length === 0 ? (
                <p>No hay productos agregados todavía.</p>
              ) : (
                <div className="table-wrapper">
                  <table className="styled-table">
                    <thead>
                      <tr>
                        <th scope="col">Producto</th>
                        <th scope="col">Cantidad</th>
                        <th scope="col">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cart.map((item, index) => (
                        <tr key={`${item.productId}-${index}`}>
                          <td data-label="Producto">{item.name}</td>
                          <td data-label="Cantidad">{item.quantity}</td>
                          <td data-label="Acciones">
                            <button className="btn btn-danger" onClick={() => handleRemoveFromCart(index)}>
                              Quitar
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <p style={{ marginTop: 16 }}>
                <button className="btn btn-primary" onClick={handleConfirmSale} disabled={cart.length === 0 || confirmingSale}>
                  {confirmingSale ? 'Registrando…' : 'Confirmar venta'}
                </button>{' '}
                <button className="btn btn-outline" onClick={resetAll}>
                  Finalizar sin venta
                </button>
              </p>
            </>
          )}
        </div>
      )}
    </div>
  )
}
