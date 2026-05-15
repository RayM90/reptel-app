import { Router } from 'express';
import { register, login } from './auth.controller';

const router = Router();

// Registro de usuario
router.post('/register', register);

// Login
router.post('/login', login);

export default router;