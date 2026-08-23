# Aceptar/Rechazar Presupuesto — Implementation Plan

**Goal:** Dejar que el cliente apruebe o rechace, desde la app, el presupuesto
que el técnico registra tras diagnosticar el equipo — hoy la orden se queda
atascada para siempre en `WAITING_APPROVAL` porque ninguna pantalla llama al
endpoint de aprobación.

**Architecture:** Dos funciones nuevas en `orders.service.ts`
(`approveBudget`, `rejectBudget`), client-only, con verificación de dueño
(mismo patrón que `submitAdvancePaymentInstallment`). Dos rutas nuevas
`POST /:id/approve-budget` y `POST /:id/reject-budget`. En el móvil, dos
botones nuevos en `my-technical-orders.tsx` cuando `status ===
'WAITING_APPROVAL'`.

**Tech Stack:** Express + Prisma + MySQL (server), Expo React Native
(mobile), Jest + Supertest (tests de servicio, sin pasar por Cognito —
fixtures creados directo con Prisma, mismo patrón que
`product-orders.test.ts`).

## Global Constraints

- Comisión al rechazar = `deliveryAmount + 0.40 × revisionAmount` (fijo, no
  depende del presupuesto rechazado) — spec:
  `docs/design-plans/2026-08-16-rechazo-presupuesto-flujo.md`.
- Al rechazar, `status → CANCELLED`, `finalPaymentConfirmedAt` DEBE quedar
  seteado (el resumen semanal/mensual del panel del técnico filtra por esa
  fecha, no por status).
- Las dos acciones solo son válidas si `order.status === 'WAITING_APPROVAL'`
  — cualquier otro status lanza error.
- Ambas acciones son `CLIENT`-only y deben validar que la orden pertenezca
  al cliente autenticado (resolver `clientId` desde el email del token,
  nunca del body) — mismo patrón que `submitAdvancePaymentInstallment` en
  `orders.service.ts`.
- El texto de los 3 motivos de rechazo es exacto: `"Es muy costoso"`,
  `"Prefiero resolverlo por mi cuenta"`, `"Otro"`.

---

## Task 1: Backend — `approveBudget()` y `rejectBudget()` en `orders.service.ts`

**Files:**
- Modify: `server/src/modules/orders/orders.service.ts` (agregar al final del archivo, después de `closeZeroBudgetOrder`)
- Test: `server/src/__tests__/orders-budget-decision.test.ts` (nuevo)

**Interfaces:**
- Produces: `approveBudget(id: string, email: string): Promise<Order>`, `rejectBudget(id: string, email: string, reason: string): Promise<Order>` — ambas exportadas desde `orders.service.ts`, consumidas por el controller en la Task 2.

- [ ] **Step 1: Escribir los tests (fallarán porque las funciones no existen todavía)**

```ts
// server/src/__tests__/orders-budget-decision.test.ts
import prisma from '../lib/prisma'
import { approveBudget, rejectBudget } from '../modules/orders/orders.service'

let clientA: { id: string }
let userA: { id: string; email: string }
let clientB: { id: string }
let userB: { id: string; email: string }
let technician: { id: string }
let device: { id: string }

const makeOrder = async (overrides: Partial<{ status: string; budget: number }> = {}) => {
  return prisma.order.create({
    data: {
      orderNumber: `REP-TEST-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      status: (overrides.status ?? 'WAITING_APPROVAL') as any,
      problem: 'Pantalla dañada — test automatizado',
      budget: overrides.budget ?? 50,
      deliveryAmount: 10,
      revisionAmount: 15,
      clientId: clientA.id,
      deviceId: device.id,
      technicianId: technician.id,
    },
  })
}

beforeAll(async () => {
  const suffix = Date.now()

  clientA = await prisma.client.create({
    data: {
      name: 'Cliente', lastName: 'Presupuesto A',
      idNumber: `TEST-BUDGET-A-${suffix}`, phone: '0000000001',
      email: `cliente-budget-a-${suffix}@test.com`, password: '',
    },
  })
  userA = await prisma.user.create({
    data: {
      name: 'Cliente Presupuesto A',
      email: `cliente-budget-a-${suffix}@test.com`,
      password: 'x', role: 'CLIENT', clientId: clientA.id,
    },
  })

  clientB = await prisma.client.create({
    data: {
      name: 'Cliente', lastName: 'Presupuesto B',
      idNumber: `TEST-BUDGET-B-${suffix}`, phone: '0000000002',
      email: `cliente-budget-b-${suffix}@test.com`, password: '',
    },
  })
  userB = await prisma.user.create({
    data: {
      name: 'Cliente Presupuesto B',
      email: `cliente-budget-b-${suffix}@test.com`,
      password: 'x', role: 'CLIENT', clientId: clientB.id,
    },
  })

  technician = await prisma.user.create({
    data: {
      name: 'Técnico Test', email: `tecnico-budget-${suffix}@test.com`,
      password: 'x', role: 'TECHNICIAN_DELIVERY',
      technicianStatus: 'BUSY', activeOrderCount: 1,
    },
  })

  device = await prisma.device.create({
    data: { type: 'LAPTOP', brand: 'HP', model: 'Pavilion 15' },
  })
}, 20000)

afterAll(async () => {
  await prisma.orderStatusHistory.deleteMany({ where: { order: { clientId: { in: [clientA.id, clientB.id] } } } })
  await prisma.order.deleteMany({ where: { clientId: { in: [clientA.id, clientB.id] } } })
  await prisma.device.delete({ where: { id: device.id } }).catch(() => {})
  await prisma.user.delete({ where: { id: userA.id } }).catch(() => {})
  await prisma.user.delete({ where: { id: userB.id } }).catch(() => {})
  await prisma.user.delete({ where: { id: technician.id } }).catch(() => {})
  await prisma.client.delete({ where: { id: clientA.id } }).catch(() => {})
  await prisma.client.delete({ where: { id: clientB.id } }).catch(() => {})
})

