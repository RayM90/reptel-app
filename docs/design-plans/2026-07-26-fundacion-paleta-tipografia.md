# Fundación de Diseño (Paleta B + Tipografía B) — Plan de Implementación

**Goal:** Reemplazar la paleta de colores y la tipografía de `apps/admin-web` y `apps/mobile` por la Opción B decidida (paleta "Grafito & Cobre" + tipografía "Fraunces + Public Sans"), como base compartida para los planes de pulido de admin-web y mobile que vienen después.

**Architecture:** Los tokens de color de admin-web ya viven en variables CSS (`:root { --color-* }`) — este plan solo cambia sus valores y agrega 1 token nuevo (`--color-accent`), sin tocar el árbol de componentes. Mobile no tiene ningún archivo de tema hoy (confirmado por auditoría — cada pantalla repite hex a mano); este plan crea `src/theme/colors.ts` como fuente única, sin migrar todavía las ~16 pantallas existentes (eso es trabajo del plan de pulido de mobile, task por separado). Las fuentes se autohospedan (sin CDN externo) — variable fonts vía `@font-face` en admin-web, paquetes `@expo-google-fonts/*` en mobile (los variable fonts no son fiables en React Native).

**Tech Stack:** Vite + React + TypeScript + CSS variables (admin-web); Expo React Native + TypeScript (mobile).

## Global Constraints

- Paleta aprobada por el dueño del proyecto (Opción B — "Grafito & Cobre"), no se cambia ningún valor sin confirmarlo primero:
  - Primario/estructural: `#23262F`
  - Secundario (violeta de marca, ya usado en el logo): `#4B3E96`
  - Acento/CTA único (cobre — reservado para UNA acción de mayor énfasis por vista, no para todo): `#B5502D`
  - Éxito: `#1E7A3D` (sin cambios)
  - Peligro: `#B3261E` (sin cambios)
  - Fondo cálido: `#F6F3EE`
  - Borde cálido: `#E4DFD6`
  - Texto: `#21212B`
  - Texto tenue: `#6B6B75`
- Tipografía aprobada (Opción B): **Fraunces** (encabezados) + **Public Sans** (cuerpo). Ningún otro tipo de letra se agrega.
- No self-host de Google Fonts vía `<link>`/CDN — los archivos de fuente se descargan una vez y se sirven localmente (regla de performance: sin llamadas a CDN de fuentes externas).
- No se toca la lógica de ninguna página/componente en este plan — solo tokens y carga de fuentes. Los usos de colores fuera de paleta y el reemplazo de emoji por SVG quedan para los planes de pulido siguientes.

---

## Parte 1 — Admin Web

### Task 1: Descargar las fuentes variables y autohospedarlas

**Files:**
- Create: `apps/admin-web/public/fonts/fraunces-variable.woff2`
- Create: `apps/admin-web/public/fonts/public-sans-variable.woff2`

**Interfaces:**
- Consumes: nada.
- Produces: 2 archivos estáticos servidos por Vite en `/fonts/*.woff2` (todo lo que vive en `public/` se sirve tal cual en la raíz).

- [ ] **Step 1: Descargar los 2 archivos woff2 (son variable fonts — un solo archivo cubre 500-700 de peso)**

```bash
cd apps/admin-web
mkdir -p public/fonts
curl -sL -o public/fonts/fraunces-variable.woff2 "https://fonts.gstatic.com/s/fraunces/v38/6NUu8FyLNQOQZAnv9bYEvDiIdE9Ea92uemAk_WBq8U_9v0c2Wa0K7iN7hzFUPJH58nhr1Ic7qv8.woff2"
curl -sL -o public/fonts/public-sans-variable.woff2 "https://fonts.gstatic.com/s/publicsans/v21/ijwRs572Xtc6ZYQws9YVwnNGfJ4.woff2"
```

- [ ] **Step 2: Verificar que ambos archivos son WOFF2 válidos**

Run: `file apps/admin-web/public/fonts/*.woff2`
Expected: ambos reportan `Web Open Font Format (Version 2)`. Si `curl` devolvió una página de error HTML en vez del binario (por ejemplo si la URL ya expiró), el `file` lo mostrará como `HTML document` — en ese caso, volver a obtener la URL vigente con:
```bash
curl -sA "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36" "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@72,500;72,600;72,700&family=Public+Sans:wght@400;600;700&display=swap" | grep -A2 "^/\* latin \*/$"
```
y usar las URLs `latin` que aparezcan ahí.

