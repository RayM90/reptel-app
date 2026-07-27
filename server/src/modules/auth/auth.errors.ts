/**
 * Traduce errores de AWS Cognito (siempre en inglés) al español antes de
 * devolverlos al cliente. Se centraliza aquí para que mobile y admin-web
 * reciban el mismo mensaje ya traducido desde /api/auth/*, en vez de que
 * cada frontend tenga que adivinar/traducir el texto crudo del SDK.
 *
 * Se prioriza `error.name` (nombre de excepción de Cognito, estable) sobre
 * el contenido de `error.message` (texto libre que puede variar).
 */
export const translateCognitoError = (error: any): string => {
  const name: string = error?.name ?? '';
  const message: string = error?.message ?? '';

  switch (name) {
    case 'NotAuthorizedException':
      if (message.includes('Password attempts exceeded'))
        return 'Se superó el número de intentos permitidos. Intenta de nuevo más tarde';
      return 'Usuario o contraseña incorrectos';
    case 'UserNotFoundException':
      return 'No existe una cuenta con ese correo electrónico';
    case 'UserNotConfirmedException':
      return 'La cuenta no ha sido confirmada';
    case 'PasswordResetRequiredException':
      return 'Debes restablecer tu contraseña para continuar';
    case 'UsernameExistsException':
      return 'Ya existe una cuenta con ese correo electrónico';
    case 'TooManyRequestsException':
    case 'TooManyFailedAttemptsException':
    case 'LimitExceededException':
      return 'Demasiados intentos. Espera un momento e inténtalo de nuevo';
    case 'InvalidParameterException':
    case 'InvalidPasswordException':
      return translatePasswordPolicy(message);
    case 'CodeMismatchException':
      return 'El código ingresado no es válido';
    case 'ExpiredCodeException':
      return 'El código ha expirado';
  }

  return translatePasswordPolicy(message);
};

function translatePasswordPolicy(message: string): string {
  if (message.includes('lowercase'))
    return 'La contraseña debe contener al menos una letra minúscula';
  if (message.includes('uppercase'))
    return 'La contraseña debe contener al menos una letra mayúscula';
  if (message.includes('numeric'))
    return 'La contraseña debe contener al menos un número';
  if (message.includes('symbol') || message.includes('special'))
    return 'La contraseña debe contener al menos un carácter especial (!@#$...)';
  if (message.includes('long enough') || message.includes('8 characters'))
    return 'La contraseña debe tener al menos 8 caracteres';
  if (message.includes('Invalid email'))
    return 'El correo electrónico no es válido';
  if (message.includes('Password did not conform'))
    return 'La contraseña no cumple los requisitos: mínimo 8 caracteres, mayúscula, minúscula, número y símbolo';
  return message;
}
