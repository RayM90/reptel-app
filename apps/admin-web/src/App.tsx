import { Routes, Route } from 'react-router-dom'
import Login from './pages/auth/Login'
import ProtectedRoute from './components/ProtectedRoute'
import Dashboard from './pages/admin/Dashboard'

function TechnicianDashboard() {
  return <h1>Panel de Técnico — Mis Órdenes (pendiente)</h1>
}

function DeliveryDashboard() {
  return <h1>Panel de Motorizado — Mis Entregas (pendiente)</h1>
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route
        path="/admin"
        element={
          <ProtectedRoute allowedRoles={['ADMIN']}>
            <Dashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/technician"
        element={
          <ProtectedRoute allowedRoles={['TECHNICIAN_DELIVERY']}>
            <TechnicianDashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/delivery"
        element={
          <ProtectedRoute allowedRoles={['DELIVERY']}>
            <DeliveryDashboard />
          </ProtectedRoute>
        }
      />
    </Routes>
  )
}

export default App