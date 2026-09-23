# 🖥️ RepTel App

<p align="center">
  <strong>Sistema de gestión integral para servicio técnico y tienda de repuestos</strong>
</p>

<p align="center">
  Proyecto de Grado (TSU) desarrollado para <strong>RepTel C.A.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/React_Native-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React Native" />
  <img src="https://img.shields.io/badge/Expo-000020?style=for-the-badge&logo=expo&logoColor=white" alt="Expo" />
  <img src="https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React" />
  <img src="https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=node.js&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/Express-000000?style=for-the-badge&logo=express&logoColor=white" alt="Express" />
  <img src="https://img.shields.io/badge/Prisma-2D3748?style=for-the-badge&logo=prisma&logoColor=white" alt="Prisma" />
  <img src="https://img.shields.io/badge/MySQL-4479A1?style=for-the-badge&logo=mysql&logoColor=white" alt="MySQL" />
  <img src="https://img.shields.io/badge/AWS_Cognito-FF9900?style=for-the-badge&logo=amazon-aws&logoColor=white" alt="AWS Cognito" />
  <img src="https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white" alt="Vite" />
</p>

---

## 📋 ¿Qué es RepTel App?

RepTel App digitaliza el ciclo completo de un taller de reparación de computadoras: desde que el cliente solicita el servicio o compra un repuesto, hasta que el equipo es reparado, entregado y facturado. Conecta en una sola plataforma a **clientes**, **administrador**, **técnicos** y **motorizados**, eliminando el papel, los tickets perdidos y la falta de trazabilidad de un taller tradicional.

Es un **prototipo funcional de tesis**, construido priorizando siempre soluciones simples y honestas: cada funcionalidad descrita aquí está implementada y probada, no es solo un diseño en papel.

---

## 🏗️ Arquitectura

Monorepo con tres proyectos independientes que comparten un único backend:

```
reptel-app/
├── apps/
│   ├── mobile/          📱 App del cliente (Expo / React Native)
│   └── admin-web/        💻 Panel de personal (Vite / React)
└── server/               ⚙️ API REST (Express / Prisma / MySQL)
```

| App | Para quién | Tecnología |
|---|---|---|
| **mobile** | Clientes | Expo, React Native, Zustand |
| **admin-web** | Administrador, Técnico, Motorizado | Vite, React, TypeScript |
| **server** | Backend compartido | Express, Prisma, MySQL, AWS Cognito |

---

## 🚀 Cómo levantar el proyecto

### Requisitos previos
- Node.js 18 o superior (probado con v24)
- MySQL corriendo localmente, con una base de datos creada (ej. `reptel_db`)
- Un User Pool de AWS Cognito ya configurado (User Pool ID + Client ID)

### 1. Variables de entorno
Crear `server/.env`:
```
DATABASE_URL="mysql://usuario:password@localhost:3306/reptel_db"
COGNITO_USER_POOL_ID=...
COGNITO_CLIENT_ID=...
AWS_REGION=us-east-1
PORT=3000
DEVICE_PASSWORD_ENC_KEY=...
```
`DEVICE_PASSWORD_ENC_KEY` es una clave de 32 bytes en hexadecimal (64 caracteres) usada para cifrar `Device.devicePassword` (AES-256-GCM) antes de guardarla en la base de datos. Generarla con:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 2. Instalar dependencias
Cada carpeta tiene su propio `package.json` (no hay un solo `npm install` para todo el monorepo):
```bash
cd server && npm install
cd ../apps/admin-web && npm install
cd ../apps/mobile && npm install
```

### 3. Levantar el backend
```bash
cd server
npx prisma migrate deploy
npm run dev
```
Queda en `http://localhost:3000` y muestra en consola la IP de tu red local (para que el celular la use). **Detener:** `Ctrl+C`.

### 4. Levantar el panel web (admin-web)
```bash
cd apps/admin-web
npm run dev
```
Abre en `http://localhost:5173`. **Detener:** `Ctrl+C`.

### 5. Levantar la app móvil
```bash
cd apps/mobile
npm start
```
Escanear el QR con **Expo Go**, celular en la misma red Wi-Fi que la PC del backend. **Detener:** `Ctrl+C` (o `q` en la terminal de Expo).

> Los tres corren por separado — se necesitan 3 terminales abiertas a la vez mientras desarrollas.

### Correr los tests del backend
```bash
cd server && npm test
```

---

## 👥 Roles del sistema

| Rol | Qué hace |
|---|---|
| 🙋 **Cliente** | Solicita reparaciones, compra repuestos/accesorios, hace seguimiento, paga desde la app |
| 🛠️ **Administrador** | Supervisa ambos flujos de negocio, aprueba/rechaza pagos, ve reportes |
| 🔧 **Técnico** | Diagnostica equipos, define presupuesto, repara y gana comisión por servicio completado (órdenes recibidas por mostrador) |
| 🛵 **Técnico Motorizado** | Mismo panel y capacidades que el Técnico (diagnostica, presupuesta, repara, gana comisión), aplicadas a las órdenes de auto-servicio — además gestiona la recogida y entrega a domicilio de esas órdenes |