describe('orders.service — approveBudget', () => {
  it('aprueba una orden en WAITING_APPROVAL', async () => {
    const order = await makeOrder()
    const result = await approveBudget(order.id, userA.email)
    expect(result.status).toBe('APPROVED')
    expect(result.budgetApproved).toBe(true)
  })

  it('lanza error si el status no es WAITING_APPROVAL', async () => {
    const order = await makeOrder({ status: 'RECEIVED' })
    await expect(approveBudget(order.id, userA.email)).rejects.toThrow(
      'Esta acción solo aplica a órdenes esperando aprobación de presupuesto'
    )
  })

  it('lanza error si la orden no pertenece al cliente', async () => {
    const order = await makeOrder()
    await expect(approveBudget(order.id, userB.email)).rejects.toThrow('Orden no encontrada')
  })
})

describe('orders.service — rejectBudget', () => {
  it('rechaza una orden en WAITING_APPROVAL: CANCELLED, comisión fija, finalPaymentConfirmedAt seteado', async () => {
    const order = await makeOrder({ budget: 80 })
    const result = await rejectBudget(order.id, userA.email, 'Es muy costoso')

    expect(result.status).toBe('CANCELLED')
    expect(Number(result.technicianCommission)).toBe(16) // 10 + 0.4*15
    expect(result.finalPaymentConfirmedAt).not.toBeNull()
    expect(result.finalPaymentConfirmed).toBe(true)

    const techAfter = await prisma.user.findUnique({ where: { id: technician.id } })
    expect(techAfter?.activeOrderCount).toBe(0)

    const history = await prisma.orderStatusHistory.findFirst({
      where: { orderId: order.id, status: 'CANCELLED' },
      orderBy: { createdAt: 'desc' },
    })
    expect(history?.comment).toContain('Es muy costoso')
  })

  it('la comisión no depende del monto del presupuesto rechazado', async () => {
    const order = await makeOrder({ budget: 500 })
    const result = await rejectBudget(order.id, userA.email, 'Prefiero resolverlo por mi cuenta')
    expect(Number(result.technicianCommission)).toBe(16)
  })

  it('lanza error si el status no es WAITING_APPROVAL', async () => {
    const order = await makeOrder({ status: 'READY' })
    await expect(rejectBudget(order.id, userA.email, 'Otro')).rejects.toThrow(
      'Esta acción solo aplica a órdenes esperando aprobación de presupuesto'
    )
  })

  it('lanza error si la orden no pertenece al cliente', async () => {
    const order = await makeOrder()
    await expect(rejectBudget(order.id, userB.email, 'Otro')).rejects.toThrow('Orden no encontrada')
  })
})
```

- [ ] **Step 2: Correr los tests para confirmar que fallan**

Run: `cd server && npx jest orders-budget-decision -v`
Expected: FAIL — `approveBudget`/`rejectBudget` no existen en `orders.service.ts`.

- [ ] **Step 3: Implementar `approveBudget()` y `rejectBudget()`**

Agregar al final de `server/src/modules/orders/orders.service.ts`:

```ts
// ─────────────────────────────────────────────
// CLIENTE — Aprobar o rechazar el presupuesto (Fase 5)
// La orden queda en WAITING_APPROVAL tras el diagnóstico del técnico
// (submitDiagnosis con budget > 0). El cliente decide en la app — coincide
// con la Figura 5 del Trabajo de Grado ("¿Cliente aprueba el presupuesto
// en la app?"). Spec completa:
// docs/design-plans/2026-08-16-rechazo-presupuesto-flujo.md
// ─────────────────────────────────────────────

export const approveBudget = async (id: string, email: string) => {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { clientId: true },
  })
  if (!user || !user.clientId) {
    throw new Error('Cliente no encontrado para este usuario')
  }

  const order = await prisma.order.findFirst({
    where: { id, clientId: user.clientId },
  })
  if (!order) {
    throw new Error('Orden no encontrada')
  }
  if (order.status !== 'WAITING_APPROVAL') {
    throw new Error('Esta acción solo aplica a órdenes esperando aprobación de presupuesto')
  }

  return await prisma.order.update({
    where: { id },
    data: {
      budgetApproved: true,
      status: 'APPROVED',
      statusHistory: {
        create: {
          status: 'APPROVED',
          comment: `Presupuesto de $${order.budget} aprobado por el cliente en la app`,
        },
      },
    },
    include: {
      client: true,
      device: true,
      technician: { select: { id: true, name: true } },
      statusHistory: { orderBy: { createdAt: 'desc' } },
    },
  })
}

// Cuando el cliente rechaza: la revisión ($15) y el delivery ($10) ya están
// cobrados (se pagaron antes de despachar al técnico), así que no hay nada
// más que cobrar ni reembolsar. La comisión del técnico usa la misma
// fórmula que closeZeroBudgetOrder (delivery + 40% de la revisión) — no
// depende de cuál era el presupuesto rechazado, porque el técnico sí hizo
// el trabajo de diagnóstico/revisión, solo que el cliente no siguió con la
// reparación.
export const rejectBudget = async (id: string, email: string, reason: string) => {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { clientId: true },
  })
  if (!user || !user.clientId) {
    throw new Error('Cliente no encontrado para este usuario')
  }

  const order = await prisma.order.findFirst({
    where: { id, clientId: user.clientId },
    include: { client: { include: { user: true } } },
  })
  if (!order) {
    throw new Error('Orden no encontrada')
  }
  if (order.status !== 'WAITING_APPROVAL') {
    throw new Error('Esta acción solo aplica a órdenes esperando aprobación de presupuesto')
  }

  const deliveryAmount = order.deliveryAmount ? Number(order.deliveryAmount) : 0
  const revisionAmount = order.revisionAmount ? Number(order.revisionAmount) : 0
  const commission = deliveryAmount + 0.4 * revisionAmount

  const updatedOrder = await prisma.order.update({
    where: { id },
    data: {
      budgetApproved: false,
      finalPaymentConfirmed: true,
      finalPaymentConfirmedAt: new Date(),
      technicianCommission: commission,
      status: 'CANCELLED',
      statusHistory: {
        create: {
          status: 'CANCELLED',
          comment: `Cliente rechazó el presupuesto de $${order.budget}. Motivo: ${reason}. Comisión del técnico: $${commission.toFixed(2)} (delivery + 40% revisión).`,
        },
      },
    },
    include: {
      client: true,
      device: true,
      technician: { select: { id: true, name: true } },
      statusHistory: { orderBy: { createdAt: 'desc' } },
    },
  })

  if (order.technicianId) {
    await decrementTechnicianLoad(order.technicianId)
  }

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

