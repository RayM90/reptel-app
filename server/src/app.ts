import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import path from 'path'
import ordersRouter from './modules/orders/orders.routes'
import authRouter from './modules/auth/auth.routes'
import usersRouter from './modules/users/users.routes'
import devicesRouter from './modules/devices/devices.routes'
import chatbotRouter from './modules/chatbot/chatbot.routes'
import clientsRouter from './modules/clients/clients.routes'
import catalogRouter from './modules/catalog/catalog.routes'
import productsRouter from './modules/products/products.routes'
import productOrdersRouter from './modules/product-orders/product-orders.routes'

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
app.use('/api/chatbot', chatbotRouter)
app.use('/api/clients', clientsRouter)
app.use('/api/catalog', catalogRouter)
app.use('/api/products', productsRouter)
app.use('/api/product-orders', productOrdersRouter)

export default app