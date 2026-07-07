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

## 👥 Roles del sistema

| Rol | Qué hace |
|---|---|
| 🙋 **Cliente** | Solicita reparaciones, compra repuestos/accesorios, hace seguimiento, paga desde la app |
| 🛠️ **Administrador** | Supervisa ambos flujos de negocio, aprueba/rechaza pagos, ve reportes |
| 🔧 **Técnico** | Diagnostica equipos, define presupuesto, repara, gana comisión por servicio completado |
| 🛵 **Motorizado** | Entrega pedidos de tienda y repuestos vinculados a órdenes de servicio |

---

## ✨ Funcionalidades principales

### Para el cliente (mobile)
- 🔐 Autenticación real con AWS Cognito
- 🛒 Catálogo de tienda con carrito de compras persistente
- 🔩 Solicitud de servicio técnico (self-service), con pago anticipado de delivery + revisión
- 🧾 Formularios de pago en texto (Pago Móvil, Transferencia, Binance) — validados contra el monto real, con aviso si falta dinero
- 🔗 Compra de repuestos vinculados a una orden de servicio en curso
- 📦 Historial completo de pedidos y órdenes, con seguimiento de estado en tiempo real

### Para el administrador (web)
- 📊 Dashboard con todos los servicios técnicos y pedidos de tienda activos
- ✅❌ Aprobación o rechazo de pagos (anticipado y final), con notificación automática al cliente
- 🛵 Asignación automática del motorizado con menor carga de trabajo

### Para el técnico (web)
- 📋 Panel con todas sus órdenes asignadas
- 🔍 Registro de diagnóstico y presupuesto, con catálogo de servicios frecuentes
- 💬 Comentarios de progreso en cada orden
- 💰 Comisión calculada automáticamente al completar cada servicio, con corte semanal (lunes a sábado)

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
- [ ] Panel del Motorizado (web)
- [ ] Gestión de usuarios de personal desde el panel de Administrador
- [ ] Diseño visual definitivo del panel web (paleta de colores institucional)

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
