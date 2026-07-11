// Configuración compartida entre los paneles internos (Admin, Motorizado, Técnico).
// Los 3 usan el mismo intervalo de polling para que la actualización automática
// quede coordinada entre ellos. Prototipo de tesis — valor fijo, no configurable
// todavía. El mobile (apps/mobile) usa su propia constante local con el mismo
// valor, ya que no comparte código con admin-web.
export const POLL_INTERVAL_MS = 20000