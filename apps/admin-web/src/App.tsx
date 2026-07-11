import { Routes, Route } from 'react-router-dom'
import Login from './pages/auth/Login'
import ProtectedRoute from './components/ProtectedRoute'
import Dashboard from './pages/admin/Dashboard'
import TechnicianDashboard from './pages/technician/Dashboard'
import DeliveryDashboard from './pages/delivery/Dashboard'
import CreateStaff from './pages/admin/CreateStaff'
import Toast from './components/Toast'
import ConfirmDialog from './components/ConfirmDialog'

function App() {
  return (
    <>
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
          path="/admin/create-staff"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <CreateStaff />
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

      <Toast />
      <ConfirmDialog />
    </>
  )
}

export default App