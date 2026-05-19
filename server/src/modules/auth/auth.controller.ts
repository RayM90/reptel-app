import { Request, Response } from 'express';
import { registerUser, loginUser } from './auth.service';
import prisma from '../../lib/prisma';
import jwt from 'jsonwebtoken';

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
    console.log('Login attempt:', { email, password })

    if (!email || !password) {
      res.status(400).json({ message: 'Email y contraseña son requeridos' });
      return;
    }

    const tokens = await loginUser(email, password)

    const decoded = jwt.decode(tokens.idToken!) as any

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
      }
    })

    if (!user) {
      res.status(404).json({ message: 'Usuario no encontrado en el sistema' })
      return
    }

    res.status(200).json({
      success: true,
      data: {
        user,
        token: tokens.accessToken,
        idToken: tokens.idToken,
        refreshToken: tokens.refreshToken,
      }
    })
  } catch (error: any) {
    res.status(401).json({ message: error.message || 'Credenciales inválidas' });
  }
};