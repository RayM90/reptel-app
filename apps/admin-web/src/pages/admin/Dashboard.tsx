import { useEffect, useState } from 'react'
import { api } from '../../services/api'

interface Order {
  id: string
  orderNumber: string
  status: string
  problem: string
  budget: string | null
  client: { name: string; lastName: string }
  technician: { id: string; name: string } | null
}

interface ProductOrderItem {
  product: { name: string }
  quantity: number
}

interface ProductOrder {
  id: string
  status: string
  total: string
  client: { name: string; lastName: string }
  items: ProductOrderItem[]
  delivery: { agent: { name: string } } | null
}

export default function Dashboard() {
  const [orders, setOrders] = useState<Order[]>([])
  const [productOrders, setProductOrders] = useState<ProductOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    setError('')
    try {
      const [ordersRes, productOrdersRes] = await Promise.all([
        api.get('/api/orders'),
        api.get('/api/product-orders'),
      ])
      setOrders(ordersRes.data.data)
      setProductOrders(productOrdersRes.data.data)
    } catch (err) {
      setError('Error al cargar los datos del panel')
    } finally {
      setLoading(false)
    }
  }

  const activeOrders = orders.filter(
    (o) => o.status !== 'DELIVERED' && o.status !== 'CANCELLED'
  )

  const activeProductOrders = productOrders.filter(
    (po) => po.status !== 'DELIVERED' && po.status !== 'CANCELLED'
  )

  if (loading) return <p>Cargando...</p>
  if (error) return <p>{error}</p>

  return (
    <div>
      <h1>Panel de Administrador</h1>

      <section>
        <h2>Servicios Técnicos Activos ({activeOrders.length})</h2>
        {activeOrders.length === 0 ? (
          <p>No hay servicios activos</p>
        ) : (
          <table border={1} cellPadding={8}>
            <thead>
              <tr>
                <th>Orden</th>
                <th>Cliente</th>
                <th>Problema</th>
                <th>Estado</th>
                <th>Presupuesto</th>
                <th>Técnico asignado</th>
              </tr>
            </thead>
            <tbody>
              {activeOrders.map((order) => (
                <tr key={order.id}>
                  <td>{order.orderNumber}</td>
                  <td>{order.client.name} {order.client.lastName}</td>
                  <td>{order.problem}</td>
                  <td>{order.status}</td>
                  <td>{order.budget ? `$${order.budget}` : '—'}</td>
                  <td>{order.technician?.name || 'Sin asignar'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section>
        <h2>Pedidos de Tienda Activos ({activeProductOrders.length})</h2>
        {activeProductOrders.length === 0 ? (
          <p>No hay pedidos activos</p>
        ) : (
          <table border={1} cellPadding={8}>
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Productos</th>
                <th>Total</th>
                <th>Estado</th>
                <th>Motorizado asignado</th>
              </tr>
            </thead>
            <tbody>
              {activeProductOrders.map((po) => (
                <tr key={po.id}>
                  <td>{po.client.name} {po.client.lastName}</td>
                  <td>{po.items.map((i) => `${i.product.name} x${i.quantity}`).join(', ')}</td>
                  <td>${po.total}</td>
                  <td>{po.status}</td>
                  <td>{po.delivery?.agent.name || 'Sin asignar'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}