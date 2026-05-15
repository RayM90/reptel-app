import { Request, Response } from 'express';
import { registerUser, loginUser } from './auth.service';

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, name, role } = req.body;

    if (!email || !password || !name || !role) {
      res.status(400).json({ message: 'Todos los campos son requeridos' });
      return;
    }

    const validRoles = ['ADMIN', 'MANAGER', 'TECHNICIAN', 'SELLER', 'CLIENT'];
    if (!validRoles.includes(role)) {
      res.status(400).json({ message: 'Rol inválido' });
      return;
    }

    const result = await registerUser(email, password, name, role);
    res.status(201).json(result);
  } catch (error: any) {
    res.status(400).json({ message: error.message || 'Error al registrar usuario' });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ message: 'Email y contraseña son requeridos' });
      return;
    }

    const tokens = await loginUser(email, password);
    res.status(200).json(tokens);
  } catch (error: any) {
    res.status(401).json({ message: error.message || 'Credenciales inválidas' });
  }
};