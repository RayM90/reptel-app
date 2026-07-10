// server/src/modules/auth/auth.routes.ts
import { Router } from 'express';
import { register, login, refresh, completeNewPassword, createStaff } from './auth.controller';
import { authenticate, authorize } from '../../middleware/auth.middleware';

const router = Router();

// Registro de usuario — endpoint público, pero el controller solo permite role: CLIENT
router.post('/register', register);

// ADMIN crea un usuario de personal (técnico o motorizado)
router.post('/staff', authenticate, authorize('ADMIN'), createStaff);

// Login
router.post('/login', login);

// Completar cambio de contraseña obligatorio (primer login de usuarios creados por admin)
router.post('/complete-new-password', completeNewPassword);

// Refresh token
router.post('/refresh', refresh);

export default router;