import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
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

// Solo el panel web puede llamar a la API desde un navegador. La app móvil
// no envía Origin (no es un navegador), así que no la afecta.
const allowedOrigins = (process.env.CORS_ORIGINS ?? '').split(',').map((o) => o.trim()).filter(Boolean)
const isAllowedOrigin = (origin: string) =>
  allowedOrigins.includes(origin) ||
  /^http:\/\/(localhost|127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3}):5173$/.test(origin)

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }))
app.use(cors({ origin: (origin, cb) => cb(null, !origin || isAllowedOrigin(origin)) }))
app.use(express.json({ limit: '1mb' }))
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