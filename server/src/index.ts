import express from 'express'
import dotenv from 'dotenv'
import ordersRouter from './modules/orders/orders.routes'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3000

app.use(express.json())

// Rutas
app.get('/', (req, res) => {
  res.json({ 
    message: 'RepTel API funcionando correctamente',
    version: '1.0.0'
  })
})

app.use('/api/orders', ordersRouter)

app.listen(PORT, () => {
  console.log(`Servidor RepTel corriendo en http://localhost:${PORT}`)
})

export default app