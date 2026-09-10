import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  RespondToAuthChallengeCommand,
  SignUpCommand,
  AdminAddUserToGroupCommand,
  AdminConfirmSignUpCommand,
  AdminCreateUserCommand,
} from '@aws-sdk/client-cognito-identity-provider';

import prisma from '../../lib/prisma';

const client = new CognitoIdentityProviderClient({
  region: process.env.AWS_REGION!,
});

const CLIENT_ID = process.env.COGNITO_CLIENT_ID!;
const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID!;

export const registerUser = async (
  email: string,
  password: string,
  name: string,
  lastName: string,
  idNumber: string,
  role: string,
  phone?: string,
  address?: string,
) => {
  // 1. Registrar en Cognito
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

  // 2. Confirmar automáticamente
  await client.send(
    new AdminConfirmSignUpCommand({
      UserPoolId: USER_POOL_ID,
      Username: email,
    })
  );

  // 3. Asignar grupo/rol
  await client.send(
    new AdminAddUserToGroupCommand({
      UserPoolId: USER_POOL_ID,
      Username: email,
      GroupName: role,
    })
  );

  // 4. Si es CLIENT: reutilizar el Client existente por cédula (lo pudo
  //    haber creado Recepción antes, sin cuenta todavía) en vez de crear
  //    una fila duplicada — el controller ya garantizó que si existe, no
  //    tiene un User vinculado.
  let clientId: string | undefined = undefined;
  if (role === 'CLIENT') {
    const existingClient = await prisma.client.findUnique({ where: { idNumber } });
    if (existingClient) {
      clientId = existingClient.id;
    } else {
      const newClient = await prisma.client.create({
        data: {
          name,
          lastName,
          idNumber,
          phone: phone ?? '',
          email,
          addressStreet: address ?? null,
        },
      });
      clientId = newClient.id;
    }
  }

  // 5. Crear User vinculado al Client si aplica
  const user = await prisma.user.create({
    data: {
      email,
      name,
      role: role as any,
      phone: phone ?? null,
      password: '',
      clientId: clientId ?? null,
    },
  });

  return { message: 'Usuario registrado exitosamente', userId: user.id };
};

/**
 * Login contra Cognito.
 * Si Cognito exige cambio de contraseña (usuario creado por admin, primer login),
 * devuelve challengeName + session en vez de tokens, sin lanzar error.
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

  if (response.ChallengeName) {
    return {
      challengeName: response.ChallengeName,
      session: response.Session,
      accessToken: undefined,
      refreshToken: undefined,
      idToken: undefined,
    };
  }

  return {
    challengeName: undefined,
    session: undefined,
    accessToken: response.AuthenticationResult?.AccessToken,
    refreshToken: response.AuthenticationResult?.RefreshToken,
    idToken: response.AuthenticationResult?.IdToken,
  };
};

/**
 * Completa el challenge NEW_PASSWORD_REQUIRED: establece la contraseña definitiva
 * y devuelve los tokens reales de Cognito.
 */
export const completeNewPasswordChallenge = async (
  email: string,
  newPassword: string,
  session: string
) => {
  const response = await client.send(
    new RespondToAuthChallengeCommand({
      ClientId: CLIENT_ID,
      ChallengeName: 'NEW_PASSWORD_REQUIRED',
      Session: session,
      ChallengeResponses: {
        USERNAME: email,
        NEW_PASSWORD: newPassword,
      },
    })
  );

  return {
    accessToken: response.AuthenticationResult?.AccessToken,
    refreshToken: response.AuthenticationResult?.RefreshToken,
    idToken: response.AuthenticationResult?.IdToken,
  };
};

export const refreshUserToken = async (refreshToken: string) => {
  const response = await client.send(
    new InitiateAuthCommand({
      AuthFlow: 'REFRESH_TOKEN_AUTH',
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

/**
 * ADMIN crea un usuario de personal (técnico o motorizado).
 * A diferencia de registerUser() (auto-registro del cliente con SignUpCommand),
 * este usa AdminCreateUserCommand: el ADMIN define una contraseña temporal,
 * MessageAction: 'SUPPRESS' evita que Cognito intente enviar un correo (no hay
 * SES configurado), y el usuario queda en estado FORCE_CHANGE_PASSWORD —
 * disparará el challenge NEW_PASSWORD_REQUIRED ya resuelto en el login.
 */
export const createStaffUser = async (
  email: string,
  name: string,
  tempPassword: string,
  role: string,
  phone: string | undefined,
  lastName: string,
  idNumber: string,
) => {
  await client.send(
    new AdminCreateUserCommand({
      UserPoolId: USER_POOL_ID,
      Username: email,
      TemporaryPassword: tempPassword,
      MessageAction: 'SUPPRESS',
      UserAttributes: [
        { Name: 'email', Value: email },
        { Name: 'email_verified', Value: 'true' },
        { Name: 'name', Value: `${name} ${lastName}` },
        { Name: 'given_name', Value: name },
        { Name: 'family_name', Value: lastName },
      ],
    })
  );

  await client.send(
    new AdminAddUserToGroupCommand({
      UserPoolId: USER_POOL_ID,
      Username: email,
      GroupName: role,
    })
  );

  const user = await prisma.user.create({
    data: {
      email,
      name,
      lastName,
      idNumber,
      role: role as any,
      phone: phone ?? null,
      password: 'no-usado-cognito',
    },
  });

  return {
    message: 'Empleado creado exitosamente. Deberá establecer su contraseña definitiva en el primer inicio de sesión.',
    userId: user.id,
  };
};