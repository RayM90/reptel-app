import { Routes, Route } from 'react-router-dom'
import Login from './pages/auth/Login'
import ProtectedRoute from './components/ProtectedRoute'
import RoleHome from './components/RoleHome'
import Dashboard from './pages/admin/Dashboard'
import TechnicianDashboard from './pages/technician/Dashboard'
import CreateStaff from './pages/admin/CreateStaff'
import InventoryList from './pages/admin/InventoryList'
import InventoryForm from './pages/admin/InventoryForm'
import InventoryMovements from './pages/admin/InventoryMovements'
import Reports from './pages/admin/Reports'
import Registro from './pages/admin/Registro'
import MermaForm from './pages/admin/MermaForm'
import Toast from './components/Toast'
import ConfirmDialog from './components/ConfirmDialog'

function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<RoleHome />} />
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
          path="/admin/inventory"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <InventoryList />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/inventory/new"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <InventoryForm />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/inventory/:id/edit"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <InventoryForm />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/inventory/movements"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <InventoryMovements />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/reportes"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <Reports />
            </ProtectedRoute>
          }
        />

        <Route
          path="/technician"
          element={
            <ProtectedRoute allowedRoles={['TECHNICIAN_DELIVERY', 'TECHNICIAN']}>
              <TechnicianDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/registro"
          element={
            <ProtectedRoute allowedRoles={['ADMIN', 'TECHNICIAN']}>
              <Registro />
            </ProtectedRoute>
          }
        />

        <Route
          path="/inventory/merma/new"
          element={
            <ProtectedRoute allowedRoles={['ADMIN', 'TECHNICIAN', 'TECHNICIAN_DELIVERY']}>
              <MermaForm />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<RoleHome />} />
      </Routes>

      <Toast />
      <ConfirmDialog />
    </>
  )
}

export default App