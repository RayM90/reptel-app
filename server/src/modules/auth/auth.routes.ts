// server/src/modules/auth/auth.routes.ts
import { Router } from 'express';
import { register, login, refresh } from './auth.controller';
import { registerUser, loginUser, refreshUserToken } from './auth.service';
const router = Router();

// Registro de usuario
router.post('/register', register);

// Login
router.post('/login', login);

// Refresh token
router.post('/refresh', refresh);

export default router;

export const refresh = async (req: Request, res: Response): Promise<void> => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      res.status(400).json({ message: 'Refresh token requerido' });
      return;
    }

    const tokens = await refreshUserToken(refreshToken);

    res.status(200).json({
      success: true,
      data: {
        token: tokens.accessToken,
      }
    });
  } catch (error: any) {
    res.status(401).json({ message: error.message || 'Token inválido o expirado' });
  }
};