- [ ] **Step 3: Commit**

```bash
git add apps/admin-web/public/fonts/fraunces-variable.woff2 apps/admin-web/public/fonts/public-sans-variable.woff2
git commit -m "feat: agregar fuentes autohospedadas Fraunces y Public Sans a admin-web"
```

---

### Task 2: Reemplazar tokens de color y tipografía en `index.css`

**Files:**
- Modify: `apps/admin-web/src/index.css` (reemplazo completo del archivo)

**Interfaces:**
- Consumes: los 2 archivos de fuente del Task 1 (`/fonts/fraunces-variable.woff2`, `/fonts/public-sans-variable.woff2`).
- Produces: mismas variables CSS que ya existían (`--color-primary`, `--color-secondary`, `--color-bg-1`, `--color-bg-2`, `--color-border`, `--color-danger`, `--color-success`, `--color-text`, `--color-text-muted`) con nuevos valores, más 1 variable nueva (`--color-accent`) y 1 clase nueva (`.btn-accent`) que los planes de pulido de admin-web usarán para promover la acción principal de cada vista. Todas las clases existentes (`.btn-primary`, `.btn-secondary`, `.card`, `.badge`, etc.) seguían funcionando igual, solo con los colores nuevos — no se renombra ninguna clase.

- [ ] **Step 1: Reemplazar el contenido completo de `apps/admin-web/src/index.css`**

