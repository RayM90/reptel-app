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

// Tienda — costo de delivery cobrado al CLIENTE en todos los pedidos de
// tienda (ProductOrder). Se suma al total y se guarda en
// ProductOrder.deliveryCost para desglosarlo en el historial del pedido.
export const DELIVERY_COST = 5

// Motorizado — comisión fija que GANA el agente DELIVERY por cada entrega
// completada (ProductDelivery.deliveryCommission). Coincide en monto con
// DELIVERY_COST pero es un concepto distinto (lo que paga el cliente vs.
// lo que gana el motorizado); se mantienen separados a propósito para no
// acoplarlos si el monto de uno cambia sin el otro en el futuro.
export const DELIVERY_COMMISSION = 5