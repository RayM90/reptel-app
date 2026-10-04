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

const tooMany = { success: false, message: 'Demasiados intentos. Espera unos minutos e intenta de nuevo.' }

// Login: cuenta solo los intentos FALLIDOS (4xx/5xx). Un login correcto no
// consume el cupo, así el personal no se bloquea por entrar varias veces.
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: tooMany,
})

// Registro público de clientes: evita la creación masiva de cuentas.
export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: tooMany,
})

// Verificar cédula al crear cuenta — público; limitado para que no sirva
// para recorrer cédulas en masa.
export const idCheckLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: tooMany,
})

// "Olvidé mi contraseña": evita inundar al admin con solicitudes.
export const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: tooMany,
})
