import { Request, Response } from 'express';
import { registerUser, loginUser, refreshUserToken, completeNewPasswordChallenge, createStaffUser } from './auth.service';
import { translateCognitoError } from './auth.errors';
import prisma from '../../lib/prisma';
import jwt from 'jsonwebtoken';
import { formatClientAddress } from '../../lib/clientAddress';
import { isValidVenezuelanPhone, isValidVenezuelanIdNumber } from '../../lib/venezuela';

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, name, role, phone, address } = req.body;

    if (!email || !password || !name || !role) {
      res.status(400).json({ message: 'Todos los campos son requeridos' });
      return;
    }

    // Este endpoint es público (sin autenticación) — solo puede usarse para
    // el auto-registro de clientes desde la app móvil. Crear personal
    // (ADMIN, TECHNICIAN_DELIVERY, DELIVERY) requiere el endpoint protegido
    // POST /staff (pendiente de construir), nunca este.
    if (role !== 'CLIENT') {
      res.status(403).json({ message: 'Este endpoint solo permite el registro de clientes' });
      return;
    }

    if (phone && !isValidVenezuelanPhone(phone)) {
      res.status(400).json({ message: 'El teléfono debe ser un número venezolano válido (04XX + 7 dígitos)' });
      return;
    }

    const result = await registerUser(email, password, name, role, phone, address);
    res.status(201).json(result);
  } catch (error: any) {
    res.status(400).json({ message: translateCognitoError(error) || 'Error al registrar usuario' });
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

    // Cognito exige cambio de contraseña (usuario creado por admin, primer login)
    if (tokens.challengeName === 'NEW_PASSWORD_REQUIRED') {
      res.status(200).json({
        success: true,
        data: {
          challengeName: 'NEW_PASSWORD_REQUIRED',
          session: tokens.session,
          email,
        },
      });
      return;
    }

    const decoded = jwt.decode(tokens.idToken!) as any;

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        name: true,
        lastName: true,
        email: true,
        phone: true,
        role: true,
        clientId: true,
        client: {
          select: {
            id: true,
            addressState: true,
            addressCity: true,
            addressNeighborhood: true,
            addressStreet: true,
            addressBuilding: true,
            phone: true,
            idNumber: true,
          }
        }
      }
    });

    if (!user) {
      res.status(404).json({ message: 'Usuario no encontrado en el sistema' });
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        user: {
          id: user.id,
          name: user.name,
          lastName: user.lastName,
          email: user.email,
          phone: user.phone,
          role: user.role,
          clientId: user.clientId,
          address: formatClientAddress(user.client),
        },
        token: tokens.idToken,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      }
    });
  } catch (error: any) {
    res.status(401).json({ message: translateCognitoError(error) || 'Credenciales inválidas' });
  }
};

/**
 * Completa el challenge NEW_PASSWORD_REQUIRED con la nueva contraseña del usuario
 * y devuelve la misma forma de respuesta que /login exitoso.
 */
export const completeNewPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, newPassword, session } = req.body;

    if (!email || !newPassword || !session) {
      res.status(400).json({ message: 'Email, nueva contraseña y sesión son requeridos' });
      return;
    }

    const tokens = await completeNewPasswordChallenge(email, newPassword, session);

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        name: true,
        lastName: true,
        email: true,
        phone: true,
        role: true,
        clientId: true,
        client: {
          select: {
            id: true,
            addressState: true,
            addressCity: true,
            addressNeighborhood: true,
            addressStreet: true,
            addressBuilding: true,
            phone: true,
            idNumber: true,
          }
        }
      }
    });

    if (!user) {
      res.status(404).json({ message: 'Usuario no encontrado en el sistema' });
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        user: {
          id: user.id,
          name: user.name,
          lastName: user.lastName,
          email: user.email,
          phone: user.phone,
          role: user.role,
          clientId: user.clientId,
          address: formatClientAddress(user.client),
        },
        token: tokens.idToken,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      }
    });
  } catch (error: any) {
    res.status(400).json({ message: translateCognitoError(error) || 'Error al establecer nueva contraseña' });
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

/**
 * ADMIN crea un usuario de personal (TECHNICIAN_DELIVERY, DELIVERY o TECHNICIAN).
 * Nunca permite crear otro ADMIN desde este endpoint — evita escalación
 * de privilegios accidental o mal uso.
 */
export const createStaff = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, name, lastName, idNumber, role, phone } = req.body;

    if (!email || !password || !name || !lastName || !idNumber || !role) {
      res.status(400).json({ message: 'Todos los campos son requeridos' });
      return;
    }

    if (role !== 'TECHNICIAN_DELIVERY' && role !== 'DELIVERY' && role !== 'TECHNICIAN') {
      res.status(403).json({ message: 'Este endpoint solo permite crear TECHNICIAN_DELIVERY, DELIVERY o TECHNICIAN' });
      return;
    }

    if (password.length < 8) {
      res.status(400).json({ message: 'La contraseña temporal debe tener al menos 8 caracteres' });
      return;
    }

    if (!isValidVenezuelanIdNumber(idNumber)) {
      res.status(400).json({ message: 'La cédula debe tener el formato V-12345678 o E-12345678' });
      return;
    }

    if (phone && !isValidVenezuelanPhone(phone)) {
      res.status(400).json({ message: 'El teléfono debe ser un número venezolano válido (04XX + 7 dígitos)' });
      return;
    }

    const existing = await prisma.user.findUnique({ where: { idNumber } });
    if (existing) {
      res.status(400).json({ message: 'Ya existe un empleado con esa cédula' });
      return;
    }

    const result = await createStaffUser(email, name, password, role, phone, lastName, idNumber);
    res.status(201).json(result);
  } catch (error: any) {
    res.status(400).json({ message: translateCognitoError(error) || 'Error al crear el empleado' });
  }
};