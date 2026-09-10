import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import path from 'path'
import ordersRouter from './modules/orders/orders.routes'
import authRouter from './modules/auth/auth.routes'
import usersRouter from './modules/users/users.routes'
import devicesRouter from './modules/devices/devices.routes'
import clientsRouter from './modules/clients/clients.routes'
import catalogRouter from './modules/catalog/catalog.routes'
import productsRouter from './modules/products/products.routes'
import reportsRouter from './modules/reports/reports.routes'
import settingsRouter from './modules/settings/settings.routes'

dotenv.config()

const app = express()

app.use(cors())
app.use(express.json())
app.use(express.static(path.join(__dirname, 'public')))

// ─── Rutas ────────────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    message: 'RepTel API funcionando correctamente',
    version: '1.0.0'
  })
})

app.use('/api/auth', authRouter)
app.use('/api/users', usersRouter)
app.use('/api/devices', devicesRouter)
app.use('/api/orders', ordersRouter)
app.use('/api/clients', clientsRouter)
app.use('/api/catalog', catalogRouter)
app.use('/api/products', productsRouter)
app.use('/api/reports', reportsRouter)
app.use('/api/settings', settingsRouter)

export default app