- [ ] **Step 4: Correr los tests para confirmar que pasan**

Run: `cd server && npx jest orders-budget-decision -v`
Expected: PASS — los 7 tests.

- [ ] **Step 5: Commit**

```bash
git add server/src/modules/orders/orders.service.ts server/src/__tests__/orders-budget-decision.test.ts
git commit -m "feat(reptel): approveBudget y rejectBudget en orders.service

Cierra el hueco donde WAITING_APPROVAL se quedaba atascado para
siempre — nadie llamaba el endpoint de aprobacion. Spec completa en
docs/design-plans/2026-08-16-rechazo-presupuesto-flujo.md"
```

---

## Task 2: Backend — Controllers y rutas

**Files:**
- Modify: `server/src/modules/orders/orders.controller.ts`
- Modify: `server/src/modules/orders/orders.routes.ts`

**Interfaces:**
- Consumes: `approveBudget(id, email)`, `rejectBudget(id, email, reason)` de la Task 1.
- Produces: `POST /api/orders/:id/approve-budget`, `POST /api/orders/:id/reject-budget` — consumidos por el móvil en la Task 3.

- [ ] **Step 1: Agregar los controllers**

Agregar en `server/src/modules/orders/orders.controller.ts`, después de `closeZeroBudgetOrder`:

```ts
// ─────────────────────────────────────────────
// CLIENTE — Aprobar o rechazar el presupuesto (Fase 5)
// ─────────────────────────────────────────────

export const approveBudget = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const email = req.user?.email
    if (!email) {
      res.status(401).json({ success: false, message: 'Usuario no autenticado' })
      return
    }
    const id = String(req.params.id)
    const order = await ordersService.approveBudget(id, email)

    broadcastOrderUpdate({ type: 'ORDER_BUDGET_UPDATED', data: order })

    res.json({ success: true, data: order })
  } catch (error: any) {
    console.error('ERROR APROBAR PRESUPUESTO:', error)
    res.status(400).json({ success: false, message: error.message || 'Error al aprobar el presupuesto' })
  }
}

export const rejectBudget = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const email = req.user?.email
    if (!email) {
      res.status(401).json({ success: false, message: 'Usuario no autenticado' })
      return
    }
    const id = String(req.params.id)
    const { reason } = req.body

    if (!reason || typeof reason !== 'string' || !reason.trim()) {
      res.status(400).json({ success: false, message: 'reason es requerido' })
      return
    }

    const order = await ordersService.rejectBudget(id, email, reason.trim())

    broadcastOrderUpdate({ type: 'ORDER_STATUS_UPDATED', data: order })

    res.json({ success: true, data: order })
  } catch (error: any) {
    console.error('ERROR RECHAZAR PRESUPUESTO:', error)
    res.status(400).json({ success: false, message: error.message || 'Error al rechazar el presupuesto' })
  }
}
```

- [ ] **Step 2: Registrar las rutas**

En `server/src/modules/orders/orders.routes.ts`, agregar justo después de la
línea `router.post('/:id/advance-payment-installment', ...)`:

```ts
// Aprobar o rechazar el presupuesto tras el diagnóstico del técnico
router.post('/:id/approve-budget', authenticate, authorize('CLIENT'), ordersController.approveBudget)
router.post('/:id/reject-budget', authenticate, authorize('CLIENT'), ordersController.rejectBudget)
```

- [ ] **Step 3: Verificar que el servidor arranca sin errores de tipos**

Run: `cd server && npx tsc --noEmit`
Expected: sin errores nuevos relacionados a `orders.controller.ts` / `orders.routes.ts`.

- [ ] **Step 4: Commit**

```bash
git add server/src/modules/orders/orders.controller.ts server/src/modules/orders/orders.routes.ts
git commit -m "feat(reptel): rutas POST /orders/:id/approve-budget y /reject-budget"
```

---

## Task 3: Mobile — Cliente API

**Files:**
- Modify: `apps/mobile/src/services/api.ts`

**Interfaces:**
- Consumes: rutas de la Task 2.
- Produces: `ordersAPI.approveBudget(id: string)`, `ordersAPI.rejectBudget(id: string, reason: string)` — consumidos por la Task 4.

- [ ] **Step 1: Agregar las funciones al objeto `ordersAPI`**

En `apps/mobile/src/services/api.ts`, agregar dentro de `ordersAPI` (después
de `submitFinalPayment`):

```ts
  // Cliente decide sobre el presupuesto tras el diagnóstico del técnico
  approveBudget: (id: string) =>
    api.post(`/api/orders/${id}/approve-budget`),

  rejectBudget: (id: string, reason: string) =>
    api.post(`/api/orders/${id}/reject-budget`, { reason }),
```

