// Montos fijos compartidos entre módulos.
// Prototipo de tesis — no configurables todavía (decisión consciente).

// Servicio Técnico — costo de revisión/diagnóstico dentro del pago anticipado.
// Se descuenta del total de la reparación si el cliente ACEPTA el presupuesto.
// NOTA: orders.service.ts todavía tiene este valor hardcodeado como
// ADVANCE_REVISION_AMOUNT — pendiente migrarlo a importar de acá en otra sesión,
// fuera del alcance de la Tarea 3.
export const REVISION_COST = 15

// Tienda — costo de instalación al comprar un producto marcado como
// requiresInstallation (Dirección A: vínculo Tienda-Servicio).
export const INSTALLATION_COST = 15

// Comision de delivery 
export const DELIVERY_COMMISSION = 5