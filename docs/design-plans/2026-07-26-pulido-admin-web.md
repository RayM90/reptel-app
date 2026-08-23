# Pulido Visual de Admin-Web — Plan de Implementación

**Goal:** Cerrar los hallazgos de la auditoría de diseño de `apps/admin-web` que no quedaron cubiertos por el plan de Fundación (`2026-07-26-fundacion-paleta-tipografia.md`): badges de estado planos con enums crudos, highlight "nuevo" fuera de paleta, botón "Actualizar" inconsistente, acción principal enterrada, columnas monetarias sin alinear, historial de comisiones con estilo de ayuda de formulario, y "..." literal.

**Requiere:** el plan de Fundación ya aplicado (usa `--color-secondary`, `--color-success`, `--color-danger`, `--color-accent`, `.btn-accent` definidos ahí). Si `apps/admin-web/src/index.css` todavía tiene el degradado azul de fondo o no existe `--color-accent`, ese plan no se ha corrido — ejecutarlo primero.

**Architecture:** Un helper compartido (`src/utils/statusBadge.ts`) centraliza la traducción y el color de cada enum de estado (4 dominios: `Order`, `ProductOrder`, `DeliveryTracking`, `PartialPaymentSubmission`), consumido por los 3 dashboards. El resto son ajustes puntuales por archivo, sin nueva arquitectura.

**Tech Stack:** Vite + React + TypeScript + CSS variables.

## Global Constraints

- Paleta y tipografía ya establecidas por el plan de Fundación — no se introduce ningún color ni fuente nueva aquí.
- No se agregan dependencias (sin librería de iconos externa — los emoji de `NEW_BADGE_STYLE`/`🆕` se mantienen, ese fix es de color, no de iconografía; el reemplazo de iconos por SVG queda fuera de este plan por ahora, es un cambio más grande que amerita su propia revisión).
- No se cambia ninguna lógica de negocio (fetch, polling, cálculo de comisión) — solo presentación.

---

### Task 1: Helper de badges de estado + variantes CSS + corregir highlight "nuevo"

**Files:**
- Create: `apps/admin-web/src/utils/statusBadge.ts`
- Modify: `apps/admin-web/src/index.css`

**Interfaces:**
- Produces: `getStatusBadge(domain, status)` y `badgeClassName(variant)`, usados por el Task 2. `domain` es uno de `'order' | 'productOrder' | 'delivery' | 'partialPayment'`.

- [ ] **Step 1: Crear `apps/admin-web/src/utils/statusBadge.ts`**