- [ ] **Step 2: Verificar tipos**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: sin errores nuevos en `api.ts`.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/services/api.ts
git commit -m "feat(reptel): approveBudget/rejectBudget en el cliente API del movil"
```

---

## Task 4: Mobile — UI en `my-technical-orders.tsx`

**Files:**
- Modify: `apps/mobile/app/(client)/my-technical-orders.tsx`

**Interfaces:**
- Consumes: `ordersAPI.approveBudget`, `ordersAPI.rejectBudget` de la Task 3; `useConfirm()` de `apps/mobile/src/hooks/useConfirm.ts` (ya existe).

- [ ] **Step 1: Agregar el import de `TextInput` y `useConfirm`**

En el bloque de imports de `react-native`, agregar `TextInput`:

```ts
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TextInput,
} from 'react-native'
```

Y agregar debajo de `import { useToastStore } from '../../src/store/toast.store'`:

```ts
import { useConfirm } from '../../src/hooks/useConfirm'
```

- [ ] **Step 2: Agregar estado y el hook dentro de `MyTechnicalOrdersScreen`**

Justo después de `const showToast = useToastStore((state) => state.showToast)`:

```ts
  const confirmDialog = useConfirm()
  const [rejectReason, setRejectReason] = useState<Record<string, string>>({})
  const [rejectReasonOther, setRejectReasonOther] = useState<Record<string, string>>({})
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({})
```

Y agregar esta constante fuera del componente, junto a `STATUS_LABEL`:

```ts
const REJECT_REASONS = ['Es muy costoso', 'Prefiero resolverlo por mi cuenta', 'Otro']
```

- [ ] **Step 3: Agregar los handlers**

Después de `formatDate`, dentro del componente:

```ts
  const handleApproveBudget = async (order: TechOrder) => {
    const confirmed = await confirmDialog({
      title: 'Aprobar presupuesto',
      message: `¿Confirmas que aceptas el presupuesto de $${Number(order.budget).toFixed(2)} para reparar tu equipo?`,
      confirmLabel: 'Aprobar',
    })
    if (!confirmed) return

    setActionLoading((prev) => ({ ...prev, [order.id]: true }))
    try {
      await ordersAPI.approveBudget(order.id)
      showToast('✅ Presupuesto aprobado. El técnico continuará con la reparación.', 'success')
      fetchOrders()
    } catch (error: any) {
      showToast(error?.response?.data?.message || 'Error al aprobar el presupuesto', 'error')
    } finally {
      setActionLoading((prev) => ({ ...prev, [order.id]: false }))
    }
  }

  const handleRejectBudget = async (order: TechOrder) => {
    const selected = rejectReason[order.id]
    if (!selected) {
      showToast('Selecciona un motivo antes de rechazar.', 'error')
      return
    }
    const reason = selected === 'Otro' ? (rejectReasonOther[order.id] || '').trim() : selected
    if (!reason) {
      showToast('Describe el motivo antes de rechazar.', 'error')
      return
    }

    const confirmed = await confirmDialog({
      title: 'Rechazar presupuesto',
      message: 'Entendido, no se realizará la reparación. Ya pagaste la revisión y el delivery — no se te cobrará nada más. ¿Confirmas?',
      confirmLabel: 'Rechazar',
    })
    if (!confirmed) return

    setActionLoading((prev) => ({ ...prev, [order.id]: true }))
    try {
      await ordersAPI.rejectBudget(order.id, reason)
      showToast('Reparación cancelada. No se te cobrará nada adicional.', 'success')
      fetchOrders()
    } catch (error: any) {
      showToast(error?.response?.data?.message || 'Error al rechazar el presupuesto', 'error')
    } finally {
      setActionLoading((prev) => ({ ...prev, [order.id]: false }))
    }
  }
