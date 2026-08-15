import rateLimit from 'express-rate-limit'

/**
 * Límite de solicitudes para el endpoint público de tracking de órdenes
 * (GET /api/orders/track/:orderNumber). Sin este límite, el rango acotado
 * de números de orden (REP-YYMMDD-XXXX, XXXX de 1000 a 9999 — 9000
 * combinaciones por día) se puede recorrer por fuerza bruta para extraer
 * datos de clientes.
 */
export const trackOrderLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Demasiadas solicitudes, intenta de nuevo más tarde' },
})
