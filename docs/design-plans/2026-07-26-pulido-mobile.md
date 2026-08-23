# Pulido Visual de Mobile — Plan de Implementación

**Goal:** Cerrar los hallazgos de mayor impacto de la auditoría de diseño de `apps/mobile`: gradiente de auth inconsistente, colores fuera de paleta, badges de estado con 2 sistemas de color distintos entre pantallas equivalentes, y zonas táctiles bajo el mínimo recomendado.

**Requiere:** el plan de Fundación (`2026-07-26-fundacion-paleta-tipografia.md`) ya aplicado — usa `src/theme/colors.ts` y `src/theme/fonts.ts` creados ahí. Si esos archivos no existen, ejecutar ese plan primero.

**Architecture:** Fixes puntuales de valores hex en los archivos donde ya viven — no se introduce ningún componente nuevo. La migración completa de las ~16 pantallas a `theme/colors.ts` (reemplazar cada hex literal por `colors.xxx`) es un trabajo más grande que este plan solo arranca en 2 pantallas de referencia (Task 5) — el resto queda como trabajo incremental posterior, con la tabla de equivalencias ya definida para que sea mecánico.

**Tech Stack:** Expo React Native + TypeScript.

## Global Constraints

- Paleta ya establecida por el plan de Fundación — no se introduce ningún color nuevo.
- No se agregan dependencias.
- No se cambia lógica de negocio, solo estilos (`StyleSheet.create`, valores de color).

---

### Task 1: Unificar el gradiente de fondo de autenticación con el resto de la app

**Files:**
- Modify: `apps/mobile/app/welcome.tsx`
- Modify: `apps/mobile/app/(auth)/login.tsx`
- Modify: `apps/mobile/app/(auth)/register.tsx`

- [ ] **Step 1: Reemplazar el gradiente en los 3 archivos (mismo cambio, misma línea de patrón)**

```tsx
// ANTES (welcome.tsx:23, login.tsx:59, register.tsx:97 — idéntico en los 3)
colors={["#ffffff", "#dde4ff", "#a0b0ff", "#1a2a8a"]}

// DESPUÉS
colors={["#ffffff", "#eef2ff", "#d5ddff", "#8fa5ff"]}
```

No tocar `welcome.tsx:63` (`colors={["#e8eeff", "#d0d8ff"]}`) — es un gradiente decorativo secundario distinto (un botón/tarjeta interna), no el fondo de pantalla completo.

- [ ] **Step 2: Verificación manual**

`cd apps/mobile && npm start` — abrir Welcome → Login → una pantalla post-login en secuencia y confirmar que el tono de fondo ya no "salta" al pasar de auth al resto de la app.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/app/welcome.tsx "apps/mobile/app/(auth)/login.tsx" "apps/mobile/app/(auth)/register.tsx"
git commit -m "fix: unificar gradiente de fondo de auth con el resto de la app"
```

---

### Task 2: Corregir verde y rojo fuera de paleta

**Files:**
- Modify: `apps/mobile/app/(client)/store.tsx`
- Modify: `apps/mobile/app/(client)/product-detail.tsx`
- Modify: `apps/mobile/app/(client)/home-client.tsx`

- [ ] **Step 1: `store.tsx`**

```tsx
// línea 256 — ANTES
    backgroundColor: '#e63946',
// DESPUÉS
    backgroundColor: '#B3261E',
```

```tsx
// línea 338 — ANTES
  stock: { fontSize: 11, color: '#4ade80', fontWeight: '600' },
// DESPUÉS
  stock: { fontSize: 11, color: '#1E7A3D', fontWeight: '600' },
```

- [ ] **Step 2: `product-detail.tsx`**

```tsx
// línea 195 — ANTES
    backgroundColor: '#e63946',
// DESPUÉS
    backgroundColor: '#B3261E',
```

```tsx
// línea 236 — ANTES
  stock: { fontSize: 13, color: '#4ade80', fontWeight: '700' },
// DESPUÉS
  stock: { fontSize: 13, color: '#1E7A3D', fontWeight: '700' },
```

```tsx
// línea 237 — ANTES
  stockOut: { color: '#e63946' },
// DESPUÉS
  stockOut: { color: '#B3261E' },
```

- [ ] **Step 3: `home-client.tsx`**

```tsx
// línea 331 — ANTES
    backgroundColor: '#4ade80',
// DESPUÉS
    backgroundColor: '#1E7A3D',
