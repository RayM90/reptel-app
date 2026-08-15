/**
 * @file auth.middleware.ts
 * @description Middleware de autenticación y autorización para RepTel API.
 * Verifica tokens JWT emitidos por AWS Cognito y controla el acceso
 * a los endpoints según el rol del usuario.
 * @module Middleware
 */

import { Request, Response, NextFunction } from 'express';
import { CognitoJwtVerifier } from 'aws-jwt-verify';

/**
 * Verificador de tokens JWT configurado con el User Pool de Cognito
 */
export const verifier = CognitoJwtVerifier.create({
  userPoolId: process.env.COGNITO_USER_POOL_ID!,
  tokenUse: 'id',
  clientId: process.env.COGNITO_CLIENT_ID!,
});

/**
 * Extensión de Request para incluir datos del usuario autenticado
 */
export interface AuthRequest extends Request {
  user?: {
    sub: string;      // ID único del usuario en Cognito
    email: string;    // Email del usuario
    groups: string[]; // Roles asignados (ADMIN, TECHNICIAN, etc.)
  };
}

/**
 * Middleware de autenticación — verifica el token Bearer JWT
 * Si el token es válido, adjunta los datos del usuario al request
 */
export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ message: 'Token no proporcionado' });
      return;
    }

    const token = authHeader.split(' ')[1];
    const payload = await verifier.verify(token);

  req.user = {
      sub: payload.sub,
      email: payload.email as string,
      groups: (payload['cognito:groups'] as string[]) || [],
    };

    next();
  } catch (error) {
    res.status(401).json({ message: 'Token inválido o expirado' });
  }
};

/**
 * Middleware de autorización — verifica que el usuario tenga el rol requerido
 * @param roles - Lista de roles permitidos para acceder al endpoint
 */
export const authorize = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    const userGroups = req.user?.groups || [];
    const hasRole = roles.some(role => userGroups.includes(role));

    if (!hasRole) {
      res.status(403).json({ message: 'No tienes permisos para esta acción' });
      return;
    }

    next();
  };
};