// Validaciones de formato venezolano compartidas por los controllers que
// reciben teléfono/cédula como campo propio de la persona (Client/User)
// escrito directamente por un usuario — no se aplica a payloads de pago
// (paymentDetails es JSON libre) ni al idNumber placeholder que usa el
// auto-registro de clientes (ver auth.service.ts registerUser).

const PHONE_PREFIXES = ['0412', '0414', '0416', '0424', '0426'];

export const isValidVenezuelanPhone = (phone: string): boolean => {
  if (!/^\d{11}$/.test(phone)) return false;
  return PHONE_PREFIXES.includes(phone.slice(0, 4));
};

// V o E + 7 u 8 dígitos.
export const isValidVenezuelanIdNumber = (idNumber: string): boolean => {
  return /^[VE]-\d{7,8}$/.test(idNumber);
};
