import { Request, Response, NextFunction } from 'express';
import { CognitoJwtVerifier } from 'aws-jwt-verify';

const verifier = CognitoJwtVerifier.create({
  userPoolId: process.env.COGNITO_USER_POOL_ID!,
  tokenUse: 'access',
  clientId: process.env.COGNITO_CLIENT_ID!,
});

export interface AuthRequest extends Request {
  user?: {
    sub: string;
    email: string;
    groups: string[];
  };
}

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