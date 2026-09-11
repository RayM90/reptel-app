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

/**
 * Resultado de decidir qué Client debe usar un auto-registro de cliente.
 * Discriminado por `type` para que el caller no tenga que re-derivar el
 * estado a partir de excepciones genéricas.
 */
export type ClientRegistrationResolution =
  | { type: 'create' }
  | { type: 'reuse'; clientId: string }
  | { type: 'already_registered' }
  | { type: 'verification_failed' };

/** La cédula ya tiene una cuenta (User) vinculada — no se puede volver a registrar. */
export class ClientAlreadyRegisteredError extends Error {}
/** Existe un Client walk-in (sin User) con esa cédula, pero no se pudo verificar identidad. */
export class ClientVerificationFailedError extends Error {}

/**
 * Decide qué Client debe usar un auto-registro, dadas la cédula y el
 * teléfono enviados en el formulario. Solo consulta Prisma — no toca
 * Cognito — por lo que se puede unit-testear directamente.
 *
 * - No existe ningún Client con esa cédula → 'create' (el caller crea uno).
 * - Existe un Client con User ya vinculado → 'already_registered'.
 * - Existe un Client SIN User (lo creó Recepción en persona) y el teléfono
 *   enviado coincide exactamente con Client.phone → 'reuse'.
 * - Existe ese mismo Client walk-in pero el teléfono no coincide o no se
 *   envió → 'verification_failed'. La cédula no es secreta en Venezuela y
 *   Cognito auto-confirma sin verificar el correo, así que sin esta
 *   verificación cualquiera que conozca la cédula de otra persona podría
 *   apropiarse de su cuenta y de las órdenes asociadas.
 */
export const resolveClientForRegistration = async (
  idNumber: string,
  phone?: string
): Promise<ClientRegistrationResolution> => {
  const existingClient = await prisma.client.findUnique({
    where: { idNumber },
    include: { user: true },
  });

  if (!existingClient) {
    return { type: 'create' };
  }

  if (existingClient.user) {
    return { type: 'already_registered' };
  }

  if (phone && phone === existingClient.phone) {
    return { type: 'reuse', clientId: existingClient.id };
  }

  return { type: 'verification_failed' };
};

/**
 * Arma el payload de `prisma.user.create` para el auto-registro de CLIENT.
 * Pura (sin I/O) para poder confirmar en un test, sin tocar Prisma ni
 * Cognito, que lastName/idNumber quedan en el User (antes se perdían:
 * solo se guardaban en Client) — el mismo patrón que ya usa createStaffUser.
 */
export const buildClientUserCreateData = (
  email: string,
  name: string,
  lastName: string,
  idNumber: string,
  role: string,
  phone: string | undefined,
  clientId: string | undefined,
) => ({
  email,
  name,
  lastName,
  idNumber,
  role: role as any,
  phone: phone ?? null,
  password: '',
  clientId: clientId ?? null,
});

export const registerUser = async (
  email: string,
  password: string,
  name: string,
  lastName: string,
  idNumber: string,
  role: string,
  phone?: string,
  addressState?: string,
  addressCity?: string,
  addressNeighborhood?: string,
  addressStreet?: string,
  addressBuilding?: string,
) => {
  // 0. Resolver ANTES de tocar Cognito: si esto rechaza, no debe quedar
  //    ningún usuario huérfano en Cognito (SignUp/Confirm/AddToGroup ya
  //    habrían corrido si este chequeo fuera posterior — ese era el bug).
  //    Solo aplica a CLIENT: es el único caller de esta función.
  let clientId: string | undefined = undefined;
  let createClientAfterCognito = false;
  if (role === 'CLIENT') {
    // idNumber también es @unique en User (ver createStaffUser) — evita que
    // una cédula de personal choque más adelante con un P2002 crudo.
    const existingUserWithIdNumber = await prisma.user.findUnique({ where: { idNumber } });
    if (existingUserWithIdNumber) {
      throw new ClientAlreadyRegisteredError('Ya existe una cuenta para esta cédula. Inicia sesión en su lugar.');
    }

    const resolution = await resolveClientForRegistration(idNumber, phone);
    if (resolution.type === 'already_registered') {
      throw new ClientAlreadyRegisteredError('Ya existe una cuenta para esta cédula. Inicia sesión en su lugar.');
    }
    if (resolution.type === 'verification_failed') {
      throw new ClientVerificationFailedError(
        'No pudimos verificar tu identidad para esta cédula. Visita Recepción para vincular tu cuenta.'
      );
    }
    if (resolution.type === 'reuse') {
      clientId = resolution.clientId;
    } else {
      createClientAfterCognito = true;
    }
  }

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

  // 4. Si es CLIENT y no se reutilizó un Client existente (ver paso 0),
  //    crearlo ahora.
  if (createClientAfterCognito) {
    const newClient = await prisma.client.create({
      data: {
        name,
        lastName,
        idNumber,
        phone: phone ?? '',
        email,
        addressState: addressState ?? null,
        addressCity: addressCity ?? null,
        addressNeighborhood: addressNeighborhood ?? null,
        addressStreet: addressStreet ?? null,
        addressBuilding: addressBuilding ?? null,
      },
    });
    clientId = newClient.id;
  }

  // 5. Crear User vinculado al Client si aplica. lastName/idNumber se
  //    guardan siempre — el único caller de registerUser es el endpoint de
  //    auto-registro de CLIENT (auth.controller.ts ya restringe el role).
  const user = await prisma.user.create({
    data: buildClientUserCreateData(email, name, lastName, idNumber, role, phone, clientId),
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