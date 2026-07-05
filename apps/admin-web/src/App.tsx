import { Routes, Route } from 'react-router-dom'
import Login from './pages/auth/Login'

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<h1>RepTel Admin — Dashboard (pendiente)</h1>} />
    </Routes>
  )
}

export default App