import { Router } from 'express';
import {
  getUsers,
  getUser,
  registerUserInDB,
  updateUserData,
} from './users.controller';
import { authenticate, authorize } from '../../middleware/auth.middleware';

const router = Router();

// Listar usuarios — solo ADMIN y MANAGER
router.get('/', authenticate, authorize('ADMIN', 'MANAGER'), getUsers);

// Obtener usuario por ID — ADMIN, MANAGER
router.get('/:id', authenticate, authorize('ADMIN', 'MANAGER'), getUser);

// Registrar usuario en BD — solo ADMIN
router.post('/', authenticate, authorize('ADMIN'), registerUserInDB);

// Actualizar usuario — ADMIN, MANAGER
router.patch('/:id', authenticate, authorize('ADMIN', 'MANAGER'), updateUserData);

export default router;