```

- [ ] **Step 4: Verificación manual**

Abrir la Tienda, el detalle de un producto y el Home del cliente — confirmar que el verde de "disponible" y el rojo del badge del carrito/agotado se ven consistentes con el resto de la app (mismo verde/rojo que usa `my-orders.tsx`).

- [ ] **Step 5: Commit**

```bash
git add "apps/mobile/app/(client)/store.tsx" "apps/mobile/app/(client)/product-detail.tsx" "apps/mobile/app/(client)/home-client.tsx"
git commit -m "fix: reemplazar verde y rojo fuera de paleta por los tonos de exito/peligro de la paleta"
```

---

### Task 3: Unificar los colores de badges de estado entre "Mis Pedidos" y "Mis Órdenes de Servicio"

**Files:**
- Modify: `apps/mobile/app/(client)/my-technical-orders.tsx`
- Modify: `apps/mobile/app/(client)/my-orders.tsx`

**Contexto:** ambos archivos ya tienen su propio `STATUS_LABEL`/`STATUS_COLOR` (las traducciones ya existen y están bien) — el problema es que los **colores** de `my-technical-orders.tsx` son 5 tonos inventados (azul, morado, violeta, naranja, teal de Tailwind) que no existen en la paleta, mientras `my-orders.tsx` sí usa tonos de paleta pero de la paleta VIEJA (navy/ámbar antiguos). Este task lleva a ambos al mismo criterio: neutro para pendiente/recibido, violeta (`--secondary`) para todo estado intermedio "en curso", verde para terminal positivo, rojo para terminal/cancelado — el mismo criterio ya aplicado en el plan de pulido de admin-web.

- [ ] **Step 1: `my-technical-orders.tsx:74-85` — reemplazar `STATUS_COLOR`**

```tsx
// ANTES
const STATUS_COLOR: Record<OrderStatus, string> = {
  PENDING_PAYMENT: '#b45309',
  RECEIVED: '#1d4ed8',
  DIAGNOSING: '#9333ea',
  WAITING_APPROVAL: '#b45309',
  APPROVED: '#15803d',
  REPAIRING: '#7c3aed',
  WAITING_PART: '#c2410c',
  READY: '#0f766e',
  DELIVERED: ...,   // continúa con el resto de valores existentes
  CANCELLED: ...,
}

// DESPUÉS
const STATUS_COLOR: Record<OrderStatus, string> = {
  PENDING_PAYMENT: '#6B6B75',
  RECEIVED: '#6B6B75',
  DIAGNOSING: '#4B3E96',
  WAITING_APPROVAL: '#4B3E96',
  APPROVED: '#4B3E96',
  REPAIRING: '#4B3E96',
  WAITING_PART: '#4B3E96',
  READY: '#1E7A3D',
  DELIVERED: '#1E7A3D',
  CANCELLED: '#B3261E',
}
```

- [ ] **Step 2: `my-technical-orders.tsx:87-98` (el bloque `STATUS_BG` inmediatamente después) — mismo criterio para los fondos**

```tsx
// DESPUÉS
const STATUS_BG: Record<OrderStatus, string> = {
  PENDING_PAYMENT: '#EFEAE2',
  RECEIVED: '#EFEAE2',
  DIAGNOSING: '#ECEAF3',
  WAITING_APPROVAL: '#ECEAF3',
  APPROVED: '#ECEAF3',
  REPAIRING: '#ECEAF3',
  WAITING_PART: '#ECEAF3',
  READY: '#E3F3E9',
  DELIVERED: '#E3F3E9',
  CANCELLED: '#FBE9E7',
}
```

- [ ] **Step 3: `my-orders.tsx:71-74` y `my-orders.tsx:91-93` — alinear al mismo criterio**

```tsx
// ANTES (línea ~71-74)
  PENDING: '#b45309',
  CONFIRMED: '#15803d',
  DELIVERED: '#17247a',
  CANCELLED: '#b91c1c',

// DESPUÉS
  PENDING: '#6B6B75',
  CONFIRMED: '#4B3E96',
  DELIVERED: '#1E7A3D',
  CANCELLED: '#B3261E',
```

```tsx
// ANTES (línea ~91-93)
  PENDING: '#b45309',
  CONFIRMED: '#15803d',
  REJECTED: '#b91c1c',

// DESPUÉS
  PENDING: '#6B6B75',
  CONFIRMED: '#4B3E96',
  REJECTED: '#B3261E',
```

Si alguno de estos dos bloques en `my-orders.tsx` tiene un `_BG`/fondo asociado (revisar si existe cerca de esas líneas), aplicar la misma correspondencia que en el Step 2: PENDING→`#EFEAE2`, CONFIRMED→`#ECEAF3`, DELIVERED→`#E3F3E9`, CANCELLED/REJECTED→`#FBE9E7`.

También reemplazar los tonos de navy antiguo que quedan sueltos en el mismo archivo (`#17247a` en líneas ~205, ~525, ~531 — `ActivityIndicator` y títulos) por `#23262F` (el nuevo primario de Palette B), para que la pantalla no mezcle el navy viejo con el violeta/grafito nuevo.

- [ ] **Step 4: Verificación manual**

Abrir "Mis Pedidos" y "Mis Órdenes de Servicio" una junto a la otra (o en secuencia) y confirmar que ahora usan el mismo lenguaje de color para el mismo concepto de estado.

