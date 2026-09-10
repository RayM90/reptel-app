import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../services/api'
import { useToastStore } from '../../store/toast.store'
import { useAuthStore } from '../../store/auth.store'
import PhoneInput from '../../components/PhoneInput'
import IdNumberInput from '../../components/IdNumberInput'
import SelectWithOther from '../../components/SelectWithOther'
import { DEVICE_BRANDS, BRAND_MODELS, DEVICE_COLORS, VENEZUELAN_BANKS } from '../../constants/venezuela'

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

interface CatalogItem {
  id: string
  name: string
  basePrice: string
}

const emptyOrderForm = {
  deviceType: 'LAPTOP',
  brand: '',
  model: '',
  color: '',
  accessories: '',
  devicePassword: '',
  problem: '',
  serviceCatalogId: '',
  advancePaymentMethod: 'PAGO_MOVIL',
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
  const role = useAuthStore((state) => state.user?.role)

  const [todaySales, setTodaySales] = useState<{ salesCount: number; salesTotal: number } | null>(null)

  useEffect(() => {
    api.get('/api/products/summary/today').then((res) => setTodaySales(res.data.data)).catch(() => {})
  }, [])

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

  // ── Paso 2: orden de servicio técnico ──
  const [catalog, setCatalog] = useState<CatalogItem[]>([])
  const [orderForm, setOrderForm] = useState(emptyOrderForm)
  const [noAccessories, setNoAccessories] = useState(false)
  const [noDevicePassword, setNoDevicePassword] = useState(false)
  const [showDevicePassword, setShowDevicePassword] = useState(false)
  const [paymentDetails, setPaymentDetails] = useState({ banco: '', telefono: '', referencia: '', correo: '', uid: '', nombre: '' })
  const [creatingOrder, setCreatingOrder] = useState(false)
  const [orderError, setOrderError] = useState('')
  const [lastCreatedTechnician, setLastCreatedTechnician] = useState('')

  useEffect(() => {
    if (step === 'sale') {
      fetchProducts()
      fetchCatalog()
    }
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

  const fetchCatalog = async () => {
    try {
      const response = await api.get('/api/catalog')
      setCatalog(response.data.data)
    } catch (err) {
      showToast('No se pudo cargar el catálogo de servicios', 'error')
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
    setOrderForm(emptyOrderForm)
    setOrderError('')
    setNoAccessories(false)
    setNoDevicePassword(false)
    setShowDevicePassword(false)
    setPaymentDetails({ banco: '', telefono: '', referencia: '', correo: '', uid: '', nombre: '' })
    setLastCreatedTechnician('')
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
      api.get('/api/products/summary/today').then((res) => setTodaySales(res.data.data)).catch(() => {})
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Error al registrar la venta', 'error')
      fetchProducts() // refrescar stock por si algún ítem sí se descontó antes del error
    } finally {
      setConfirmingSale(false)
    }
  }

  const handleCreateOrder = async () => {
    if (!activeClient) return
    if (!orderForm.brand || !orderForm.model || !orderForm.color || !orderForm.accessories) {
      setOrderError('Marca, modelo, color y accesorios son requeridos')
      return
    }
    if (!orderForm.problem) {
      setOrderError('La falla o servicio reportado es requerido')
      return
    }

    let details: Record<string, string>
    if (orderForm.advancePaymentMethod === 'BINANCE') {
      if (!paymentDetails.correo || !paymentDetails.uid || !paymentDetails.nombre) {
        setOrderError('Correo, UID y nombre de Binance son requeridos para confirmar el pago')
        return
      }
      details = { correo: paymentDetails.correo, uid: paymentDetails.uid, nombre: paymentDetails.nombre }
    } else {
      if (!paymentDetails.banco || !paymentDetails.telefono || !paymentDetails.referencia) {
        setOrderError('Banco, teléfono y referencia son requeridos para confirmar el pago')
        return
      }
      details = { banco: paymentDetails.banco, telefono: paymentDetails.telefono, referencia: paymentDetails.referencia }
    }

    setCreatingOrder(true)
    setOrderError('')
    try {
      const response = await api.post('/api/orders/counter', {
        clientId: activeClient.id,
        device: {
          type: orderForm.deviceType,
          brand: orderForm.brand,
          model: orderForm.model,
          color: orderForm.color,
          accessories: orderForm.accessories,
          devicePassword: orderForm.devicePassword || undefined,
        },
        problem: orderForm.problem,
        advancePaymentMethod: orderForm.advancePaymentMethod,
        paymentDetails: details,
        serviceCatalogId: orderForm.serviceCatalogId || undefined,
      })
      const technician = response.data.data.technician
      const technicianName = technician ? `${technician.name} ${technician.lastName ?? ''}`.trim() : 'sin asignar (no hay técnicos disponibles)'
      setLastCreatedTechnician(technicianName)
      showToast(`✅ Orden ${response.data.data.orderNumber} creada para ${activeClient.name} ${activeClient.lastName} — técnico asignado: ${technicianName}`, 'success')
      setOrderForm(emptyOrderForm)
      setNoAccessories(false)
    setNoDevicePassword(false)
      setShowDevicePassword(false)
      setPaymentDetails({ banco: '', telefono: '', referencia: '', correo: '', uid: '', nombre: '' })
    } catch (err: any) {
      setOrderError(err?.response?.data?.message || 'Error al crear la orden')
    } finally {
      setCreatingOrder(false)
    }
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Registro — Tienda Física</h1>
      </div>
      {todaySales && (
        <p className="form-hint">
          Ventas de mostrador hoy: <strong>{todaySales.salesCount}</strong> — monto aproximado: <strong>${todaySales.salesTotal.toFixed(2)}</strong>
        </p>
      )}
      {role === 'ADMIN' && <p><Link to="/admin">← Volver al Panel de Administrador</Link></p>}
      {role === 'TECHNICIAN' && <p><Link to="/technician">🔧 Ver reparaciones asignadas</Link></p>}

      {step === 'client' && (
        <div className="card" style={{ maxWidth: 480 }}>
          <div className="form-group">
            <label>Cédula</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <IdNumberInput
                value={idNumber}
                onChange={(v) => {
                  setIdNumber(v)
                  setSearched(false)
                  setClientExists(null)
                }}
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
                {clientExists ? (
                  <input type="text" value={form.phone} disabled />
                ) : (
                  <PhoneInput value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} required />
                )}
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
                </button>
              </p>
            </>
          )}

          <hr style={{ margin: '24px 0' }} />

          <h2>Orden de servicio técnico</h2>
          <div className="form-group">
            <label>Tipo de equipo</label>
            <select value={orderForm.deviceType} onChange={(e) => setOrderForm({ ...orderForm, deviceType: e.target.value })}>
              <option value="LAPTOP">Laptop</option>
              <option value="PC">PC</option>
            </select>
          </div>
          <div className="form-group">
            <label>Marca</label>
            <SelectWithOther
              value={orderForm.brand}
              options={[...DEVICE_BRANDS]}
              onChange={(v) => setOrderForm({ ...orderForm, brand: v, model: '' })}
            />
          </div>
          <div className="form-group">
            <label>Modelo</label>
            <SelectWithOther
              value={orderForm.model}
              options={orderForm.brand in BRAND_MODELS ? BRAND_MODELS[orderForm.brand as keyof typeof BRAND_MODELS] : []}
              onChange={(v) => setOrderForm({ ...orderForm, model: v })}
              disabledPlaceholder={!orderForm.brand ? 'Elige primero la marca' : undefined}
            />
          </div>
          <div className="form-group">
            <label>Color</label>
            <SelectWithOther
              value={orderForm.color}
              options={DEVICE_COLORS}
              onChange={(v) => setOrderForm({ ...orderForm, color: v })}
            />
          </div>
          <div className="form-group">
            <label>Accesorios</label>
            <input
              type="text"
              value={orderForm.accessories}
              onChange={(e) => setOrderForm({ ...orderForm, accessories: e.target.value })}
              placeholder="Cargador, mouse, etc."
              disabled={noAccessories}
            />
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, fontWeight: 400 }}>
              <input
                type="checkbox"
                checked={noAccessories}
                onChange={(e) => {
                  const checked = e.target.checked
                  setNoAccessories(checked)
                  setOrderForm({ ...orderForm, accessories: checked ? 'Sin accesorios' : '' })
                }}
              />
              Sin accesorios
            </label>
          </div>
          <div className="form-group">
            <label>Contraseña del equipo (opcional)</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type={showDevicePassword ? 'text' : 'password'}
                value={orderForm.devicePassword}
                onChange={(e) => setOrderForm({ ...orderForm, devicePassword: e.target.value })}
                disabled={noDevicePassword}
                autoComplete="new-password"
                name="device-password-not-login"
              />
              <button type="button" className="btn btn-outline" onClick={() => setShowDevicePassword((prev) => !prev)}>
                {showDevicePassword ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, fontWeight: 400 }}>
              <input
                type="checkbox"
                checked={noDevicePassword}
                onChange={(e) => {
                  const checked = e.target.checked
                  setNoDevicePassword(checked)
                  setOrderForm({ ...orderForm, devicePassword: '' })
                }}
              />
              Sin contraseña
            </label>
          </div>
          <div className="form-group">
            <label>Servicio del catálogo (opcional, solo referencia)</label>
            <select value={orderForm.serviceCatalogId} onChange={(e) => setOrderForm({ ...orderForm, serviceCatalogId: e.target.value })}>
              <option value="">— Ninguno / diagnóstico manual —</option>
              {catalog.map((c) => (
                <option key={c.id} value={c.id}>{c.name} (${c.basePrice})</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Descripción del problema</label>
            <textarea value={orderForm.problem} onChange={(e) => setOrderForm({ ...orderForm, problem: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Método de pago de la revisión ($15)</label>
            <select value={orderForm.advancePaymentMethod} onChange={(e) => setOrderForm({ ...orderForm, advancePaymentMethod: e.target.value })}>
              <option value="PAGO_MOVIL">Pago Móvil</option>
              <option value="TRANSFERENCIA">Transferencia</option>
              <option value="BINANCE">Binance</option>
            </select>
          </div>

          <h3>Confirmar datos del pago (verificado en persona)</h3>
          {orderForm.advancePaymentMethod === 'BINANCE' ? (
            <>
              <div className="form-group">
                <label>Correo Binance</label>
                <input type="email" value={paymentDetails.correo} onChange={(e) => setPaymentDetails({ ...paymentDetails, correo: e.target.value })} />
              </div>
              <div className="form-group">
                <label>UID Binance</label>
                <input type="text" value={paymentDetails.uid} onChange={(e) => setPaymentDetails({ ...paymentDetails, uid: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Nombre del titular</label>
                <input type="text" value={paymentDetails.nombre} onChange={(e) => setPaymentDetails({ ...paymentDetails, nombre: e.target.value })} />
              </div>
            </>
          ) : (
            <>
              <div className="form-group">
                <label>Banco</label>
                <SelectWithOther
                  value={paymentDetails.banco}
                  options={VENEZUELAN_BANKS.map((b) => b.name)}
                  onChange={(v) => setPaymentDetails({ ...paymentDetails, banco: v })}
                />
              </div>
              <div className="form-group">
                <label>Teléfono emisor</label>
                <PhoneInput value={paymentDetails.telefono} onChange={(v) => setPaymentDetails({ ...paymentDetails, telefono: v })} />
              </div>
              <div className="form-group">
                <label>Últimos 4 dígitos de la referencia</label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={4}
                  placeholder="1234"
                  value={paymentDetails.referencia}
                  onChange={(e) => setPaymentDetails({ ...paymentDetails, referencia: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                />
              </div>
            </>
          )}

          {orderError && <p className="alert-error">{orderError}</p>}
          {lastCreatedTechnician && (
            <p className="alert-success">Última orden registrada — técnico asignado: <strong>{lastCreatedTechnician}</strong></p>
          )}

          <button className="btn btn-primary" onClick={handleCreateOrder} disabled={creatingOrder}>
            {creatingOrder ? 'Creando…' : 'Registrar orden'}
          </button>

          <p style={{ marginTop: 16 }}>
            <button className="btn btn-outline" onClick={resetAll}>
              Finalizar — buscar otro cliente
            </button>
          </p>
        </div>
      )}
    </div>
  )
}
