// Configuración compartida entre los paneles internos (Admin, Motorizado, Técnico).
// Los 3 usan el mismo intervalo de polling para que la actualización automática
// quede coordinada entre ellos. Prototipo de tesis — valor fijo, no configurable
// todavía. El mobile (apps/mobile) usa su propia constante local con el mismo
// valor, ya que no comparte código con admin-web.
export const POLL_INTERVAL_MS = 20000

// Dominio institucional obligatorio para el correo de cualquier cuenta de personal
// (Técnico/Motorizado, Técnico/Mostrador). Ver CreateStaff.tsx y
// server/src/lib/staffValidation.ts (misma regla, validada también en el backend).
export const STAFF_EMAIL_DOMAIN = '@reptel.com'