- [ ] **Step 5: Commit**

```bash
git add "apps/mobile/app/(client)/my-technical-orders.tsx" "apps/mobile/app/(client)/my-orders.tsx"
git commit -m "fix: unificar colores de badges de estado entre Mis Pedidos y Mis Ordenes de Servicio"
```

---

### Task 4: Zona táctil del botón mostrar/ocultar contraseña

**Files:**
- Modify: `apps/mobile/app/(auth)/login.tsx`
- Modify: `apps/mobile/app/(auth)/register.tsx`

- [ ] **Step 1: `login.tsx:253` y `register.tsx:346` — aumentar el padding del botón de 8 a 12**

```tsx
// ANTES
    padding: 8,
// DESPUÉS
    padding: 12,
```

(`register.tsx` tiene 2 botones de este tipo — mostrar/ocultar en el campo de contraseña y en el de confirmación — aplicar el mismo cambio a ambos si el archivo tiene 2 bloques `padding: 8` idénticos para ese propósito).

- [ ] **Step 2: Verificación manual**

Confirmar que el ícono del ojo sigue viéndose del mismo tamaño (el `size={20}` del ícono no cambia, solo crece el área táctil alrededor).

- [ ] **Step 3: Commit**

```bash
git add "apps/mobile/app/(auth)/login.tsx" "apps/mobile/app/(auth)/register.tsx"
git commit -m "fix: aumentar zona tactil del boton mostrar/ocultar contrasena a 44pt minimo"
```

---

### Task 5: Migrar 2 pantallas de referencia a `theme/colors.ts` (patrón para el resto)

**Files:**
- Modify: `apps/mobile/app/(client)/home-client.tsx`
- Modify: `apps/mobile/app/(client)/store.tsx`

**Interfaces:**
- Consumes: `colors` de `../../src/theme/colors.ts` (creado por el plan de Fundación).

- [ ] **Step 1: Importar el tema en ambos archivos**

```tsx
import { colors } from '../../src/theme/colors'
```

- [ ] **Step 2: Reemplazar los hex literales de estos 2 archivos por tokens, usando esta tabla de equivalencia (aplica en todo el archivo, no solo en las líneas ya tocadas por tasks anteriores)**

| Hex literal | Token |
|---|---|
| `#17247a`, `#1a1a6e` | `colors.primary` (ahora `#23262F`) |
| `#5364ad`, `#5564ad` | `colors.secondary` |
| `#eef2ff`, `#d0d8ff`, `#f0f3ff`, `#f0f4ff` | `colors.background` o `colors.backgroundAlt` (usar el que dé mejor contraste en cada caso) |
| `#d5ddff`, `#8fa5ff` | `colors.border` (si es borde) o mantener como paso de gradiente si es parte del `colors={[...]}` de un `LinearGradient` (no aplica ahí, los gradientes no se tokenizan en este plan) |
| `#15803d`, `#1E7A3D` | `colors.success` |
| `#b91c1c`, `#B3261E` | `colors.danger` |
| `#7a6000`, `#b45309` | mantener (advertencia — no forma parte de Palette B explícitamente, revisar caso por caso si aplica `colors.accent`) |
| `#9aa5cc`, `#9ca3af`, `#c0c0c0`, `#f0f0f0` | `colors.textMuted` o `colors.border` según el uso |

Ejemplo real en `home-client.tsx` — reemplazar los usos de `'#17247a'` en estilos por `colors.primary`, y los fondos claros de tarjetas por `colors.surface`/`colors.background`.

- [ ] **Step 3: Verificación manual**

Abrir Home del cliente y la Tienda — confirmar que se ven igual (o mejor, más consistentes) que antes, sin cambios de comportamiento.

- [ ] **Step 4: Commit**

```bash
git add "apps/mobile/app/(client)/home-client.tsx" "apps/mobile/app/(client)/store.tsx"
git commit -m "refactor: migrar home-client y store a theme/colors.ts como patron de referencia"
```

---

## Backlog (fuera de este plan — requieren su propio plan más adelante)

- **Migración completa del resto de las ~14 pantallas** a `theme/colors.ts`/`theme/fonts.ts` — este plan solo migra 2 como referencia (Task 5); usar la misma tabla de equivalencia.
- **Reemplazo de emoji por iconos SVG** (`@expo/vector-icons`/Feather, ya instalado) — cambio más grande, toca decenas de sitios.
- **Extraer componente compartido `PaymentReceiptForm`** de `upload-receipt.tsx`, `upload-advance-receipt.tsx` y `final-payment.tsx` — refactor de duplicación, no solo de estilo.
- **Consistencia de `SafeAreaView`** entre las pantallas de auth y el resto (que hoy usan `paddingTop: 60` fijo).
- **Catálogo de la tienda con imágenes reales** — pendiente de que el usuario suba las fotos de los productos (fuera de alcance de diseño, es contenido).