```typescript
export type BadgeVariant = 'success' | 'danger' | 'progress' | 'neutral'

interface StatusBadgeInfo {
  label: string
  variant: BadgeVariant
}

const ORDER_STATUS: Record<string, StatusBadgeInfo> = {
  PENDING_PAYMENT: { label: 'Pago pendiente', variant: 'neutral' },
  RECEIVED: { label: 'Recibido', variant: 'neutral' },
  DIAGNOSING: { label: 'En diagnóstico', variant: 'progress' },
  WAITING_APPROVAL: { label: 'Esperando aprobación', variant: 'progress' },
  APPROVED: { label: 'Aprobado', variant: 'progress' },
  REPAIRING: { label: 'En reparación', variant: 'progress' },
  WAITING_PART: { label: 'Esperando repuesto', variant: 'progress' },
  READY: { label: 'Listo para entrega', variant: 'success' },
  DELIVERED: { label: 'Entregado', variant: 'success' },
  CANCELLED: { label: 'Cancelado', variant: 'danger' },
}

const PRODUCT_ORDER_STATUS: Record<string, StatusBadgeInfo> = {
  PENDING: { label: 'Pendiente', variant: 'neutral' },
  CONFIRMED: { label: 'Confirmado', variant: 'progress' },
  REJECTED: { label: 'Rechazado', variant: 'danger' },
  READY_FOR_PICKUP: { label: 'Listo para retiro', variant: 'success' },
  ASSIGNED_DELIVERY: { label: 'Asignado a motorizado', variant: 'progress' },
  ON_THE_WAY: { label: 'En camino', variant: 'progress' },
  DELIVERED: { label: 'Entregado', variant: 'success' },
  CANCELLED: { label: 'Cancelado', variant: 'danger' },
}

const DELIVERY_STATUS: Record<string, StatusBadgeInfo> = {
  ASSIGNED: { label: 'Asignado', variant: 'neutral' },
  LEAVING_STORE: { label: 'Saliendo de la tienda', variant: 'progress' },
  ON_THE_WAY: { label: 'En camino', variant: 'progress' },
  AT_LOCATION: { label: 'En el lugar', variant: 'progress' },
  DIAGNOSING_ON_SITE: { label: 'Diagnosticando en sitio', variant: 'progress' },
  EQUIPMENT_PICKED_UP: { label: 'Equipo recogido', variant: 'progress' },
  AT_THE_SHOP: { label: 'En el taller', variant: 'progress' },
  RETURNING: { label: 'Regresando', variant: 'progress' },
  DELIVERED: { label: 'Entregado', variant: 'success' },
  CANCELLED: { label: 'Cancelado', variant: 'danger' },
}

const PARTIAL_PAYMENT_STATUS: Record<string, StatusBadgeInfo> = {
  PENDING: { label: 'Pendiente', variant: 'neutral' },
  CONFIRMED: { label: 'Confirmado', variant: 'success' },
  REJECTED: { label: 'Rechazado', variant: 'danger' },
}

const STATUS_MAPS = {
  order: ORDER_STATUS,
  productOrder: PRODUCT_ORDER_STATUS,
  delivery: DELIVERY_STATUS,
  partialPayment: PARTIAL_PAYMENT_STATUS,
} as const

export type StatusDomain = keyof typeof STATUS_MAPS

export function getStatusBadge(domain: StatusDomain, status: string): StatusBadgeInfo {
  const map = STATUS_MAPS[domain]
  return map[status] ?? { label: status, variant: 'neutral' }
}

export function badgeClassName(variant: BadgeVariant): string {
  return variant === 'neutral' ? 'badge' : `badge badge-${variant}`
}
```

- [ ] **Step 2: Agregar las variantes de badge y corregir `NEW_BADGE_STYLE` — agregar al final de `apps/admin-web/src/index.css`**

```css
/* ─── Variantes de badge por estado ──────── */

.badge-success {
  background: #e3f3e9;
  color: var(--color-success);
}

.badge-danger {
  background: #fbe9e7;
  color: var(--color-danger);
}

.badge-progress {
  background: #ece9f6;
  color: var(--color-secondary);
}

/* ─── Fila de historial (comisiones) ─────── */

.history-row {
  padding: 10px 0;
  border-bottom: 1px solid var(--color-border);
  font-size: 14px;
  color: var(--color-text);
}

.history-row:last-child {
  border-bottom: none;
}

.history-row .history-amount {
  font-weight: 600;
  color: var(--color-success);
  font-variant-numeric: tabular-nums;
}

/* ─── Celdas monetarias ──────────────────── */

.money {
  text-align: right;
  font-variant-numeric: tabular-nums;
}
```

- [ ] **Step 3: Corregir el color fuera de paleta de `NEW_BADGE_STYLE` en los 3 archivos que lo definen**

En `apps/admin-web/src/pages/admin/Dashboard.tsx:133-137`, `apps/admin-web/src/pages/technician/Dashboard.tsx:68-72` y `apps/admin-web/src/pages/delivery/Dashboard.tsx:57-61`, el objeto es idéntico en los 3 archivos:

```typescript
// ANTES (en los 3 archivos, mismo bloque)
const NEW_BADGE_STYLE: CSSProperties = {
  backgroundColor: '#f59e0b',
  color: '#fff',
  marginLeft: 8,
}
```

