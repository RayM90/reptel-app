# RepTel App — Contexto del proyecto

## 🏗️ Estructura del proyecto

Monorepo `reptel-app` con tres sub-proyectos:
- **`apps/mobile`** — Expo React Native, exclusivo para rol CLIENT
- **`apps/admin-web`** — Vite + React + TypeScript, para roles de staff
- **`server`** — Express + Prisma + MySQL, backend compartido con autenticación AWS Cognito

Cubre dos módulos de negocio: servicio de reparación y tienda de accesorios.

## ⚙️ Stack de tecnologías

| Capa | Tecnología |
|---|---|
| Mobile | Expo React Native |
| Admin Web | Vite + React + TypeScript |
| Backend | Express + Prisma + MySQL |
| Auth | AWS Cognito |
| Estado (admin-web) | Zustand |
| Extras | WebSockets (real-time), QR codes, Jest |

## 📐 Reglas y convenciones acordadas

- **Naming crítico**: "Order" = orden de servicio/reparación; "ProductOrder" = compra en tienda (nunca confundir)
- Pagos de servicio en dos etapas: adelanto de $25 antes del despacho del técnico, pago final tras la reparación
- Fórmula de comisión del técnico: `deliveryAmount + 0.40 × (budget - revisionAmount)`
- `$5` fijo de costo de delivery (`DELIVERY_COST`), separado de la comisión del motorizado (`DELIVERY_COMMISSION`)
- Recibos de pago como formularios de texto estructurado (JSON), usando `Prisma.JsonNull` para campos limpiados en rechazo
- Solo rol CLIENT puede usar `POST /api/auth/register`
- Roles legacy (MANAGER, SELLER, TECHNICIAN) eliminados de toda autorización activa
