// server/src/modules/auth/auth.routes.ts
import { Router } from 'express';
import { register, login, refresh } from './auth.controller';
const router = Router();

// Registro de usuario
router.post('/register', register);

// Login
router.post('/login', login);

// Refresh token
router.post('/refresh', refresh);

export default router;