```css
@font-face {
  font-family: 'Fraunces';
  font-style: normal;
  font-weight: 500 700;
  font-display: swap;
  src: url('/fonts/fraunces-variable.woff2') format('woff2');
}

@font-face {
  font-family: 'Public Sans';
  font-style: normal;
  font-weight: 400 700;
  font-display: swap;
  src: url('/fonts/public-sans-variable.woff2') format('woff2');
}

:root {
  --color-primary: #23262f;
  --color-secondary: #4b3e96;
  --color-accent: #b5502d;
  --color-bg-1: #ffffff;
  --color-bg-2: #f6f3ee;
  --color-danger: #b3261e;
  --color-success: #1e7a3d;
  --color-border: #e4dfd6;
  --color-text: #21212b;
  --color-text-muted: #6b6b75;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-height: 100vh;
  font-family: 'Public Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  color: var(--color-text);
  background: var(--color-bg-1);
}

h1, h2, h3, h4 {
  font-family: 'Fraunces', serif;
  font-weight: 600;
  color: var(--color-primary);
  margin: 0 0 12px 0;
  letter-spacing: -0.01em;
}

a {
  color: var(--color-secondary);
}

/* ─── Layout ─────────────────────────────── */

.page-container {
  max-width: 1100px;
  margin: 0 auto;
  padding: 24px;
}

.header-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 24px;
  background: var(--color-primary);
  color: #ffffff;
}

.header-bar__brand {
  font-family: 'Fraunces', serif;
  font-size: 18px;
  font-weight: 600;
  color: #ffffff;
}

.header-bar__user {
  display: flex;
  align-items: center;
  gap: 16px;
  font-size: 14px;
}

.header-bar__role {
  background: var(--color-secondary);
  padding: 3px 10px;
  border-radius: 12px;
  font-size: 12px;
}

/* ─── Botones ────────────────────────────── */

.btn {
  display: inline-block;
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.15s ease;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn:hover:not(:disabled) {
  opacity: 0.9;
}

.btn:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px rgba(75, 62, 150, 0.35);
}

.btn-primary {
  background: var(--color-primary);
  color: #ffffff;
}

.btn-secondary {
  background: var(--color-secondary);
  color: #ffffff;
}

.btn-accent {
  background: var(--color-accent);
  color: #ffffff;
}

.btn-danger {
  background: var(--color-danger);
  color: #ffffff;
}

.btn-outline {
  background: transparent;
  color: var(--color-primary);
  border: 1px solid var(--color-primary);
}

/* ─── Tarjetas ───────────────────────────── */

.card {
  background: #ffffff;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  padding: 16px;
  margin-bottom: 12px;
  box-shadow: 0 1px 3px rgba(35, 38, 47, 0.08);
}

.card-summary {
  display: flex;
  gap: 20px;
  flex-wrap: wrap;
  margin-top: 24px;
}

/* ─── Tablas ─────────────────────────────── */

.table-wrapper {
  overflow-x: auto;
  max-width: 100%;
  background: #ffffff;
  border-radius: 10px;
  border: 1px solid var(--color-border);
}

table.styled-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

table.styled-table th {
  background: var(--color-bg-2);
  color: var(--color-primary);
  text-align: left;
  padding: 10px 12px;
  border-bottom: 1px solid var(--color-border);
}

table.styled-table td {
  padding: 10px 12px;
  border-bottom: 1px solid var(--color-border);
  vertical-align: top;
}

table.styled-table tr:last-child td {
  border-bottom: none;
}

/* ─── Formularios ────────────────────────── */

.form-group {
  margin-bottom: 14px;
}

.form-group label {
  display: block;
  font-size: 14px;
  font-weight: 600;
  color: var(--color-primary);
  margin-bottom: 4px;
}

.form-group input,
.form-group select,
.form-group textarea {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  font-size: 14px;
  font-family: inherit;
}

.form-group input:focus,
.form-group select:focus,
.form-group textarea:focus {
  outline: none;
  border-color: var(--color-secondary);
  box-shadow: 0 0 0 3px rgba(75, 62, 150, 0.35);
}

.form-hint {
  font-size: 12px;
  color: var(--color-text-muted);
  margin-top: 4px;
}

/* ─── Mensajes ───────────────────────────── */

.alert-error {
  color: var(--color-danger);
  background: #fbe9e7;
  border: 1px solid var(--color-danger);
  border-radius: 6px;
  padding: 8px 12px;
  font-size: 14px;
}

.alert-success {
  color: var(--color-success);
  background: #e6f4ea;
  border: 1px solid var(--color-success);
  border-radius: 6px;
  padding: 8px 12px;
  font-size: 14px;
}

/* ─── Badge de estado ────────────────────── */

.badge {
  display: inline-block;
  padding: 3px 10px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
  background: var(--color-bg-2);
  color: var(--color-primary);
}

/* ─── Input con ícono (mostrar/ocultar contraseña) ──── */

.input-with-icon {
  position: relative;
}

.input-with-icon input {
  padding-right: 40px;
}

.input-icon-btn {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  display: flex;
  align-items: center;
  color: var(--color-text-muted);
}

.input-icon-btn:hover {
  color: var(--color-primary);
}

/* ─── Pantalla de login ──────────────────── */

.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: linear-gradient(
    180deg,
    var(--color-bg-1) 0%,
    var(--color-bg-2) 100%
  );
}

.login-card {
  width: 100%;
  max-width: 380px;
  background: #ffffff;
  border-radius: 14px;
  padding: 40px 36px;
  box-shadow: 0 8px 24px rgba(35, 38, 47, 0.14);
  border: 1px solid var(--color-border);
}

.login-logo {
  width: 200px;
  height: auto;
  object-fit: contain;
  display: block;
  margin: 0 auto 24px;
}

.login-title {
  text-align: center;
  font-size: 20px;
  margin-bottom: 4px;
}

.login-subtitle {
  text-align: center;
  font-size: 13px;
  color: var(--color-text-muted);
  margin-bottom: 28px;
}

.login-card .form-group {
  margin-bottom: 18px;
}

/* ─── Toast ──────────────────────────────── */

.toast {
  position: fixed;
  bottom: 24px;
  right: 24px;
  padding: 12px 20px;
  border-radius: 8px;
  color: #ffffff;
  font-size: 14px;
  font-weight: 600;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  cursor: pointer;
  z-index: 1000;
  max-width: 360px;
}

.toast-success {
  background: var(--color-success);
}

.toast-error {
  background: var(--color-danger);
}

/* ─── Modal de confirmación ──────────────── */

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(33, 33, 43, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 999;
}

.modal-box {
  background: #ffffff;
  border-radius: 10px;
  padding: 24px;
  width: 100%;
  max-width: 420px;
  box-shadow: 0 8px 24px rgba(35, 38, 47, 0.2);
}
```