```

- [ ] **Step 4: Agregar el bloque de decisión en el JSX**

Insertar justo después del bloque `{/* Presupuesto */}` (el que muestra
`order.budget` con "Pendiente de aprobación") y antes de `{/* Comprar
repuesto — solo si hay presupuesto real */}`:

```tsx
                      {/* Decisión del cliente sobre el presupuesto */}
                      {status === 'WAITING_APPROVAL' && order.budget != null && Number(order.budget) > 0 && (
                        <View style={styles.decisionCard}>
                          <Text style={styles.decisionTitle}>¿Qué decides con este presupuesto?</Text>

                          <TouchableOpacity
                            style={styles.approveBtn}
                            onPress={(e) => { e.stopPropagation(); handleApproveBudget(order) }}
                            disabled={actionLoading[order.id]}
                          >
                            <Text style={styles.approveBtnText}>✅ Aprobar presupuesto</Text>
                          </TouchableOpacity>

                          <Text style={styles.reasonLabel}>O si prefieres no reparar, indica por qué:</Text>
                          <View style={styles.reasonRow}>
                            {REJECT_REASONS.map((r) => (
                              <TouchableOpacity
                                key={r}
                                style={[styles.reasonChip, rejectReason[order.id] === r && styles.reasonChipActive]}
                                onPress={(e) => {
                                  e.stopPropagation()
                                  setRejectReason((prev) => ({ ...prev, [order.id]: r }))
                                }}
                              >
                                <Text style={[styles.reasonChipText, rejectReason[order.id] === r && styles.reasonChipTextActive]}>
                                  {r}
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </View>

                          {rejectReason[order.id] === 'Otro' && (
                            <TextInput
                              style={styles.reasonInput}
                              placeholder="Cuéntanos el motivo..."
                              placeholderTextColor="#9aa5cc"
                              value={rejectReasonOther[order.id] || ''}
                              onChangeText={(text) =>
                                setRejectReasonOther((prev) => ({ ...prev, [order.id]: text }))
                              }
                            />
                          )}

                          {!!rejectReason[order.id] && (
                            <TouchableOpacity
                              style={styles.rejectBtn}
                              onPress={(e) => { e.stopPropagation(); handleRejectBudget(order) }}
                              disabled={actionLoading[order.id]}
                            >
                              <Text style={styles.rejectBtnText}>❌ Rechazar presupuesto</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      )}
```

- [ ] **Step 5: Agregar los estilos**

En el `StyleSheet.create({...})` al final del archivo, agregar junto a
`finalPaymentBtnText`:

```ts
  decisionCard: {
    backgroundColor: '#f8faff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#d0d8ff',
  },
  decisionTitle: { fontSize: 13, fontWeight: '700', color: '#17247a', marginBottom: 10 },
  approveBtn: {
    backgroundColor: '#1E7A3D',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 14,
  },
  approveBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  reasonLabel: { fontSize: 12, color: '#5364ad', marginBottom: 8 },
  reasonRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  reasonChip: {
    borderWidth: 1.5,
    borderColor: '#d0d8ff',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
  },
  reasonChipActive: { borderColor: '#B3261E', backgroundColor: '#fee2e2' },
  reasonChipText: { fontSize: 12, color: '#17247a', fontWeight: '600' },
  reasonChipTextActive: { color: '#B3261E' },
  reasonInput: {
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#d0d8ff',
    padding: 10,
    fontSize: 13,
    color: '#17247a',
    marginBottom: 10,
  },
  rejectBtn: {
    backgroundColor: '#B3261E',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  rejectBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
```

- [ ] **Step 6: Verificar tipos**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: sin errores nuevos en `my-technical-orders.tsx`.

- [ ] **Step 7: Commit**

```bash
git add "apps/mobile/app/(client)/my-technical-orders.tsx"
git commit -m "feat(reptel): botones aprobar/rechazar presupuesto en la app del cliente

Cierra el flujo de la Figura 5 del TG — el cliente ya puede decidir
en la app en vez de quedar la orden atascada en WAITING_APPROVAL."
```

---

## Task 5: Backend — `submitDiagnosis` siempre a WAITING_APPROVAL + confirmar/disputar diagnóstico $0

**Por qué:** hoy `submitDiagnosis` salta `WAITING_APPROVAL` cuando
`budget === 0` y la orden se cierra directo con un botón de ADMIN
(`closeZeroBudgetOrder`) — el cliente nunca la ve ni la confirma. Se
corrige para que el cliente decida siempre, en los dos casos. Spec completa
en `docs/design-plans/2026-08-16-rechazo-presupuesto-flujo.md` (sección
"flujo unificado v2").

**Files:**
- Modify: `server/src/modules/orders/orders.service.ts`
- Test: `server/src/__tests__/orders-budget-decision.test.ts` (agregar a los tests de la Task 1)

**Interfaces:**
- Modifies: `submitDiagnosis(id, diagnosis, budget, serviceCatalogId?)` — ya no auto-aprueba con `budget=0`, siempre deja `WAITING_APPROVAL`.
- Produces: `confirmZeroBudgetDiagnosis(id: string, email: string): Promise<Order>`, `disputeZeroBudgetDiagnosis(id: string, email: string, note?: string): Promise<Order>` — consumidas por el controller en la Task 6.

- [ ] **Step 1: Agregar los tests (fallarán)**

Agregar a `server/src/__tests__/orders-budget-decision.test.ts`, después de
los `describe` existentes (usa el mismo `beforeAll`/`afterAll`/`makeOrder`
de la Task 1 — agregar el import de las 2 funciones nuevas):

```ts
import { approveBudget, rejectBudget, confirmZeroBudgetDiagnosis, disputeZeroBudgetDiagnosis } from '../modules/orders/orders.service'
import { submitDiagnosis } from '../modules/orders/orders.service'

describe('orders.service — submitDiagnosis siempre WAITING_APPROVAL', () => {
  it('con presupuesto > 0 deja WAITING_APPROVAL (sin cambios)', async () => {
    const order = await makeOrder({ status: 'RECEIVED', budget: undefined as any })
    const result = await submitDiagnosis(order.id, 'Pantalla dañada', 50)
    expect(result.status).toBe('WAITING_APPROVAL')
    expect(result.budgetApproved).toBeNull()
  })

  it('con presupuesto = 0 TAMBIÉN deja WAITING_APPROVAL (antes saltaba a READY)', async () => {
    const order = await makeOrder({ status: 'RECEIVED', budget: undefined as any })
    const result = await submitDiagnosis(order.id, 'No es la laptop, es el cargador', 0)
    expect(result.status).toBe('WAITING_APPROVAL')
    expect(result.budgetApproved).toBeNull() // ya no se auto-aprueba, decide el cliente
  })
})

describe('orders.service — confirmZeroBudgetDiagnosis', () => {
  it('confirma un diagnóstico $0: DELIVERED, comisión $16', async () => {
    const order = await makeOrder({ budget: 0 })
    const result = await confirmZeroBudgetDiagnosis(order.id, userA.email)
    expect(result.status).toBe('DELIVERED')
    expect(Number(result.technicianCommission)).toBe(16)
    expect(result.finalPaymentConfirmedAt).not.toBeNull()
  })

  it('lanza error si el presupuesto no es $0', async () => {
    const order = await makeOrder({ budget: 50 })
    await expect(confirmZeroBudgetDiagnosis(order.id, userA.email)).rejects.toThrow(
      'Esta acción solo aplica a diagnósticos sin costo'
    )
  })

  it('lanza error si la orden no pertenece al cliente', async () => {
    const order = await makeOrder({ budget: 0 })
    await expect(confirmZeroBudgetDiagnosis(order.id, userB.email)).rejects.toThrow('Orden no encontrada')
  })
})

describe('orders.service — disputeZeroBudgetDiagnosis', () => {
  it('vuelve la orden al técnico: RECEIVED, budget y diagnosis en null', async () => {
    const order = await makeOrder({ budget: 0 })
    const result = await disputeZeroBudgetDiagnosis(order.id, userA.email, 'Sigue sin encender')
    expect(result.status).toBe('RECEIVED')
    expect(result.budget).toBeNull()
    expect(result.diagnosis).toBeNull()

    const techAfter = await prisma.user.findUnique({ where: { id: technician.id } })
    expect(techAfter?.activeOrderCount).toBe(1) // NO se decrementa, sigue activa

    const history = await prisma.orderStatusHistory.findFirst({
      where: { orderId: order.id, status: 'RECEIVED' },
      orderBy: { createdAt: 'desc' },
    })
    expect(history?.comment).toContain('Sigue sin encender')
  })

  it('lanza error si el presupuesto no es $0', async () => {
    const order = await makeOrder({ budget: 50 })
    await expect(disputeZeroBudgetDiagnosis(order.id, userA.email)).rejects.toThrow(
      'Esta acción solo aplica a diagnósticos sin costo'
    )
  })
})
```

`makeOrder` de la Task 1 necesita aceptar `budget: undefined` para simular
una orden recién `RECEIVED` sin diagnóstico todavía — ajustar su firma:

```ts
const makeOrder = async (overrides: Partial<{ status: string; budget: number | undefined }> = {}) => {
  return prisma.order.create({
    data: {
      orderNumber: `REP-TEST-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      status: (overrides.status ?? 'WAITING_APPROVAL') as any,
      problem: 'Pantalla dañada — test automatizado',
      budget: 'budget' in overrides ? overrides.budget : 50,
      deliveryAmount: 10,
      revisionAmount: 15,
      clientId: clientA.id,
      deviceId: device.id,
      technicianId: technician.id,
    },
  })
}
```

- [ ] **Step 2: Correr los tests para confirmar que fallan**

Run: `cd server && npx jest orders-budget-decision -v`
Expected: FAIL — `confirmZeroBudgetDiagnosis`/`disputeZeroBudgetDiagnosis` no existen; el test de `submitDiagnosis` con `budget=0` falla porque hoy devuelve `READY`, no `WAITING_APPROVAL`.

- [ ] **Step 3: Modificar `submitDiagnosis` y agregar las 2 funciones nuevas**

En `server/src/modules/orders/orders.service.ts`, dentro de `submitDiagnosis`:

```ts
// ANTES:
//   const hasCost = budget > 0
//   const nextStatus = hasCost ? 'WAITING_APPROVAL' : 'READY'
// AHORA: el cliente decide en los dos casos, incluido $0.
const hasCost = budget > 0
const nextStatus = 'WAITING_APPROVAL'
```

Y en el objeto `data` de esa misma función, quitar la auto-aprobación:
```ts
// ANTES: budgetApproved: hasCost ? undefined : true,
// AHORA: nunca se auto-aprueba, lo decide el cliente
budgetApproved: undefined,
```

Agregar al final del archivo, después de `rejectBudget`:

```ts
// Cliente confirma que no hay nada que reparar (budget=0). Mismo cálculo de
// comisión que closeZeroBudgetOrder (ADMIN), pero disparado por el cliente.
export const confirmZeroBudgetDiagnosis = async (id: string, email: string) => {
  const user = await prisma.user.findUnique({ where: { email }, select: { clientId: true } })
  if (!user || !user.clientId) throw new Error('Cliente no encontrado para este usuario')

  const order = await prisma.order.findFirst({ where: { id, clientId: user.clientId } })
  if (!order) throw new Error('Orden no encontrada')
  if (order.status !== 'WAITING_APPROVAL') {
    throw new Error('Esta acción solo aplica a órdenes esperando aprobación de presupuesto')
  }
  if (order.budget == null || Number(order.budget) !== 0) {
    throw new Error('Esta acción solo aplica a diagnósticos sin costo')
  }

  const deliveryAmount = order.deliveryAmount ? Number(order.deliveryAmount) : 0
  const revisionAmount = order.revisionAmount ? Number(order.revisionAmount) : 0
  const commission = deliveryAmount + 0.4 * revisionAmount

  const updatedOrder = await prisma.order.update({
    where: { id },
    data: {
      budgetApproved: true,
      finalPaymentConfirmed: true,
      finalPaymentConfirmedAt: new Date(),
      technicianCommission: commission,
      status: 'DELIVERED',
      deliveredAt: new Date(),
      statusHistory: {
        create: {
          status: 'DELIVERED',
          comment: `Cliente confirmó el diagnóstico — no requiere reparación. Comisión del técnico: $${commission.toFixed(2)}.`,
        },
      },
    },
    include: {
      client: { include: { user: true } },
      device: true,
      technician: { select: { id: true, name: true } },
      statusHistory: { orderBy: { createdAt: 'desc' } },
    },
  })

  if (order.technicianId) {
    await decrementTechnicianLoad(order.technicianId)
  }

  if (updatedOrder.client.user) {
    await prisma.notification.create({
      data: {
        type: 'STATUS_CHANGE',
        channel: 'PUSH',
        message: `Confirmamos el diagnóstico de la orden #${updatedOrder.orderNumber}: no requiere reparación. No se te cobrará nada adicional.`,
        userId: updatedOrder.client.user.id,
        orderId: id,
      },
    })
  }

  return updatedOrder
}

// Cliente no está de acuerdo con el diagnóstico $0 — la orden vuelve al
// técnico para una nueva revisión. NO se decrementa la carga del técnico:
// la orden sigue activa para él, solo necesita re-diagnosticar.
export const disputeZeroBudgetDiagnosis = async (id: string, email: string, note?: string) => {
  const user = await prisma.user.findUnique({ where: { email }, select: { clientId: true } })
  if (!user || !user.clientId) throw new Error('Cliente no encontrado para este usuario')

  const order = await prisma.order.findFirst({ where: { id, clientId: user.clientId } })
  if (!order) throw new Error('Orden no encontrada')
  if (order.status !== 'WAITING_APPROVAL') {
    throw new Error('Esta acción solo aplica a órdenes esperando aprobación de presupuesto')
  }
  if (order.budget == null || Number(order.budget) !== 0) {
    throw new Error('Esta acción solo aplica a diagnósticos sin costo')
  }

  return await prisma.order.update({
    where: { id },
    data: {
      budget: null,
      diagnosis: null,
      status: 'RECEIVED',
      statusHistory: {
        create: {
          status: 'RECEIVED',
          comment: `Cliente no estuvo de acuerdo con el diagnóstico (sin costo) — solicitó nueva revisión.${note ? ` Nota: ${note}` : ''}`,
        },
      },
    },
    include: {
      client: true,
      device: true,
      technician: { select: { id: true, name: true } },
      statusHistory: { orderBy: { createdAt: 'desc' } },
    },
  })
}
```

- [ ] **Step 4: Correr los tests para confirmar que pasan**

Run: `cd server && npx jest orders-budget-decision -v`
Expected: PASS — todos los tests, incluidos los de la Task 1.

- [ ] **Step 5: Commit**

```bash
git add server/src/modules/orders/orders.service.ts server/src/__tests__/orders-budget-decision.test.ts
git commit -m "feat(reptel): cliente confirma tambien el diagnostico sin costo

submitDiagnosis ya no salta WAITING_APPROVAL con budget=0. Agrega
confirmZeroBudgetDiagnosis y disputeZeroBudgetDiagnosis (vuelve al
tecnico si el cliente no esta de acuerdo)."
```

---

## Task 6: Backend — Controllers y rutas para confirmar/disputar $0

**Files:**
- Modify: `server/src/modules/orders/orders.controller.ts`
- Modify: `server/src/modules/orders/orders.routes.ts`

**Interfaces:**
- Consumes: `confirmZeroBudgetDiagnosis(id, email)`, `disputeZeroBudgetDiagnosis(id, email, note?)` de la Task 5.
- Produces: `POST /api/orders/:id/confirm-zero-budget-diagnosis`, `POST /api/orders/:id/dispute-zero-budget-diagnosis` — consumidos por el móvil en la Task 7.

- [ ] **Step 1: Agregar los controllers**

En `server/src/modules/orders/orders.controller.ts`, después de `rejectBudget` (Task 2):

```ts
export const confirmZeroBudgetDiagnosis = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const email = req.user?.email
    if (!email) {
      res.status(401).json({ success: false, message: 'Usuario no autenticado' })
      return
    }
    const id = String(req.params.id)
    const order = await ordersService.confirmZeroBudgetDiagnosis(id, email)

    broadcastOrderUpdate({ type: 'ORDER_STATUS_UPDATED', data: order })

    res.json({ success: true, data: order })
  } catch (error: any) {
    console.error('ERROR CONFIRMAR DIAGNOSTICO SIN COSTO:', error)
    res.status(400).json({ success: false, message: error.message || 'Error al confirmar el diagnóstico' })
  }
}

export const disputeZeroBudgetDiagnosis = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const email = req.user?.email
    if (!email) {
      res.status(401).json({ success: false, message: 'Usuario no autenticado' })
      return
    }
    const id = String(req.params.id)
    const { note } = req.body
    const order = await ordersService.disputeZeroBudgetDiagnosis(id, email, typeof note === 'string' ? note.trim() : undefined)

    broadcastOrderUpdate({ type: 'ORDER_STATUS_UPDATED', data: order })

    res.json({ success: true, data: order })
  } catch (error: any) {
    console.error('ERROR DISPUTAR DIAGNOSTICO SIN COSTO:', error)
    res.status(400).json({ success: false, message: error.message || 'Error al enviar la disputa' })
  }
}
```

- [ ] **Step 2: Registrar las rutas**

En `server/src/modules/orders/orders.routes.ts`, justo después de las rutas
de la Task 2 (`approve-budget` / `reject-budget`):

```ts
router.post('/:id/confirm-zero-budget-diagnosis', authenticate, authorize('CLIENT'), ordersController.confirmZeroBudgetDiagnosis)
router.post('/:id/dispute-zero-budget-diagnosis', authenticate, authorize('CLIENT'), ordersController.disputeZeroBudgetDiagnosis)
```

- [ ] **Step 3: Verificar tipos**

Run: `cd server && npx tsc --noEmit`
Expected: sin errores nuevos.

- [ ] **Step 4: Commit**

```bash
git add server/src/modules/orders/orders.controller.ts server/src/modules/orders/orders.routes.ts
git commit -m "feat(reptel): rutas para confirmar/disputar el diagnostico sin costo"
```

---

## Task 7: Mobile — Cliente API para confirmar/disputar $0

**Files:**
- Modify: `apps/mobile/src/services/api.ts`

**Interfaces:**
- Consumes: rutas de la Task 6.
- Produces: `ordersAPI.confirmZeroBudgetDiagnosis(id)`, `ordersAPI.disputeZeroBudgetDiagnosis(id, note?)` — consumidos por la Task 8.

- [ ] **Step 1: Agregar las funciones al objeto `ordersAPI`**

En `apps/mobile/src/services/api.ts`, junto a las de la Task 3:

```ts
  confirmZeroBudgetDiagnosis: (id: string) =>
    api.post(`/api/orders/${id}/confirm-zero-budget-diagnosis`),

  disputeZeroBudgetDiagnosis: (id: string, note?: string) =>
    api.post(`/api/orders/${id}/dispute-zero-budget-diagnosis`, { note }),
```

- [ ] **Step 2: Verificar tipos**

Run: `cd apps/mobile && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/services/api.ts
git commit -m "feat(reptel): confirmar/disputar diagnostico sin costo en el cliente API"
```

---

## Task 8: Mobile — UI para confirmar/disputar diagnóstico $0

**Files:**
- Modify: `apps/mobile/app/(client)/my-technical-orders.tsx`

**Interfaces:**
- Consumes: `ordersAPI.confirmZeroBudgetDiagnosis`, `ordersAPI.disputeZeroBudgetDiagnosis` de la Task 7; reutiliza `confirmDialog` de la Task 4.

- [ ] **Step 1: Agregar los handlers**

Después de `handleRejectBudget` (Task 4):

```ts
  const handleConfirmZeroBudget = async (order: TechOrder) => {
    const confirmed = await confirmDialog({
      title: 'Confirmar diagnóstico',
      message: 'El técnico determinó que no es necesario reparar tu equipo. Ya pagaste la revisión y el delivery — no se te cobrará nada más. ¿Confirmas?',
      confirmLabel: 'Confirmar',
    })
    if (!confirmed) return

    setActionLoading((prev) => ({ ...prev, [order.id]: true }))
    try {
      await ordersAPI.confirmZeroBudgetDiagnosis(order.id)
      showToast('✅ Diagnóstico confirmado. No se te cobrará nada adicional.', 'success')
      fetchOrders()
    } catch (error: any) {
      showToast(error?.response?.data?.message || 'Error al confirmar el diagnóstico', 'error')
    } finally {
      setActionLoading((prev) => ({ ...prev, [order.id]: false }))
    }
  }

  const handleDisputeZeroBudget = async (order: TechOrder) => {
    const note = await confirmDialog({
      title: '¿Qué sigue pasando con el equipo?',
      message: 'Cuéntanos brevemente para que el técnico lo tenga en cuenta en la nueva revisión (opcional).',
      confirmLabel: 'Enviar y pedir nueva revisión',
      requireText: true,
      textLabel: 'Ej. Sigue sin encender',
    })
    if (note === null) return // canceló el diálogo

    setActionLoading((prev) => ({ ...prev, [order.id]: true }))
    try {
      await ordersAPI.disputeZeroBudgetDiagnosis(order.id, typeof note === 'string' ? note : undefined)
      showToast('🔁 Enviado. El técnico revisará tu equipo de nuevo.', 'success')
      fetchOrders()
    } catch (error: any) {
      showToast(error?.response?.data?.message || 'Error al enviar la disputa', 'error')
    } finally {
      setActionLoading((prev) => ({ ...prev, [order.id]: false }))
    }
  }
```

- [ ] **Step 2: Agregar la variante $0 en el JSX**

Reemplazar la condición del bloque de decisión agregado en la Task 4
(`{status === 'WAITING_APPROVAL' && order.budget != null && Number(order.budget) > 0 && (...)`)
para que sea **solo** el caso con costo, y agregar el bloque hermano para
`budget === 0` justo después:

```tsx
                      {/* Decisión del cliente — diagnóstico SIN costo */}
                      {status === 'WAITING_APPROVAL' && order.budget != null && Number(order.budget) === 0 && (
                        <View style={styles.decisionCard}>
                          <Text style={styles.decisionTitle}>
                            El técnico determinó que no es necesario reparar tu equipo
                          </Text>
                          {order.diagnosis && (
                            <Text style={styles.reasonLabel}>{order.diagnosis}</Text>
                          )}

                          <TouchableOpacity
                            style={styles.approveBtn}
                            onPress={(e) => { e.stopPropagation(); handleConfirmZeroBudget(order) }}
                            disabled={actionLoading[order.id]}
                          >
                            <Text style={styles.approveBtnText}>✅ Confirmar diagnóstico</Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={styles.rejectBtn}
                            onPress={(e) => { e.stopPropagation(); handleDisputeZeroBudget(order) }}
                            disabled={actionLoading[order.id]}
                          >
                            <Text style={styles.rejectBtnText}>🔁 No estoy de acuerdo, pedir nueva revisión</Text>
                          </TouchableOpacity>
                        </View>
                      )}
```

**Nota — comprar el repuesto (ej. cargador) vinculado a la orden:** ya
existe `select-linked-products.tsx`, con su botón "🔧 Comprar repuesto para
esta orden" (líneas ~355-372 de este mismo archivo), pero está condicionado
a `Number(order.budget) > 0` — con `budget === 0` nunca se muestra. Cambiar
esa condición a `order.budget != null` (sin exigir `> 0`) para que también
aparezca cuando el diagnóstico es sin costo — así, justo cuando el cliente
confirma "no hay nada que reparar en la laptop, es el cargador", ya tiene
ahí mismo el botón para comprarlo vinculado a esta orden, sin tener que
buscarlo aparte en la tienda general. Sin backend nuevo — reutiliza
`linkedOrderId` que ya existe.

- [ ] **Step 3: Verificar tipos**

Run: `cd apps/mobile && npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add "apps/mobile/app/(client)/my-technical-orders.tsx"
git commit -m "feat(reptel): UI para confirmar/disputar el diagnostico sin costo"
```

---

## Task 9: Verificación manual end-to-end

**Files:** ninguno — solo prueba manual guiada, antes de la sesión de QA con Raymar.

- [ ] **Step 1:** Levantar `server`, `admin-web` y `mobile` (dev).
- [ ] **Step 2:** Como cliente, crear una orden, pagar el anticipo completo, esperar a que el admin lo confirme (`RECEIVED`).
- [ ] **Step 3:** Como técnico, registrar diagnóstico con presupuesto > $0 (ej. $50) → orden pasa a `WAITING_APPROVAL`.
- [ ] **Step 4:** Como cliente, abrir la orden en "Mis Órdenes de Servicio" → confirmar que aparecen los botones de Aprobar/Rechazar.
- [ ] **Step 5 (camino aprobar):** Aprobar → confirmar que la orden pasa a `APPROVED` y el técnico la ve reflejada.
- [ ] **Step 6 (camino rechazar, con OTRA orden en WAITING_APPROVAL):** Elegir un motivo, rechazar → confirmar: orden `CANCELLED`, comisión de $16 visible en el resumen del técnico (pestaña "Resumen y Comisiones", debe contar en el total Y en el corte semanal) y en el historial del admin.
- [ ] **Step 7:** Confirmar en el historial de la orden (ambos paneles) que el comentario incluye el motivo elegido.
- [ ] **Step 8 (camino $0, confirmar):** Con OTRA orden, como técnico registrar diagnóstico con presupuesto $0 → orden pasa a `WAITING_APPROVAL` (ya no salta directo a `READY`). Como cliente, confirmar el diagnóstico → orden `DELIVERED`, comisión $16, botón "🔧 Comprar repuesto para esta orden" visible.
- [ ] **Step 9 (camino $0, disputar):** Con OTRA orden en diagnóstico $0, como cliente elegir "No estoy de acuerdo" → orden vuelve a `RECEIVED`, `budget`/`diagnosis` en null. Como técnico, confirmar que la orden reaparece con el formulario "Registrar diagnóstico" (no el de "Agregar comentario de progreso").
- [ ] **Step 10:** En los 4 caminos (aprobar, rechazar, confirmar $0, disputar $0), confirmar que el admin ve el cambio de status reflejado sin recargar manualmente (polling ya existente).
