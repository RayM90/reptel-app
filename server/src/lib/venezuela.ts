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

// V/E (persona natural) o J/G (jurídico/gobierno) + 7 a 9 dígitos.
export const ID_NUMBER_PREFIXES = ['V', 'E', 'J', 'G'];

export const isValidVenezuelanIdNumber = (idNumber: string): boolean => {
  return /^[VEJG]-\d{7,9}$/.test(idNumber);
};

// El personal de RepTel es siempre persona natural (nunca jurídico/gobierno) y la cédula
// venezolana real tiene 7 u 8 dígitos — más estricto que isValidVenezuelanIdNumber de arriba,
// que sigue aceptando J/G y hasta 9 dígitos para Client (puede ser cliente jurídico).
export const isValidStaffIdNumber = (idNumber: string): boolean => {
  return /^[VE]-\d{7,8}$/.test(idNumber);
};
