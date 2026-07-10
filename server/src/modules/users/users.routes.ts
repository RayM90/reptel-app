import { Router } from 'express';
import {
  getUsers,
  getUser,
  registerUserInDB,
  updateUserData,
} from './users.controller';
import { authenticate, authorize } from '../../middleware/auth.middleware';

const router = Router();

// Listar usuarios — solo ADMIN
router.get('/', authenticate, authorize('ADMIN'), getUsers);

// Obtener usuario por ID — solo ADMIN
router.get('/:id', authenticate, authorize('ADMIN'), getUser);

// Registrar usuario en BD — solo ADMIN
router.post('/', authenticate, authorize('ADMIN'), registerUserInDB);

// Actualizar usuario — solo ADMIN
router.patch('/:id', authenticate, authorize('ADMIN'), updateUserData);

export default router;