Reemplazar por (mismo cambio en los 3 archivos):

```typescript
const NEW_BADGE_STYLE: CSSProperties = {
  backgroundColor: 'var(--color-secondary)',
  color: '#fff',
  marginLeft: 8,
}
```

- [ ] **Step 4: Verificar que compila**

Run: `cd apps/admin-web && npm run build`
Expected: build limpio, sin errores de TypeScript.

- [ ] **Step 5: Commit**

```bash
git add apps/admin-web/src/utils/statusBadge.ts apps/admin-web/src/index.css apps/admin-web/src/pages/admin/Dashboard.tsx apps/admin-web/src/pages/technician/Dashboard.tsx apps/admin-web/src/pages/delivery/Dashboard.tsx
git commit -m "feat: helper de badges de estado con colores de paleta y traduccion al espanol"
```

---

### Task 2: Aplicar el helper de badges en los 3 dashboards

**Files:**
- Modify: `apps/admin-web/src/pages/admin/Dashboard.tsx`
- Modify: `apps/admin-web/src/pages/technician/Dashboard.tsx`
- Modify: `apps/admin-web/src/pages/delivery/Dashboard.tsx`

**Interfaces:**
- Consumes: `getStatusBadge`, `badgeClassName` del Task 1.

- [ ] **Step 1: Importar el helper en los 3 archivos**

```typescript
import { getStatusBadge, badgeClassName } from '../../utils/statusBadge'
```

- [ ] **Step 2: `apps/admin-web/src/pages/admin/Dashboard.tsx` — reemplazar cada badge de estado crudo**

Hay 5 sitios en este archivo. Patrón exacto:

```tsx
// ANTES (línea 104, dentro de PaymentSubmissionsView)
<span className="badge">{SUBMISSION_STATUS_LABEL[s.status]}</span>

// DESPUÉS
<span className={badgeClassName(getStatusBadge('partialPayment', s.status).variant)}>
  {getStatusBadge('partialPayment', s.status).label}
</span>
```

Puedes eliminar `SUBMISSION_STATUS_LABEL` (líneas 64-68) una vez migrado — el helper ya cubre esas 3 etiquetas.

```tsx
// ANTES (línea 431, tabla de servicios técnicos activos)
<td><span className="badge">{order.status}</span></td>

// DESPUÉS
<td>
  <span className={badgeClassName(getStatusBadge('order', order.status).variant)}>
    {getStatusBadge('order', order.status).label}
  </span>
</td>
```

Aplica el mismo patrón (`domain: 'order'`) en la segunda tabla de servicios técnicos, línea 559.

```tsx
// ANTES (línea 514, tabla de pedidos de tienda)
<td><span className="badge">{po.status}</span></td>

// DESPUÉS
<td>
  <span className={badgeClassName(getStatusBadge('productOrder', po.status).variant)}>
    {getStatusBadge('productOrder', po.status).label}
  </span>
</td>
```

Aplica el mismo patrón (`domain: 'productOrder'`) en la segunda tabla de pedidos de tienda, línea 612.

- [ ] **Step 3: `apps/admin-web/src/pages/technician/Dashboard.tsx:300` — reemplazar el badge de estado**

```tsx
// ANTES
{order.device.brand} {order.device.model} · <span className="badge">{order.status}</span>

// DESPUÉS
{order.device.brand} {order.device.model} ·{' '}
<span className={badgeClassName(getStatusBadge('order', order.status).variant)}>
  {getStatusBadge('order', order.status).label}
</span>
```

- [ ] **Step 4: `apps/admin-web/src/pages/delivery/Dashboard.tsx:255` — reemplazar el badge de estado**

```tsx
// ANTES
<span className="badge">{delivery.status}</span> · Total: ${order.total}

// DESPUÉS
<span className={badgeClassName(getStatusBadge('delivery', delivery.status).variant)}>
  {getStatusBadge('delivery', delivery.status).label}
</span> · Total: ${order.total}
```

