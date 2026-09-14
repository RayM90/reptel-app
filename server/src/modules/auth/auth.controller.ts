import { Request, Response } from 'express';
import { registerUser, loginUser, refreshUserToken, completeNewPasswordChallenge, createStaffUser, setTemporaryPassword } from './auth.service';
import { translateCognitoError } from './auth.errors';
import prisma from '../../lib/prisma';
import jwt from 'jsonwebtoken';
import { formatClientAddress, getPrimaryAddress } from '../../lib/clientAddress';
import { isValidVenezuelanPhone, isValidVenezuelanIdNumber, isCompanyIdNumber } from '../../lib/venezuela';

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, name, lastName, idNumber, role, phone, contactPerson, address, secondaryAddress } = req.body;

    if (!email || !password || !name || !role || !idNumber || !phone) {
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

    if (!isValidVenezuelanIdNumber(idNumber)) {
      res.status(400).json({ message: 'La cédula/RIF debe tener el formato V-12345678, E-12345678, J-123456789 o G-123456789' });
      return;
    }

    const isCompany = isCompanyIdNumber(idNumber);
    if (!isCompany && !lastName) {
      res.status(400).json({ message: 'El apellido es requerido para personas naturales (V-/E-)' });
      return;
    }

    if (!isValidVenezuelanPhone(phone)) {
      res.status(400).json({ message: 'El teléfono debe ser un número venezolano válido (04XX + 7 dígitos)' });
      return;
    }

    const addressComplete = !!address && !!address.addressState && !!address.addressCity && !!address.addressNeighborhood && !!address.addressStreet && !!address.addressBuilding;
    if (!addressComplete) {
      res.status(400).json({ message: 'La dirección completa (estado, municipio, barrio, calle y edificio/casa) es requerida' });
      return;
    }

    if (secondaryAddress) {
      const secondaryComplete = !!secondaryAddress.label && !!secondaryAddress.addressState && !!secondaryAddress.addressCity && !!secondaryAddress.addressNeighborhood && !!secondaryAddress.addressStreet && !!secondaryAddress.addressBuilding;
      if (!secondaryComplete) {
        res.status(400).json({ message: 'La segunda dirección debe tener etiqueta y los 5 campos completos, o no enviarse' });
        return;
      }
    }

    // Duplicados — se validan ANTES de llamar a Cognito para no dejar
    // cuentas huérfanas si la cédula o el correo ya existen.
    const existingByIdNumber = await prisma.client.findUnique({ where: { idNumber } });
    if (existingByIdNumber) {
      res.status(400).json({ message: 'Ya existe un cliente con esa cédula' });
      return;
    }
    const existingByEmail = await prisma.user.findUnique({ where: { email } });
    if (existingByEmail) {
      res.status(400).json({ message: 'Ya existe una cuenta con ese correo electrónico' });
      return;
    }

    const result = await registerUser({
      email,
      password,
      name,
      lastName: isCompany ? '' : lastName,
      idNumber,
      role,
      phone,
      contactPerson: isCompany ? contactPerson : undefined,
      address,
      secondaryAddress,
    });
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
            phone: true,
            idNumber: true,
            addresses: true,
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
          address: formatClientAddress(getPrimaryAddress(user.client?.addresses)),
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
            phone: true,
            idNumber: true,
            addresses: true,
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
          address: formatClientAddress(getPrimaryAddress(user.client?.addresses)),
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

    if (role !== 'TECHNICIAN_DELIVERY' && role !== 'TECHNICIAN') {
      res.status(403).json({ message: 'Este endpoint solo permite crear TECHNICIAN_DELIVERY o TECHNICIAN' });
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

// Mensaje idéntico se devuelva o no la cuenta exista — evita que este
// endpoint público sirva para enumerar qué emails están registrados.
const GENERIC_RESET_MESSAGE = 'Si el correo existe en el sistema, un administrador se pondrá en contacto para restablecer tu contraseña.';

export const requestPasswordReset = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body;
    if (!email) {
      res.status(400).json({ message: 'Email es requerido' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      await prisma.passwordResetRequest.create({ data: { email } });
    }

    res.status(200).json({ success: true, message: GENERIC_RESET_MESSAGE });
  } catch (error: any) {
    res.status(500).json({ message: 'Error al procesar la solicitud' });
  }
};

export const listPasswordResetRequests = async (_req: Request, res: Response): Promise<void> => {
  try {
    const requests = await prisma.passwordResetRequest.findMany({
      where: { status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
    });
    res.status(200).json({ success: true, data: requests });
  } catch (error: any) {
    res.status(500).json({ message: 'Error al obtener las solicitudes' });
  }
};

export const resolvePasswordReset = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id);
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 8) {
      res.status(400).json({ message: 'La contraseña temporal debe tener al menos 8 caracteres' });
      return;
    }

    const resetRequest = await prisma.passwordResetRequest.findUnique({ where: { id } });
    if (!resetRequest || resetRequest.status !== 'PENDING') {
      res.status(404).json({ message: 'Solicitud no encontrada o ya resuelta' });
      return;
    }

    await setTemporaryPassword(resetRequest.email, newPassword);

    const adminEmail = (req as any).user?.email;
    const admin = adminEmail ? await prisma.user.findUnique({ where: { email: adminEmail } }) : null;

    await prisma.passwordResetRequest.update({
      where: { id },
      data: { status: 'RESOLVED', resolvedAt: new Date(), resolvedByUserId: admin?.id },
    });

    res.status(200).json({ success: true, message: 'Contraseña temporal establecida' });
  } catch (error: any) {
    res.status(400).json({ message: translateCognitoError(error) || 'Error al resolver la solicitud' });
  }
};