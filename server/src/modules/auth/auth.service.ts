import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  SignUpCommand,
  AdminAddUserToGroupCommand,
  AdminConfirmSignUpCommand,
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

  // 4. Si es CLIENT, crear registro en tabla Client primero
  let clientId: string | undefined = undefined;

  if (role === 'CLIENT') {
    const newClient = await prisma.client.create({
      data: {
        name,
        lastName: '',       // se puede actualizar en el perfil
        idNumber: email,    // temporal único usando email
        phone: phone ?? '',
        email,
        address: address ?? null,
        password: '',
      },
    });
    clientId = newClient.id;
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