- [ ] **Step 5: Verificación manual**

`cd apps/admin-web && npm run dev` — loguearse como ADMIN, técnico y motorizado (o revisar cada tabla) y confirmar que los badges muestran texto en español y color según el estado (verde para entregado/listo, rojo para cancelado/rechazado, violeta para en curso, gris/neutro para pendiente/recibido) en vez del enum crudo en inglés sobre fondo azul plano.

- [ ] **Step 6: Commit**

```bash
git add apps/admin-web/src/pages
git commit -m "feat: aplicar badges de estado traducidos y con color semantico en los 3 dashboards"
```

---

### Task 3: Unificar el botón "Actualizar" en los 3 dashboards

**Files:**
- Modify: `apps/admin-web/src/pages/admin/Dashboard.tsx`
- Modify: `apps/admin-web/src/pages/technician/Dashboard.tsx`
- Modify: `apps/admin-web/src/pages/delivery/Dashboard.tsx`

**Interfaces:** ninguna nueva.

- [ ] **Step 1: `apps/admin-web/src/pages/admin/Dashboard.tsx` (~línea 372-377) — mover el botón junto al título, mismo layout que técnico/motorizado**

```tsx
// ANTES
return (
  <div className="page-container">
    <h1>Panel de Administrador</h1>
    <p><Link to="/admin/create-staff">➕ Crear usuario de personal</Link></p>
    <button className="btn btn-outline" onClick={() => fetchData()} style={{ marginBottom: 16 }}>
      ↻ Actualizar
    </button>

// DESPUÉS
return (
  <div className="page-container">
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <h1>Panel de Administrador</h1>
      <button className="btn btn-secondary" onClick={() => fetchData()}>
        ↻ Actualizar
      </button>
    </div>
    <p><Link to="/admin/create-staff" className="btn btn-accent">➕ Crear usuario de personal</Link></p>
```

> Esto también resuelve el hallazgo de la acción principal enterrada (era un link de texto subrayado, ahora es un botón `.btn-accent` — la única acción de máximo énfasis en esta vista).

- [ ] **Step 2: Confirmar que `technician/Dashboard.tsx` (~línea 252-259) y `delivery/Dashboard.tsx` (~línea 207-214) ya usan `btn-secondary` y la misma posición (arriba a la derecha) — no requieren cambio, ya son el estándar al que se alineó `admin/Dashboard.tsx`.**

- [ ] **Step 3: Verificación manual**

`npm run dev` — confirmar que el botón "Actualizar" se ve y se posiciona igual en los 3 paneles (arriba a la derecha del título, `btn-secondary`).

- [ ] **Step 4: Commit**

```bash
git add apps/admin-web/src/pages/admin/Dashboard.tsx
git commit -m "feat: unificar posicion y estilo del boton Actualizar, promover Crear usuario a boton principal"
```

---

### Task 4: Ajustes menores (alineación de dinero, historial de comisiones, elipsis)

**Files:**
- Modify: `apps/admin-web/src/pages/admin/Dashboard.tsx`
- Modify: `apps/admin-web/src/pages/technician/Dashboard.tsx`
- Modify: `apps/admin-web/src/pages/delivery/Dashboard.tsx`
- Modify: `apps/admin-web/src/pages/auth/Login.tsx`

**Interfaces:** consume `.money` y `.history-row` del Task 1.

- [ ] **Step 1: Alinear columnas monetarias a la derecha — `apps/admin-web/src/pages/admin/Dashboard.tsx`**

Encabezado de la tabla de servicios técnicos (~línea 408):
```tsx
// ANTES
<th>Presupuesto</th>

// DESPUÉS
<th className="money">Presupuesto</th>
```

Celda correspondiente (~línea 432, y su gemela ~línea 561):
```tsx
// ANTES
<td>{order.budget ? `$${order.budget}` : '—'}</td>

// DESPUÉS
<td className="money">{order.budget ? `$${order.budget}` : '—'}</td>
```

