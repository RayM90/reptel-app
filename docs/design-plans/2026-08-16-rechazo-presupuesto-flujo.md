# Flujo faltante: cliente aprueba/rechaza el presupuesto (WAITING_APPROVAL)

## El hueco confirmado

`PATCH /api/orders/:id/budget` (`updateOrderBudget`) existe en el backend y en
el cliente API del móvil, pero **nadie lo llama** desde ninguna pantalla. Hoy,
en cuanto el técnico manda un presupuesto > $0, la orden queda en
`WAITING_APPROVAL` para siempre — no hay botón en la app del cliente, ni en
el admin, para sacarla de ahí.

Esto contradice tu propia Figura 5 del Trabajo de Grado ("¿Cliente aprueba el
presupuesto en la app? Sí/No"), que ya documenta que la decisión es del
cliente, en la app.

## Lo que ya confirmamos

- **Quién decide:** el cliente, en la app (no el admin) — coincide con Figura 5.
- **Comisión si rechaza:** igual que el caso presupuesto $0 → `deliveryAmount + 0.40 × revisionAmount` = **$16 fijo**, sin importar cuál era el presupuesto rechazado.
- **Dinero:** los $25 (delivery $10 + revisión $15) ya están cobrados y confirmados por el admin *antes* de que el técnico salga — eso no cambia. Si el cliente rechaza, no se cobra nada más, no hay reembolso.
- **Automático en ambos paneles:** el admin y el técnico deben ver la orden reflejarse sola, sin tocar código de esos paneles.

## Diagrama del flujo completo (con la pieza que falta en rojo)

```mermaid
flowchart TD
    A[Técnico entrega diagnóstico<br/>con presupuesto > $0] --> B[Orden: WAITING_APPROVAL]
    B --> C{Cliente decide<br/>en la app}
    C -->|Aprueba| D[PATCH /orders/:id/budget<br/>approved=true<br/>YA EXISTE, nadie lo llama]
    D --> E[Orden: APPROVED → REPAIRING → READY]
    E --> F[Cliente paga saldo final<br/>presupuesto − $15 revisión]
    F --> G[Admin confirma pago final]
    G --> H[Orden: DELIVERED<br/>comisión = delivery + 40%×presupuesto-revisión]

    C -->|Rechaza| X["🔴 FALTA POR CONSTRUIR<br/>endpoint dedicado tipo closeZeroBudgetOrder()"]
    X --> Y[Orden: CANCELLED<br/>comisión = delivery + 40%×revisión = $16<br/>sin pago adicional, sin reembolso]

    style X fill:#fee2e2,stroke:#b91c1c,stroke-width:2px
    style D fill:#fef9c3,stroke:#a16207,stroke-width:2px
```

## Por qué reutilizar el status `CANCELLED` (mi recomendación)

Miré cómo usa el resto del código el status `CANCELLED` de una orden de
servicio hoy — **nadie lo asigna automáticamente todavía**, solo existe como
opción manual en el selector libre del técnico. Pero el **panel de admin ya
lo trata como "orden cerrada"**, exactamente igual que `DELIVERED`:

```ts
// admin-web Dashboard.tsx:421 — ya existente, sin tocar
(o) => o.status === 'DELIVERED' || o.status === 'CANCELLED'
```

Y el panel del técnico separa "activas" de "completadas" mirando si
`technicianCommission != null` — no el status. Es decir: **si el nuevo
endpoint pone bien `status: CANCELLED` + `technicianCommission: 16`, la
orden se mueve sola a "cerradas" en el admin y a "completadas" en el técnico,
sin tocar ni una línea de esos dos paneles.**

### Opción A — Reutilizar `CANCELLED` (recomendada)
Un endpoint nuevo y dedicado, **`rejectBudget()`**, con la misma forma que
`closeZeroBudgetOrder()` que ya existe (mismo archivo `orders.service.ts`):
solo válido si `status === WAITING_APPROVAL`, pone `status: CANCELLED`,
calcula la comisión, decrementa la carga del técnico, notifica al cliente,
dice en el `statusHistory` exactamente por qué se canceló (para
diferenciarlo de cualquier otra cancelación futura).

- ✅ Cero cambios en Prisma (no hay migración).
- ✅ Cero cambios en los paneles de admin/técnico — ya filtran `CANCELLED` como cerrada.
- ✅ Coincide literal con tu Figura 5 ("Fin: orden cancelada").
- ⚠️ El texto "Cancelada" en rojo no distingue por qué (rechazo de presupuesto vs. otro motivo) — se resuelve con el comentario del `statusHistory`, que ya se muestra en el historial de la orden tanto al cliente como al técnico.

### Opción B — Status nuevo (ej. `REPAIR_DECLINED`)
Semánticamente más preciso (no se confunde con "cancelada por otro motivo"),
pero: requiere migración de Prisma, tocar el enum en 3 archivos más
(`statusBadge.ts`, dropdown del técnico, mensajes del chatbot), y **el panel
de admin no lo reconocería como "cerrada"** hasta que también le agregue ese
status al filtro — un cambio más grande para el mismo resultado.

**Mi recomendación es la Opción A** — mismo resultado visible para ti y
mucho menos superficie de cambio. La diferenciación por motivo queda en el
`statusHistory`, que es justo el mecanismo que el proyecto ya usa para eso
(ej. "Diagnóstico registrado... sin costo" vs "Presupuesto aprobado por el
cliente").

## Confirmado tras revisar los dos ejemplos de Raymar

- **`finalPaymentConfirmedAt` hay que ponerlo igual que `closeZeroBudgetOrder()`.**
  El resumen semanal/mensual del técnico (no el total general) filtra por esa
  fecha, no por `status`. Si `rejectBudget()` no la pone, la comisión de $16
  aparece en el total pero desaparece de los resúmenes por período. Ya
  identificado, se copia el mismo patrón.
- **La tienda de repuestos (`select-linked-products.tsx`) es un flujo aparte,
  no reemplaza esto.** Deja comprar piezas (`requiresInstallation`) vinculadas
  a la orden en cualquier momento que `budget > 0` — crea su propio
  `ProductOrder`. Los dos ejemplos de Raymar (presupuesto muy caro / no es
  reparación sino batería-cargador) se resuelven **igual en dinero**
  (comisión $16, sin cobro extra), así que un solo endpoint de rechazo cubre
  ambos — lo único que cambia entre los dos es el **motivo**, que sí hay que
  capturar.
- **El cliente elige un motivo al rechazar** (confirmado): selector corto +
  campo libre opcional, guardado en el `statusHistory` de la orden.

## Decisiones — todas cerradas

1. ✅ Opción A: `CANCELLED` + endpoint dedicado `rejectBudget()`.
2. ✅ Motivos: *"Es muy costoso"* / *"Prefiero resolverlo por mi cuenta"* / *"Otro"* (con campo de texto libre si elige "Otro").
3. Texto tras rechazar: *"Entendido, no se realizará la reparación. Ya pagaste la revisión y el delivery — no se te cobrará nada más."*
4. El botón "Rechazar" pide confirmación (`useConfirm`, mismo patrón que el pago anticipado) antes de ejecutar — es una decisión de dinero irreversible.

## Diseño técnico

### Backend (`server/src/modules/orders/`)

**`orders.service.ts` — nueva función `rejectBudget()`**, gemela de
`closeZeroBudgetOrder()`:

```ts
export const rejectBudget = async (
  id: string,
  reason: string,        // "Es muy costoso" | "Prefiero resolverlo por mi cuenta" | texto libre si "Otro"
) => {
  const order = await prisma.order.findUnique({
    where: { id },
    include: { client: { include: { user: true } } },
  })
  if (!order) throw new Error('Orden no encontrada')
  if (order.status !== 'WAITING_APPROVAL') {
    throw new Error('Esta acción solo aplica a órdenes esperando aprobación de presupuesto')
  }

  const deliveryAmount = order.deliveryAmount ? Number(order.deliveryAmount) : 0
  const revisionAmount = order.revisionAmount ? Number(order.revisionAmount) : 0
  const commission = deliveryAmount + 0.4 * revisionAmount   // mismo cálculo que closeZeroBudgetOrder

  const updatedOrder = await prisma.order.update({
    where: { id },
    data: {
      budgetApproved: false,
      finalPaymentConfirmed: true,        // nada más que cobrar
      finalPaymentConfirmedAt: new Date(), // clave para el resumen semanal/mensual del técnico
      technicianCommission: commission,
      status: 'CANCELLED',
      statusHistory: {
        create: {
          status: 'CANCELLED',
          comment: `Cliente rechazó el presupuesto de $${order.budget}. Motivo: ${reason}. Comisión del técnico: $${commission.toFixed(2)} (delivery + 40% revisión).`,
        },
      },
    },
    include: { client: true, device: true, technician: { select: { id: true, name: true } }, statusHistory: { orderBy: { createdAt: 'desc' } } },
  })

  if (order.technicianId) await decrementTechnicianLoad(order.technicianId)

  if (order.client.user) {
    await prisma.notification.create({
      data: {
        type: 'STATUS_CHANGE',
        channel: 'PUSH',
        message: `Confirmamos que no se realizará la reparación de la orden #${order.orderNumber}. No se te cobrará nada adicional.`,
        userId: order.client.user.id,
        orderId: id,
      },
    })
  }

  return updatedOrder
}
```

**Ruta nueva:** `POST /api/orders/:id/reject-budget` (client-only, valida que
la orden pertenezca al cliente autenticado — mismo patrón de
`submitAdvancePaymentInstallment`, resolviendo `clientId` desde el email del
token, nunca del body).

**Ruta a activar (ya existe, solo falta un caller):**
`PATCH /api/orders/:id/budget` con `{ budget: order.budget, approved: true }`
para "Aceptar" — sin cambios en backend.

### Mobile (`apps/mobile`)

**`src/services/api.ts`** — agregar `rejectBudget(orderId, reason)` junto al
ya existente `updateOrderBudget`.

**`app/(client)/my-technical-orders.tsx`** — en el bloque expandido, cuando
`status === 'WAITING_APPROVAL'`: mostrar el presupuesto + dos botones,
**"✅ Aceptar presupuesto"** (llama `updateOrderBudget(id, budget, true)`
directo) y **"❌ Rechazar presupuesto"** (abre selector de motivo inline →
`useConfirm()` → `rejectBudget(id, reason)`). Ambos con `fetchOrders()` al
terminar, igual que el resto de acciones de esta pantalla.

### Tests (`server/src/__tests__/orders.test.ts`)

Casos a cubrir, mismo estilo que los tests existentes de
`closeZeroBudgetOrder`:
- Rechazo válido desde `WAITING_APPROVAL` → `CANCELLED`, comisión $16, `finalPaymentConfirmedAt` seteado.
- Rechazo desde cualquier otro status → error.
- `decrementTechnicianLoad` se llama.
- Notificación al cliente se crea.
