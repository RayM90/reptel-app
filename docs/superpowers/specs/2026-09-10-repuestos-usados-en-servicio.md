# Repuestos de inventario usados en una orden de servicio técnico

## Contexto

`InventoryChannel.SERVICIO_TECNICO` existe en el schema desde el sub-proyecto A
pero nunca se usa (ese flujo se eliminó en el sub-proyecto 2 junto con la
tienda online). Ray pide reintroducirlo, pero **no** como venta ni como el
`ProductOrder` viejo — es un registro interno: el técnico (mostrador o
delivery) que está reparando un equipo puede marcar "usé este repuesto del
inventario" contra su propia orden.

**Por qué puede pasar después de la aprobación del presupuesto:** el
diagnóstico inicial debería cubrir todo, pero mientras se repara puede
aparecer una falla adicional no vista antes que requiera un repuesto — no se
puede descartar esa posibilidad, así que agregar un repuesto no se bloquea
aunque el cliente ya haya aprobado el presupuesto original.

## Decisiones confirmadas con Ray (2026-09-10)

- Se registra **dentro del panel del técnico** (`/technician`), en el detalle
  de cada orden asignada — no es una pantalla aparte.
- El costo del repuesto **se suma automáticamente al `Order.budget`**, incluso
  si `budgetApproved` ya es `true` (sin pedir re-aprobación al cliente).
- El stock se descuenta **de inmediato** al marcar "usé este repuesto" — no
  hay confirmación de nadie más (no es una venta a un tercero, es personal
  interno usando inventario real).

## Backend

- Migración: agregar `orderId String?` a `InventoryMovement` (nullable —
  solo se llena para movimientos con `channel: SERVICIO_TECNICO`), con
  relación a `Order`.
- Nueva función en `orders.service.ts` (o `products.service.ts`, a decidir
  cuál es más natural — probablemente `orders.service.ts` porque muta
  `Order.budget`), ej. `useProductInOrder(orderId, productId, quantity, actorEmail)`:
  - Dentro de una `$transaction`:
    - Valida stock suficiente (`InsufficientStockError`, reusar la de
      `products.service.ts`).
    - Decrementa `Product.stock`.
    - Crea `InventoryMovement` (`type: 'OUT'`, `channel: 'SERVICIO_TECNICO'`,
      `orderId`, `productId`, `quantity`, `reason: 'Repuesto usado en orden ${orderNumber}'`,
      `userId: actor.id`).
    - Incrementa `Order.budget` en `quantity × product.price` (snapshot del
      precio actual del producto, igual que se aproxima en Reportes/Dashboard
      para la tienda física).
  - Devuelve la orden actualizada (con el nuevo `budget`) y el movimiento creado.
- Nuevo endpoint `POST /api/orders/:id/parts` (`authorize('TECHNICIAN_DELIVERY', 'TECHNICIAN')`)
  — body `{ productId, quantity }`. Verificar que el actor sea realmente el
  técnico asignado a esa orden (o permitir a cualquier técnico autenticado
  documentar repuestos — **a decidir**, ver "Fuera de alcance" abajo).
- Nuevo endpoint `GET /api/orders/:id/parts` (o incluir la lista directamente
  en la respuesta de `getOrderById`/`getMyTechnicianOrders` vía
  `include: { inventoryMovements: ... }` si se agrega la relación inversa en
  `Order`) — para mostrar qué repuestos ya se usaron en esa orden.

## Frontend

- `apps/admin-web/src/pages/technician/Dashboard.tsx`: dentro del detalle
  expandido de cada orden, nueva sección "Repuestos usados" — selector de
  producto (reusar el listado de `GET /api/products`) + cantidad + botón
  "Usar repuesto"; debajo, tabla con los repuestos ya registrados para esa
  orden (nombre, cantidad, quién lo registró, fecha).
- El presupuesto mostrado en pantalla debe reflejar el incremento
  inmediatamente después de agregar un repuesto (refetch de la orden).

## Decisiones confirmadas (2026-09-10, ronda 2) — listo para ejecutar

- **Quién puede agregar**: solo el técnico **asignado a esa orden**
  (`order.technicianId === actor.id`) — no cualquier técnico autenticado.
  El endpoint debe validar esto y devolver 403 si no coincide.
- **Sin stock suficiente**: error claro (`InsufficientStockError`, mismo
  patrón que `sellProduct`), no se agrega el repuesto, no se toca budget.
- **Revertir un repuesto agregado por error**: sí, permitir. Nuevo endpoint
  `DELETE /api/orders/:id/parts/:movementId` (mismo actor: solo el técnico
  asignado) que:
  - Repone el stock del producto (`+quantity`).
  - Resta `quantity × unitPrice-al-momento` del `Order.budget` — por eso
    conviene guardar el precio usado en el momento (no recalcular con el
    precio actual del producto, que puede haber cambiado) — considerar
    guardar `unitPriceAtUse` en el propio `InventoryMovement` o en una tabla
    aparte si `InventoryMovement` no debe cargar ese campo genéricamente.
  - Borra (o marca revertido) el `InventoryMovement` — decidir al implementar
    si se borra la fila o se le agrega un `reversedAt`/`reversedBy` para
    mantener el historial de que hubo un error corregido (recomendado:
    mantener el historial, no borrar silenciosamente).

## Verificación pendiente (no bloqueante, chequear al implementar)

- La sección "Tienda Física" de Reportes (ya filtra `channel: 'MOSTRADOR'`)
  no debe mezclarse con estos movimientos `SERVICIO_TECNICO` — el `where`
  explícito en `reports.service.ts` ya debería excluirlos, solo confirmar con
  un test.
