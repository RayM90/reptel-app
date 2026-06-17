/**
 * @file auth.service.ts
 * @description Servicio de autenticación para RepTel API.
 * Maneja el registro y login de usuarios mediante AWS Cognito,
 * incluyendo confirmación automática y asignación de roles por grupos.
 * @module Auth
 */

import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  SignUpCommand,
  AdminAddUserToGroupCommand,
  AdminConfirmSignUpCommand,
} from '@aws-sdk/client-cognito-identity-provider';

import prisma from '../../lib/prisma';

/** Cliente de AWS Cognito configurado con la región del proyecto */
const client = new CognitoIdentityProviderClient({
  region: process.env.AWS_REGION!,
});

const CLIENT_ID = process.env.COGNITO_CLIENT_ID!;
const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID!;

/**
 * Registra un nuevo usuario en AWS Cognito y en la base de datos local
 * - Crea el usuario con email y contraseña
 * - Confirma automáticamente la cuenta
 * - Asigna el grupo/rol correspondiente
 * - Guarda el usuario en MySQL via Prisma
 * @param email - Correo electrónico del usuario
 * @param password - Contraseña del usuario (manejada por Cognito)
 * @param name - Nombre completo del usuario
 * @param role - Rol a asignar
 * @param phone - Teléfono del usuario (opcional)
 */
export const registerUser = async (
  email: string,
  password: string,
  name: string,
  role: string,
  phone?: string,
) => {
  // 1. Registrar usuario en Cognito
  await client.send(
    new SignUpCommand({
      ClientId: CLIENT_ID,
      Username: email,
      Password: password,
      UserAttributes: [
        { Name: 'email', Value: email },
        { Name: 'name', Value: name },
      ],
    })
  );

  // 2. Confirmar automáticamente sin requerir verificación por email
  await client.send(
    new AdminConfirmSignUpCommand({
      UserPoolId: USER_POOL_ID,
      Username: email,
    })
  );

  // 3. Asignar el grupo/rol al usuario
  await client.send(
    new AdminAddUserToGroupCommand({
      UserPoolId: USER_POOL_ID,
      Username: email,
      GroupName: role,
    })
  );

  // 4. Guardar usuario en base de datos local
  // password se guarda vacío porque Cognito maneja la autenticación
  const user = await prisma.user.create({
    data: {
      email,
      name,
      role: role as any,
      phone: phone ?? null,
      password: '',
    },
  });

  return { message: 'Usuario registrado exitosamente', userId: user.id };
};

/**
 * Autentica un usuario con email y contraseña
 * @param email - Correo electrónico del usuario
 * @param password - Contraseña del usuario
 * @returns Tokens JWT: accessToken, refreshToken, idToken
 */
export const loginUser = async (email: string, password: string) => {
  const response = await client.send(
    new InitiateAuthCommand({
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: CLIENT_ID,
      AuthParameters: {
        USERNAME: email,
        PASSWORD: password,
      },
    })
  );

  return {
    accessToken: response.AuthenticationResult?.AccessToken,
    refreshToken: response.AuthenticationResult?.RefreshToken,
    idToken: response.AuthenticationResult?.IdToken,
  };
};

/**
 * Renueva el token de acceso usando el refresh token de Cognito
 * @param refreshToken - Token de refresco obtenido en el login
 * @returns Nuevo accessToken
 */
export const refreshUserToken = async (refreshToken: string) => {
  const response = await client.send(
    new InitiateAuthCommand({
      AuthFlow: "REFRESH_TOKEN_AUTH",
      ClientId: CLIENT_ID,
      AuthParameters: {
        REFRESH_TOKEN: refreshToken,
      },
    })
  );

  return {
    accessToken: response.AuthenticationResult?.AccessToken,
    idToken: response.AuthenticationResult?.IdToken,
  };
};