> Nota sobre lo que cambió respecto al archivo original: se quitaron `--color-bg-3`/`--color-bg-4` y el degradado decorativo del `body` (hallazgo de la auditoría de diseño — competía con la legibilidad de las tablas); el degradado queda solo en `.login-page`, donde sí tiene sentido narrativo. Se agregó `--color-accent` + `.btn-accent`. Se agregó un `box-shadow` de foco visible en `.btn:focus-visible` y en los inputs (antes el foco de los inputs quedaba solo con cambio de borde, sin anillo visible). Los pesos de fuente `500` pasaron a `600` en labels/badges para que se vean bien con Public Sans (su regular ya es más denso que el system-ui anterior). Ningún selector, clase ni estructura HTML cambia — es un reemplazo de valores y adición de reglas, no una reescritura de arquitectura CSS.

- [ ] **Step 2: Verificar visualmente**

Run: `cd apps/admin-web && npm run dev`
1. Abrir `/login` — confirmar que el logo, título y textos usan Fraunces en el título y Public Sans en el resto, sin fallback visible a system-ui (si ves la tipografía del sistema operativo en vez de Fraunces/Public Sans, el archivo de fuente no cargó — revisar la pestaña Network de DevTools por un 404 en `/fonts/*.woff2`).
2. Loguearse y confirmar que el Dashboard ya no tiene el degradado azul de fondo, que los botones primario/secundario se ven grafito/violeta, y que tabulando con teclado hasta un botón o input se ve un anillo de foco visible.

- [ ] **Step 3: Commit**

```bash
git add apps/admin-web/src/index.css
git commit -m "feat: aplicar paleta Grafito y Cobre + tipografia Fraunces/Public Sans a admin-web"
```

---

## Parte 2 — Mobile

### Task 3: Instalar los paquetes de fuentes y crear el tema compartido

**Files:**
- Modify: `apps/mobile/package.json` (nuevas dependencias)
- Create: `apps/mobile/src/theme/colors.ts`
- Create: `apps/mobile/src/theme/fonts.ts`

**Interfaces:**
- Consumes: nada.
- Produces: `colors` (objeto exportado con los tokens de Palette B) y `fontsToLoad` (mapa de nombre→módulo de fuente para pasar a `useFonts`) que el Task 4 usa en `_layout.tsx`. Las ~16 pantallas existentes NO se migran a estos tokens en este plan — eso es tarea del plan de pulido de mobile; aquí solo se crea la fuente de verdad para que ese plan la consuma después.

- [ ] **Step 1: Instalar los paquetes de fuentes (variable fonts no son fiables en React Native — se usan los paquetes `@expo-google-fonts` con archivos estáticos por peso)**

```bash
cd apps/mobile
npx expo install expo-font @expo-google-fonts/fraunces @expo-google-fonts/public-sans
```

- [ ] **Step 2: Crear `apps/mobile/src/theme/colors.ts`**

```typescript
// Fuente única de los tokens de color de RepTel (Paleta "Grafito & Cobre").
// Las pantallas existentes todavia usan hex literales — se migran en el
// plan de pulido de mobile, no en este.

export const colors = {
  primary: '#23262F',
  primaryDark: '#17171D',
  secondary: '#4B3E96',
  accent: '#B5502D',
  success: '#1E7A3D',
  successBg: '#E3F3E9',
  danger: '#B3261E',
  dangerBg: '#FBE9E7',
  background: '#F6F3EE',
  backgroundAlt: '#EFEAE2',
  surface: '#FFFFFF',
  border: '#E4DFD6',
  text: '#21212B',
  textMuted: '#6B6B75',
} as const

export type ColorToken = keyof typeof colors
```

- [ ] **Step 3: Crear `apps/mobile/src/theme/fonts.ts`**

```typescript
import {
  Fraunces_500Medium,
  Fraunces_600SemiBold,
  Fraunces_700Bold,
} from '@expo-google-fonts/fraunces'
import {
  PublicSans_400Regular,
  PublicSans_600SemiBold,
  PublicSans_700Bold,
} from '@expo-google-fonts/public-sans'

// Pasar este objeto a useFonts() en app/_layout.tsx.
export const fontsToLoad = {
  'Fraunces-Medium': Fraunces_500Medium,
  'Fraunces-SemiBold': Fraunces_600SemiBold,
  'Fraunces-Bold': Fraunces_700Bold,
  'PublicSans-Regular': PublicSans_400Regular,
  'PublicSans-SemiBold': PublicSans_600SemiBold,
  'PublicSans-Bold': PublicSans_700Bold,
}

// Nombres a usar en fontFamily dentro de StyleSheet.create(...).
export const fonts = {
  headingMedium: 'Fraunces-Medium',
  headingSemiBold: 'Fraunces-SemiBold',
  headingBold: 'Fraunces-Bold',
  bodyRegular: 'PublicSans-Regular',
  bodySemiBold: 'PublicSans-SemiBold',
  bodyBold: 'PublicSans-Bold',
} as const
```