---

## ✨ Funcionalidades principales

### Para el cliente (mobile)
- 🔐 Autenticación real con AWS Cognito, con recuperación de contraseña
- 🛒 Catálogo de tienda con carrito de compras persistente
- 🔩 Solicitud de servicio técnico (self-service), con pago anticipado de delivery + revisión
- 🧾 Formularios de pago en texto (Pago Móvil, Transferencia, Binance) — validados contra el monto real, con aviso si falta dinero
- 🔗 Compra de repuestos vinculados a una orden de servicio en curso
- 📦 Historial completo de pedidos y órdenes, con seguimiento de estado en tiempo real
- ✅❌ Aprobación o rechazo del presupuesto de reparación, y confirmación/disputa del diagnóstico sin costo ($0)
- 🏢 Registro como persona natural o jurídica (empresa/gobierno con persona de contacto), con segunda dirección de envío opcional

### Para el administrador (web)
- 📊 Dashboard con todos los servicios técnicos y pedidos de tienda activos
- ✅❌ Aprobación o rechazo de pagos (anticipado y final), con notificación automática al cliente
- 🛵 Asignación automática del motorizado con menor carga de trabajo
- 👤 Creación de usuarios de personal (técnico/motorizado) con contraseña temporal
- 🔑 Resolución de solicitudes de recuperación de contraseña del personal
- 🧮 Ajuste de presupuesto desde el detalle de la orden
- 📈 Reportes consolidados: filtro por canal (Web/APK) y por cédula, expediente de cliente, auditoría con drill-down y KPI de mermas

### Para el técnico / técnico motorizado (web)
Ambos roles comparten el mismo panel y las mismas capacidades de reparación — la diferencia es qué órdenes reciben: el Técnico atiende las de mostrador, el Técnico Motorizado las de auto-servicio (que además requieren recogida/entrega).

- 📋 Panel con todas sus órdenes asignadas, con vista cronológica de 6 fases por orden
- 🔍 Registro de diagnóstico y presupuesto, con catálogo de servicios frecuentes
- 💬 Comentarios de progreso en cada orden
- 🏁 Finalización de la reparación, con salto directo a "pagada" si no queda saldo pendiente
- 🧾 Recibos con membrete, historial de pagos y firma del cliente
- 💰 Comisión calculada automáticamente al completar cada servicio, con corte semanal (lunes a sábado)
- 🛵 *(Técnico Motorizado)* Gestión de la recogida y entrega a domicilio de sus órdenes de auto-servicio asignadas

---

## 💸 Modelo de comisiones

```
Comisión del técnico = 100% del delivery + 40% de la mano de obra
```

La mano de obra se calcula descontando el anticipo de revisión ya pagado, para no cobrarlo dos veces.

---

## 🚧 Estado del proyecto

- [x] Autenticación con AWS Cognito (mobile + web)
- [x] Flujo completo de tienda (catálogo, carrito, checkout, pago)
- [x] Flujo completo de servicio técnico (solicitud, pago anticipado, diagnóstico, pago final)
- [x] Vínculo Tienda-Servicio (compra de repuestos para una orden en curso)
- [x] Panel de Administrador (web)
- [x] Panel del Técnico (web), con comisiones y corte semanal
- [x] Panel del Motorizado (web)
- [x] Gestión de usuarios de personal desde el panel de Administrador
- [x] Aprobar/rechazar presupuesto y confirmar/disputar diagnóstico sin costo ($0)
- [x] Recuperación de contraseña para personal (técnico/motorizado), resuelta por el Administrador
- [x] Registro de clientes empresa/gobierno con persona de contacto y segunda dirección de envío
- [x] Reportes consolidados con filtro por canal, expediente de cliente y auditoría con drill-down
- [x] Stepper cronológico y ajuste de presupuesto en el detalle de la orden (panel del técnico/admin)
- [x] Recibos PDF con membrete, historial de pagos y firma del cliente
- [ ] Diseño visual definitivo del panel web (paleta de colores institucional)

### 🔄 En desarrollo (ramas locales, aún sin mergear a `main`)
- [ ] Formulario dedicado para creación de personal
- [ ] Gestión de inventario con historial de estados
- [ ] Fixes críticos de una auditoría de base de datos en curso

---

## 🛠️ Stack tecnológico

| Categoría | Tecnología |
|---|---|
| Lenguaje | TypeScript |
| App móvil | React Native + Expo |
| Panel web | React + Vite |
| Estado global | Zustand |
| Backend | Node.js + Express |
| Base de datos | MySQL + Prisma ORM |
| Autenticación | AWS Cognito |
| Tiempo real | WebSocket |

---

## 📄 Licencia

MIT License

---

<p align="center">
  Proyecto de Grado — TSU · Desarrollado para RepTel C.A.
</p>
