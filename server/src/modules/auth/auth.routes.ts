// server/src/modules/auth/auth.routes.ts
import { Router } from 'express';
import { register, login, refresh, completeNewPassword, createStaff, requestPasswordReset, listPasswordResetRequests, resolvePasswordReset, logout } from './auth.controller';
import { authenticate, authorize } from '../../middleware/auth.middleware';
import { loginLimiter, registerLimiter, passwordResetLimiter } from '../../middleware/rateLimit.middleware';

const router = Router();

// Registro de usuario — endpoint público, pero el controller solo permite role: CLIENT
router.post('/register', registerLimiter, register);

// Reset de contraseña mediado por Admin — público, mensaje siempre genérico
router.post('/request-password-reset', passwordResetLimiter, requestPasswordReset);

// ADMIN crea un usuario de personal (técnico o motorizado)
router.post('/staff', authenticate, authorize('ADMIN'), createStaff);

// ADMIN gestiona las solicitudes de reset de contraseña
router.get('/password-reset-requests', authenticate, authorize('ADMIN'), listPasswordResetRequests);
router.post('/password-reset-requests/:id/resolve', authenticate, authorize('ADMIN'), resolvePasswordReset);

// Login
router.post('/login', loginLimiter, login);

// Completar cambio de contraseña obligatorio (primer login de usuarios creados por admin)
router.post('/complete-new-password', loginLimiter, completeNewPassword);

// Cerrar sesión: revoca el token actual y el refresh token
router.post('/logout', authenticate, logout);

// Refresh token
router.post('/refresh', refresh);

export default router;