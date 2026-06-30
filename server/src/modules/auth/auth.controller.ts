import { Request, Response } from 'express';
import { registerUser, loginUser, refreshUserToken } from './auth.service';
import prisma from '../../lib/prisma';
import jwt from 'jsonwebtoken';

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, name, role, phone, address } = req.body;

    if (!email || !password || !name || !role) {
      res.status(400).json({ message: 'Todos los campos son requeridos' });
      return;
    }

    const validRoles = ['ADMIN', 'TECHNICIAN', 'TECHNICIAN_DELIVERY', 'DELIVERY', 'SUPPORT', 'CLIENT'];
    if (!validRoles.includes(role)) {
      res.status(400).json({ message: 'Rol inválido' });
      return;
    }

    // Ahora se pasan phone y address al service
    const result = await registerUser(email, password, name, role, phone, address);
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

    // Buscar user con su client vinculado
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        clientId: true,
        client: {
          select: {
            id: true,
            address: true,
            phone: true,
            idNumber: true,
          }
        }
      }
    })

    if (!user) {
      res.status(404).json({ message: 'Usuario no encontrado en el sistema' })
      return
    }

    res.status(200).json({
      success: true,
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          clientId: user.clientId,
          address: user.client?.address ?? null,
        },
        token: tokens.idToken,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      }
    })
  } catch (error: any) {
    res.status(401).json({ message: error.message || 'Credenciales inválidas' });
  }
};

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
        token: tokens.idToken,
        accessToken: tokens.accessToken,
      }
    });
  } catch (error: any) {
    res.status(401).json({ message: error.message || 'Token inválido o expirado' });
  }
};