Aplica el mismo patrón (agregar `className="money"` al `<th>` y a cada `<td>` correspondiente) a: la columna "Total" de las tablas de pedidos de tienda (`po.total`, ~líneas 513 y 611) y a las 3 celdas de totales en el `<tfoot>` (~líneas 571, 572, 580 — `totalBudget`, `totalTechnicianCommission`, y la suma de ambos).

- [ ] **Step 2: Historial de comisiones — `apps/admin-web/src/pages/technician/Dashboard.tsx:415`**

```tsx
// ANTES
<div key={order.id} className="form-hint">
  <strong>{order.orderNumber}</strong> — {order.client.name} {order.client.lastName}{' '}
  — {order.device.brand} {order.device.model}
  {order.technicianCommission != null && (
    <span> · Comisión: ${order.technicianCommission}</span>
  )}

// DESPUÉS
<div key={order.id} className="history-row">
  <strong>{order.orderNumber}</strong> — {order.client.name} {order.client.lastName}{' '}
  — {order.device.brand} {order.device.model}
  {order.technicianCommission != null && (
    <span className="history-amount"> · Comisión: ${order.technicianCommission}</span>
  )}
```

- [ ] **Step 3: Historial de comisiones — `apps/admin-web/src/pages/delivery/Dashboard.tsx:299`**

```tsx
// ANTES
<div key={delivery.id} className="form-hint">
  <strong>Pedido #{delivery.productOrder.id.slice(0, 8)}</strong> — {delivery.productOrder.client.name}{' '}
  {delivery.productOrder.client.lastName} — entregado {delivery.deliveredAt && formatDate(delivery.deliveredAt)}
  {delivery.deliveryCommission != null && <span> · Comisión: ${delivery.deliveryCommission}</span>}

// DESPUÉS
<div key={delivery.id} className="history-row">
  <strong>Pedido #{delivery.productOrder.id.slice(0, 8)}</strong> — {delivery.productOrder.client.name}{' '}
  {delivery.productOrder.client.lastName} — entregado {delivery.deliveredAt && formatDate(delivery.deliveredAt)}
  {delivery.deliveryCommission != null && <span className="history-amount"> · Comisión: ${delivery.deliveryCommission}</span>}
```

- [ ] **Step 4: Elipsis tipográfica en vez de 3 puntos literales**

Reemplazar `'...'` por `'…'` (un solo carácter, U+2026) en:
- `apps/admin-web/src/pages/admin/CreateStaff.tsx:98`: `'Creando...'` → `'Creando…'`
- `apps/admin-web/src/pages/admin/Dashboard.tsx:368`: `<p>Cargando...</p>` → `<p>Cargando…</p>`
- `apps/admin-web/src/pages/auth/Login.tsx:172`: `'Guardando...'` → `'Guardando…'`
- `apps/admin-web/src/pages/auth/Login.tsx:216`: `'Ingresando...'` → `'Ingresando…'`
- `apps/admin-web/src/pages/delivery/Dashboard.tsx:202`: `<p>Cargando...</p>` → `<p>Cargando…</p>`
- `apps/admin-web/src/pages/technician/Dashboard.tsx:247`: `<p>Cargando...</p>` → `<p>Cargando…</p>`

No tocar `technician/Dashboard.tsx:385` (`placeholder="Describe el avance del trabajo..."`) — ese es un placeholder de textarea, no un estado de carga, y el criterio de este hallazgo era específicamente los estados "cargando/guardando/creando".

- [ ] **Step 5: Verificar que compila**

Run: `cd apps/admin-web && npm run build`

- [ ] **Step 6: Commit**

```bash
git add apps/admin-web/src/pages
git commit -m "fix: alinear columnas monetarias, mejorar estilo de historial de comisiones y usar elipsis tipografica"
```
