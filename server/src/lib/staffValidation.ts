// Reglas propias del personal de RepTel (no son formato venezolano, ver lib/venezuela.ts):
// el correo institucional y el formato de nombre/apellido exigidos al crear un empleado.

export const STAFF_EMAIL_DOMAIN = '@reptel.com';

const STAFF_EMAIL_LOCAL_PART_REGEX = /^[a-z0-9._-]{2,30}$/;

export const isValidStaffEmail = (email: string): boolean => {
  const normalized = email.trim().toLowerCase();
  if (!normalized.endsWith(STAFF_EMAIL_DOMAIN)) return false;
  const localPart = normalized.slice(0, -STAFF_EMAIL_DOMAIN.length);
  return STAFF_EMAIL_LOCAL_PART_REGEX.test(localPart);
};

const PERSON_NAME_REGEX = /^[A-Za-zÁÉÍÓÚÑÜáéíóúñü ]{2,50}$/;

export const isValidPersonName = (value: string): boolean => {
  return PERSON_NAME_REGEX.test(value.trim());
};