- [ ] **Step 4: Verificar que el proyecto compila**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: mismo único error preexistente y no relacionado (`index.ts(3,8)`, `App` sin default export) — sin errores nuevos en `theme/colors.ts` ni `theme/fonts.ts`.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/package.json apps/mobile/package-lock.json apps/mobile/src/theme/colors.ts apps/mobile/src/theme/fonts.ts
git commit -m "feat: agregar paquetes de fuentes y tema compartido (paleta Grafito y Cobre) a mobile"
```

---

### Task 4: Cargar las fuentes en el arranque de la app

**Files:**
- Modify: `apps/mobile/app/_layout.tsx`

**Interfaces:**
- Consumes: `fontsToLoad` de `src/theme/fonts.ts` (Task 3).
- Produces: nada que otras tareas consuman — este es el punto final de la cadena de este plan.

- [ ] **Step 1: Agregar la carga de fuentes con gate de splash, sin tocar la lógica de hidratación de sesión ya existente**

```tsx
// apps/mobile/app/_layout.tsx — agregar estos imports arriba de los existentes
import { useFonts } from 'expo-font'
import * as SplashScreen from 'expo-splash-screen'
import { fontsToLoad } from '../src/theme/fonts'

// Justo debajo de los imports, antes de `const queryClient = ...`
SplashScreen.preventAutoHideAsync().catch(() => {})
```

```tsx
// Dentro de RootLayout, ANTES del useEffect de resumeSession ya existente
// (no reemplaza ese efecto, se agrega uno nuevo, independiente)
export default function RootLayout() {
  const [fontsLoaded, fontsError] = useFonts(fontsToLoad)

  useEffect(() => {
    if (fontsLoaded || fontsError) {
      SplashScreen.hideAsync().catch(() => {})
    }
  }, [fontsLoaded, fontsError])

  useEffect(() => {
    if (useAuthStore.persist.hasHydrated()) {
      useAuthStore.getState().resumeSession()
    } else {
      const unsubscribe = useAuthStore.persist.onFinishHydration(() => {
        useAuthStore.getState().resumeSession()
      })
      return unsubscribe
    }
  }, [])

  if (!fontsLoaded && !fontsError) {
    return null
  }

  return (
    <QueryClientProvider client={queryClient}>
      {/* resto del árbol sin cambios */}
    </QueryClientProvider>
  )
}
```

> `expo-splash-screen` ya es una dependencia transitiva estándar de cualquier proyecto Expo Router (se instala junto con `expo-router`) — confirmar con `npx expo install expo-splash-screen` si el import fallara por no estar en `package.json` directamente.

- [ ] **Step 2: Verificar manualmente**

1. `cd apps/mobile && npm start -- --clear`
2. Abrir en Expo Go — confirmar que la pantalla de splash se mantiene visible un instante más (mientras cargan las fuentes) y no hay parpadeo de texto sin estilo antes de que aparezca la primera pantalla.
3. Esto NO cambiará visualmente ninguna pantalla todavía (las pantallas siguen usando sus estilos actuales) — solo confirma que las fuentes quedan cargadas y disponibles para el plan de pulido de mobile.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/app/_layout.tsx
git commit -m "feat: cargar Fraunces y Public Sans al iniciar la app mobile"
```

---

## Siguiente paso (fuera de este plan)

Con esta fundación lista, los dos planes de pulido pueden ejecutarse en cualquier orden:
- **Pulido admin-web**: badges por estado, iconos SVG en vez de emoji, botón "Actualizar" unificado, alineación de columnas monetarias, promover la acción principal de `CreateStaff` a `.btn-accent`, estilo del historial de comisiones, elipsis tipográfica.
- **Pulido mobile**: migrar las ~16 pantallas de hex literales a `theme/colors.ts` y `theme/fonts.ts`, unificar el gradiente de auth con el resto de la app, corregir verde/rojo fuera de paleta, unificar el sistema de badges de "Mis Órdenes de Servicio" con "Mis Pedidos", iconos SVG en vez de emoji, extraer el componente compartido de las 3 pantallas de "subir comprobante", consistencia de safe area, zona táctil del botón de contraseña.
