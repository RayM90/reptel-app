/**
 * @file index.ts
 * @description Punto de entrada principal del servidor RepTel API.
 * Configura Express, middlewares globales y registra todas las rutas
 * de la aplicación.
 * @module Server
 */

import express from 'express'
import dotenv from 'dotenv'
import ordersRouter from './modules/orders/orders.routes'
import authRouter from './modules/auth/auth.routes'
import usersRouter from './modules/users/users.routes'
import devicesRouter from './modules/devices/devices.routes'

dotenv.config()

const app = express()
const PORT = Number(process.env.PORT) || 3000

app.use(express.json())

// ─── Rutas ────────────────────────────────────────────────────────────────────

/** Ruta raíz — verificación de estado del servidor */
app.get('/', (req, res) => {
  res.json({ 
    message: 'RepTel API funcionando correctamente',
    version: '1.0.0'
  })
})

/** Rutas de autenticación — registro y login */
app.use('/api/auth', authRouter)

/** Rutas de usuarios — gestión de usuarios del sistema */
app.use('/api/users', usersRouter)

/** Rutas de dispositivos — gestión de equipos del taller */
app.use('/api/devices', devicesRouter)

/** Rutas de órdenes — gestión de órdenes de reparación */
app.use('/api/orders', ordersRouter)

// ─── Servidor ─────────────────────────────────────────────────────────────────

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor RepTel corriendo en http://localhost:${PORT}`)
  console.log(`Red local: http://192.168.0.107:${PORT}`)
})
export default app