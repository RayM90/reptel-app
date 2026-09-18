import { useEffect, useRef, useState } from 'react'
import { formatClientAddress, isIntakePendingPickup, type Order, type PaymentSubmission, type StatusHistoryEntry } from '../pages/admin/dashboard.types'
import { getStatusBadge, badgeClassName } from '../utils/statusBadge'
import { useConfirmDialogStore } from '../store/confirmDialog.store'
import { api } from '../services/api'
import PhoneInput from './PhoneInput'
import SelectWithOther from './SelectWithOther'
import { VENEZUELAN_BANKS } from '../constants/venezuela'
import { formatFullName } from '../utils/formatName'

// Repuesto de servicio técnico usado en la orden — viene de GET /api/orders/:id/parts
// (ya existía para el panel del técnico, acá lo reutilizamos tal cual).
interface PartUsed {
  id: string
  quantity: number
  reversedAt: string | null
  createdAt: string
  product: { id: string; name: string }
  user: { id: string; name: string; lastName: string } | null
}

type PhaseState = 'done' | 'active' | 'locked'

// Fase del stepper cronológico de la orden. Arranca cerrada (✅) si ya se
// completó, abierta (▶️) si es la fase actual, y sin contenido ni interacción
// (🔒, atenuada) si todavía no corresponde — el admin ve qué viene después
// sin poder tocarlo. Ver docs/superpowers/specs/2026-09-14-stepper-orden-admin-design.md.
function OrderPhase({
  number,
  title,
  state,
  children,
}: {
  number: number
  title: string
  state: PhaseState
  children: React.ReactNode
}) {
  if (state === 'locked') {
    return (
      <div className="card" style={{ opacity: 0.5 }}>
        <h4>🔒 {number}. {title}</h4>
      </div>
    )
  }
  return (
    <details className="card" open={state === 'active'}>
      <summary><h4 style={{ display: 'inline' }}>{state === 'done' ? '✅' : '▶️'} {number}. {title}</h4></summary>
      <div style={{ marginTop: 12 }}>{children}</div>
    </details>
  )
}

function PaymentDetailsView({ details }: { details: Record<string, string> | null }) {
  if (!details) return <span>—</span>
  return (
    <div className="form-hint">
      {Object.entries(details).map(([key, value]) => (
        <div key={key}>
          <strong>{key}:</strong> {value}
        </div>
      ))}
    </div>
  )
}

// Desglose "Presupuesto $30 − Revisión $15 = Base $15" — se muestra debajo
// de cada monto de presupuesto para que quede claro de dónde sale la base
// sobre la que se calcula el anticipo (nunca se vuelve a cobrar la revisión,
// ya está pagada).
function BudgetBreakdown({ budget, revisionAmount }: { budget: number; revisionAmount: number }) {
  const base = budget - revisionAmount
  return (
    <p className="form-hint">
      Presupuesto ${budget.toFixed(2)} − Revisión ${revisionAmount.toFixed(2)} = Base ${base.toFixed(2)}
    </p>
  )
}

function PaymentSubmissionsView({
  submissions,
  total,
  onApprove,
  onReject,
  pendingIds,
}: {
  submissions: PaymentSubmission[]
  total: string
  onApprove: (submissionId: string, amount: string) => void
  onReject: (submissionId: string, amount: string) => void
  pendingIds: Set<string>
}) {
  if (submissions.length === 0) return <span>—</span>

  const confirmedTotal = submissions
    .filter((s) => s.status === 'CONFIRMED')
    .reduce((sum, s) => sum + Number(s.amount), 0)
  const remaining = Number(total) - confirmedTotal

  return (
    <div>
      <p className="form-hint" style={{ marginBottom: 8 }}>
        <strong>Recibido: ${confirmedTotal.toFixed(2)} de ${Number(total).toFixed(2)}</strong>
        {remaining > 0.009 && <span> · Restante: ${remaining.toFixed(2)}</span>}
      </p>
      {submissions.map((s) => (
        <div
          key={s.id}
          style={{
            marginBottom: 8,
            paddingBottom: 8,
            borderBottom: '1px solid var(--color-border)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span className={badgeClassName(getStatusBadge('partialPayment', s.status).variant)}>
              {getStatusBadge('partialPayment', s.status).label}
            </span>
            <strong>${Number(s.amount).toFixed(2)}</strong>
          </div>
          <PaymentDetailsView details={s.paymentDetails} />
          {s.status === 'REJECTED' && s.rejectionReason && (
            <p className="form-hint">Motivo: {s.rejectionReason}</p>
          )}
          {s.status === 'PENDING' && (
            <div style={{ marginTop: 6 }}>
              <button className="btn btn-primary" disabled={pendingIds.has(s.id)} onClick={() => onApprove(s.id, s.amount)}>
                Aprobar abono
              </button>{' '}
              <button className="btn btn-danger" disabled={pendingIds.has(s.id)} onClick={() => onReject(s.id, s.amount)}>
                Rechazar
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// Historial cronológico de estados — el backend lo entrega ordenado desc
// (más reciente primero), acá se invierte para leerlo como checklist. Cada
// entrada muestra cuánto tiempo estuvo la orden en ese estado (diferencia
// con la entrada siguiente, o con "ahora" para la última) — solo
// informativo, sin umbrales ni alertas.
function StatusTimeline({ history }: { history: StatusHistoryEntry[] }) {
  if (history.length === 0) return null
  const chronological = [...history].reverse()

  return (
    <div className="card">
      <h4>Historial de estados</h4>
      <div className="status-timeline">
        {chronological.map((entry, i) => {
          const isLast = i === chronological.length - 1
          const start = new Date(entry.createdAt).getTime()
          const end = isLast ? Date.now() : new Date(chronological[i + 1].createdAt).getTime()
          const days = Math.floor((end - start) / (1000 * 60 * 60 * 24))
          const durationLabel = days > 0
            ? `${days} día${days === 1 ? '' : 's'}${isLast ? ' (en curso)' : ''}`
            : isLast ? 'Recién' : null
          const badge = getStatusBadge('order', entry.status)
          return (
            <div key={entry.id} className="status-timeline-item">
              <div className={`status-timeline-dot status-timeline-dot-${isLast ? badge.variant : 'success'}`} />
              {!isLast && <div className="status-timeline-line" />}
              <div className="status-timeline-content">
                <p className="status-timeline-label">{badge.label}</p>
                <p className="form-hint status-timeline-meta">
                  {new Date(entry.createdAt).toLocaleString('es-VE')}
                  {durationLabel && ` · ${durationLabel}`}
                </p>
                {entry.comment && (
                  <p className="form-hint status-timeline-comment">{entry.comment}</p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Formulario para que el mostrador registre el pago final cuando el cliente
// paga en persona — mismos campos que el formulario de anticipo de
// Registro.tsx (transferencia/pago móvil vía SelectWithOther+PhoneInput, o
// Binance), pero con su propio estado local: es un dato puntual que se
// arma y se envía, no algo que el resto del modal necesite mientras se
// escribe.
function CounterFinalPaymentForm({
  disabled,
  onSubmit,
}: {
  disabled: boolean
  onSubmit: (paymentDetails: Record<string, string>) => void
}) {
  const [method, setMethod] = useState<'TRANSFER' | 'BINANCE' | 'CASH'>('TRANSFER')
  const [banco, setBanco] = useState('')
  const [telefono, setTelefono] = useState('')
  const [referencia, setReferencia] = useState('')
  const [correo, setCorreo] = useState('')
  const [uid, setUid] = useState('')
  const [nombre, setNombre] = useState('')

  const handleSubmit = () => {
    const details: Record<string, string> =
      method === 'BINANCE'
        ? { correo, uid, nombre }
        : method === 'CASH'
          ? { metodo: 'Efectivo' }
          : { banco, telefono, referencia }
    onSubmit(details)
  }

  return (
    <div style={{ marginTop: 8 }}>
      <div className="form-group">
        <label>Método de pago</label>
        <select value={method} onChange={(e) => setMethod(e.target.value as 'TRANSFER' | 'BINANCE' | 'CASH')}>
          <option value="TRANSFER">Transferencia / Pago Móvil</option>
          <option value="BINANCE">Binance</option>
          <option value="CASH">Efectivo</option>
        </select>
      </div>
      {method === 'BINANCE' ? (
        <>
          <div className="form-group">
            <label>Correo Binance</label>
            <input type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} />
          </div>
          <div className="form-group">
            <label>UID Binance</label>
            <input type="text" value={uid} onChange={(e) => setUid(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Nombre del titular</label>
            <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </div>
        </>
      ) : method === 'CASH' ? null : (
        <>
          <div className="form-group">
            <label>Banco</label>
            <SelectWithOther value={banco} options={VENEZUELAN_BANKS.map((b) => b.name)} onChange={setBanco} />
          </div>
          <div className="form-group">
            <label>Teléfono emisor</label>
            <PhoneInput value={telefono} onChange={setTelefono} />
          </div>
          <div className="form-group">
            <label>Últimos 4 dígitos de la referencia</label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={4}
              placeholder="1234"
              value={referencia}
              onChange={(e) => setReferencia(e.target.value.replace(/\D/g, '').slice(0, 4))}
            />
          </div>
        </>
      )}
      <button className="btn btn-primary" disabled={disabled} onClick={handleSubmit}>
        Registrar pago
      </button>
    </div>
  )
}

// Igual que CounterFinalPaymentForm, pero para el anticipo de presupuesto —
// a diferencia del pago final, este sí necesita un monto (el anticipo se
// puede pagar en partes, el cliente en mostrador puede traer solo una parte
// del 50%).
function CounterBudgetPaymentForm({
  suggestedAmount,
  disabled,
  onSubmit,
}: {
  suggestedAmount: number
  disabled: boolean
  onSubmit: (paymentDetails: Record<string, string>, amount: number) => void
}) {
  const [method, setMethod] = useState<'TRANSFER' | 'BINANCE' | 'CASH'>('TRANSFER')
  const [monto, setMonto] = useState(suggestedAmount.toFixed(2))
  const [banco, setBanco] = useState('')
  const [telefono, setTelefono] = useState('')
  const [referencia, setReferencia] = useState('')
  const [correo, setCorreo] = useState('')
  const [uid, setUid] = useState('')
  const [nombre, setNombre] = useState('')

  const handleSubmit = () => {
    const details: Record<string, string> =
      method === 'BINANCE'
        ? { correo, uid, nombre }
        : method === 'CASH'
          ? { metodo: 'Efectivo' }
          : { banco, telefono, referencia }
    onSubmit(details, Number(monto))
  }

  return (
    <div style={{ marginTop: 8 }}>
      <div className="form-group">
        <label>Monto recibido ($)</label>
        <input type="number" min="0.01" step="0.01" value={monto} onChange={(e) => setMonto(e.target.value)} />
        <p className="form-hint">
          Mínimo 50% para autorizar la reparación — el cliente puede pagar en partes o cancelar hasta el 100% de una vez, nunca más.
        </p>
      </div>
      <div className="form-group">
        <label>Método de pago</label>
        <select value={method} onChange={(e) => setMethod(e.target.value as 'TRANSFER' | 'BINANCE' | 'CASH')}>
          <option value="TRANSFER">Transferencia / Pago Móvil</option>
          <option value="BINANCE">Binance</option>
          <option value="CASH">Efectivo</option>
        </select>
      </div>
      {method === 'BINANCE' ? (
        <>
          <div className="form-group">
            <label>Correo Binance</label>
            <input type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} />
          </div>
          <div className="form-group">
            <label>UID Binance</label>
            <input type="text" value={uid} onChange={(e) => setUid(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Nombre del titular</label>
            <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </div>
        </>
      ) : method === 'CASH' ? null : (
        <>
          <div className="form-group">
            <label>Banco</label>
            <SelectWithOther value={banco} options={VENEZUELAN_BANKS.map((b) => b.name)} onChange={setBanco} />
          </div>
          <div className="form-group">
            <label>Teléfono emisor</label>
            <PhoneInput value={telefono} onChange={setTelefono} />
          </div>
          <div className="form-group">
            <label>Últimos 4 dígitos de la referencia</label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={4}
              placeholder="1234"
              value={referencia}
              onChange={(e) => setReferencia(e.target.value.replace(/\D/g, '').slice(0, 4))}
            />
          </div>
        </>
      )}
      <button className="btn btn-primary" disabled={disabled || !monto || Number(monto) <= 0} onClick={handleSubmit}>
        Registrar pago
      </button>
    </div>
  )
}

// Ajuste imprevisto al presupuesto (Finding F, revisión final). El backend lo
// permite en REPAIRING, READY y PAID_PENDING_DELIVERY. Vive en la fase 3
// (Presupuesto y Ajustes) del stepper — antes del cobro final — para que el
// admin lo use antes de cerrar la cuenta con el cliente, no después.
function BudgetAdjustmentForm({
  disabled,
  onSubmit,
}: {
  disabled: boolean
  onSubmit: (amount: number, reason: string) => void
}) {
  const [monto, setMonto] = useState('')
  const [motivo, setMotivo] = useState('')

  const canSubmit = !disabled && Number(monto) > 0 && motivo.trim().length > 0

  return (
    <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--color-border)' }}>
      <h4>Ajuste al presupuesto</h4>
      <p className="form-hint">
        Suma un imprevisto al presupuesto de esta orden. Si la orden ya estaba pagada y pendiente de
        entrega, vuelve a quedar lista con saldo por cobrar.
      </p>
      <div className="form-group">
        <label>Monto a sumar ($)</label>
        <input
          type="number"
          min="0.01"
          step="0.01"
          value={monto}
          onChange={(e) => setMonto(e.target.value)}
        />
      </div>
      <div className="form-group">
        <label>Motivo</label>
        <input
          type="text"
          placeholder="Ej. se detectó el conector de carga dañado"
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
        />
      </div>
      <button
        className="btn btn-primary"
        disabled={!canSubmit}
        onClick={() => {
          onSubmit(Number(monto), motivo.trim())
          setMonto('')
          setMotivo('')
        }}
      >
        Registrar ajuste
      </button>
    </div>
  )
}

interface OrderDetailModalProps {
  order: Order
  pendingIds: Set<string>
  onClose: () => void
  onApproveAdvanceInstallment: (submissionId: string, amount: string) => void
  onRejectAdvanceInstallment: (submissionId: string, amount: string) => void
  onApproveFinalPayment: (order: Order) => void
  onRejectFinalPayment: (order: Order) => void
  onCloseZeroBudgetOrder: (order: Order) => void
  onMarkDelivered: (order: Order) => void
  onMarkPickedUpUnrepaired: (order: Order) => void
  onSubmitCounterFinalPayment: (order: Order, paymentDetails: Record<string, string>) => void
  onSubmitCounterBudgetPayment: (order: Order, paymentDetails: Record<string, string>, amount: number) => void
  onAddBudgetAdjustment: (order: Order, amount: number, reason: string) => void
  onDownloadReceipt: (order: Order, type: 'intake' | 'budget-advance' | 'payment' | 'final' | 'closure') => void
}

// Etiqueta de la fase "Reparación y Pruebas" (informativa, sin formularios
// propios hoy) — deriva del status real de la orden.
const REPAIR_PHASE_LABEL: Record<string, string> = {
  APPROVED: 'Presupuesto aprobado, en espera de inicio de reparación',
  REPAIRING: 'En reparación',
  WAITING_PART: 'Esperando repuesto',
  READY: 'Reparación y pruebas terminadas',
  PAID_PENDING_DELIVERY: 'Reparación y pruebas terminadas',
  DELIVERED: 'Reparación y pruebas terminadas',
}

export default function OrderDetailModal({
  order,
  pendingIds,
  onClose,
  onApproveAdvanceInstallment,
  onRejectAdvanceInstallment,
  onApproveFinalPayment,
  onRejectFinalPayment,
  onCloseZeroBudgetOrder,
  onMarkDelivered,
  onMarkPickedUpUnrepaired,
  onSubmitCounterFinalPayment,
  onSubmitCounterBudgetPayment,
  onAddBudgetAdjustment,
  onDownloadReceipt,
}: OrderDetailModalProps) {
  const boxRef = useRef<HTMLDivElement>(null)
  const [partsUsed, setPartsUsed] = useState<PartUsed[]>([])

  useEffect(() => {
    boxRef.current?.focus()
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (useConfirmDialogStore.getState().isOpen) return
        onClose()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  // Repuestos de servicio técnico usados en la orden (fase 2) — mismo
  // endpoint que ya consume el panel del técnico, no requiere nada nuevo
  // en el backend.
  useEffect(() => {
    let cancelled = false
    api
      .get(`/api/orders/${order.id}/parts`)
      .then((res) => {
        if (!cancelled) setPartsUsed(res.data.data)
      })
      .catch(() => {
        if (!cancelled) setPartsUsed([])
      })
    return () => {
      cancelled = true
    }
  }, [order.id])

  const clientAddress = formatClientAddress(order.client)
  const activePartsUsed = partsUsed.filter((p) => p.reversedAt == null)

  // Cada recibo se muestra junto a la sección de la que es constancia, no
  // todos juntos al final — así queda claro a qué pago/paso corresponde
  // cada uno sin tener que adivinar.
  const showIntakeReceipt = order.status !== 'PENDING_PAYMENT'
  const showBudgetAdvanceReceipt = (order.advancePaymentSubmissions ?? []).some((s) => s.kind === 'BUDGET' && s.status === 'CONFIRMED')
  // La sección de anticipo de presupuesto debe seguir visible (con su
  // recibo) durante toda la vida de la orden una vez que hay presupuesto de
  // por medio — igual que "Pago anticipado" — no solo mientras está en
  // WAITING_APPROVAL (Finding 2, revisión final): se pierde el historial y
  // el botón de recibo apenas se confirma el anticipo y la orden pasa a
  // REPAIRING.
  const hasBudgetSubmissions = (order.advancePaymentSubmissions ?? []).some((s) => s.kind === 'BUDGET')
  const pastDiagnosis = order.status !== 'RECEIVED' && order.status !== 'DIAGNOSING' && order.status !== 'PENDING_PAYMENT'
  const showBudgetAdvanceSection =
    hasBudgetSubmissions || (pastDiagnosis && order.budget != null && Number(order.budget) > 0)
  const showPaymentReceipt = order.finalPaymentConfirmed && order.budget != null && Number(order.budget) > 0
  const showFinalReceipt = order.status === 'DELIVERED'
  const showClosureReceipt = order.status === 'CANCELLED'
  const canRegisterCounterFinalPayment =
    order.status === 'READY' && order.finalPaymentDetails == null && order.budget != null && Number(order.budget) > 0
  // Mismo umbral que el backend: si budget <= revisionAmount no hay
  // anticipo que cobrar (caso "sin costo adicional", ver Acciones).
  const canRegisterCounterBudgetPayment =
    order.status === 'WAITING_APPROVAL' && order.budget != null && Number(order.budget) > Number(order.revisionAmount ?? 15)
  const budgetAdvanceSuggestedAmount = canRegisterCounterBudgetPayment
    ? 0.5 * (Number(order.budget) - Number(order.revisionAmount ?? 15))
    : 0

  // Saldo real de "Pago final": ya no es un 50% fijo — se calcula contra lo
  // que efectivamente se confirmó como anticipo de presupuesto. Si da $0 (o
  // menos) y la orden ya avanzó a PAID_PENDING_DELIVERY/DELIVERED, es porque
  // pasó por finishRepair con saldo $0 (salto directo), no por el formulario
  // tradicional — no hay nada que cobrar.
  const finalBase = Number(order.budget ?? 0) - Number(order.revisionAmount ?? 15)
  const confirmedBudget = (order.advancePaymentSubmissions ?? [])
    .filter((s) => s.kind === 'BUDGET' && s.status === 'CONFIRMED')
    .reduce((sum, s) => sum + Number(s.amount), 0)
  const finalRemaining = finalBase - confirmedBudget
  const finalPaidInFull =
    finalRemaining <= 0.009 && (order.status === 'PAID_PENDING_DELIVERY' || order.status === 'DELIVERED')

  // Los 3 estados en los que el backend acepta un ajuste al presupuesto.
  const canAdjustBudget =
    order.status === 'REPAIRING' || order.status === 'READY' || order.status === 'PAID_PENDING_DELIVERY'

  // ─── Stepper cronológico: 6 fases, cada una desbloqueada cuando la orden
  // llegó al punto del flujo que le corresponde. El "Cobro/Autorización"
  // (fase 4) agrupa el pago de revisión (que se cobra desde la recepción,
  // antes del diagnóstico) y el anticipo de presupuesto (que aparece
  // después) — por eso se desbloquea apenas la orden fue recibida, no
  // recién tras el diagnóstico. La fase activa por defecto es la última
  // desbloqueada; las anteriores arrancan cerradas (✅) para no forzar
  // scroll largo. "Acciones" queda fuera de las fases: aplica en estados
  // que no siguen el orden lineal (cierre sin costo desde WAITING_APPROVAL,
  // cierre por cancelación), y siempre debe quedar accesible.
  const phase2Unlocked = order.status !== 'PENDING_PAYMENT' && order.status !== 'RECEIVED'
  const phase3Unlocked = phase2Unlocked && order.status !== 'DIAGNOSING'
  // Fase 4 debe estar accesible DESDE PENDING_PAYMENT: es justo ahí donde el
  // admin revisa y confirma los comprobantes de anticipo (self-service) que
  // hacen que la orden salga de ese estado. Bloquearla mientras el status es
  // PENDING_PAYMENT dejaba el checkbox de confirmar pago inalcanzable.
  const phase4Unlocked = true
  const phase5Unlocked = ['APPROVED', 'REPAIRING', 'WAITING_PART', 'READY', 'PAID_PENDING_DELIVERY', 'DELIVERED'].includes(order.status)
  const phase6Unlocked = ['READY', 'PAID_PENDING_DELIVERY', 'DELIVERED', 'REJECTED_PENDING_PICKUP', 'CANCELLED'].includes(order.status)

  const unlockedByPhase = [true, phase2Unlocked, phase3Unlocked, phase4Unlocked, phase5Unlocked, phase6Unlocked]
  const activePhase = unlockedByPhase.lastIndexOf(true) + 1
  const phaseState = (phaseNumber: number, unlocked: boolean): PhaseState =>
    !unlocked ? 'locked' : phaseNumber === activePhase ? 'active' : 'done'

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-box modal-box-lg"
        ref={boxRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="order-detail-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3 id="order-detail-title">Orden {order.orderNumber}</h3>
          <button className="btn btn-outline" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>

        <OrderPhase number={1} title="Recepción" state={phaseState(1, true)}>
          <h4>Cliente</h4>
          <p><strong>Nombre:</strong> {formatFullName(order.client.name, order.client.lastName)}</p>
          <p><strong>Cédula:</strong> {order.client.idNumber}</p>
          <p><strong>Teléfono:</strong> {order.client.phone}</p>
          {order.client.email && <p><strong>Email:</strong> {order.client.email}</p>}
          {clientAddress && <p><strong>Dirección:</strong> {clientAddress}</p>}
          <h4 style={{ marginTop: 16 }}>Equipo y falla</h4>
          <p><strong>Origen:</strong> {order.deliveryAmount != null ? '📱 App' : '🏢 Recepción'}</p>
          <p><strong>Falla reportada:</strong> {order.problem}</p>
          <p><strong>Accesorios entregados:</strong> {order.device.accessories || '—'}</p>
          {order.observations && <p><strong>Observaciones:</strong> {order.observations}</p>}
        </OrderPhase>

        <StatusTimeline history={order.statusHistory} />

        <OrderPhase number={2} title="Diagnóstico Técnico" state={phaseState(2, phase2Unlocked)}>
          <p><strong>Técnico asignado:</strong> {order.technician?.name || 'Sin asignar'}</p>
          <p><strong>Diagnóstico:</strong> {order.diagnosis || '—'}</p>
          <h4 style={{ marginTop: 16 }}>Repuestos usados</h4>
          {activePartsUsed.length === 0 ? (
            <p>Sin repuestos registrados</p>
          ) : (
            activePartsUsed.map((p) => (
              <p key={p.id}>
                <strong>{p.product.name}</strong> × {p.quantity}
                {p.user && ` — usado por ${p.user.name} ${p.user.lastName}`}
                {' · '}{new Date(p.createdAt).toLocaleDateString('es-VE')}
              </p>
            ))
          )}
        </OrderPhase>

        <OrderPhase number={3} title="Presupuesto y Ajustes" state={phaseState(3, phase3Unlocked)}>
          <p><strong>Presupuesto:</strong> {order.budget ? `$${order.budget}` : '—'}</p>
          {order.budget != null && Number(order.budget) > 0 && (
            <BudgetBreakdown budget={Number(order.budget)} revisionAmount={Number(order.revisionAmount ?? 15)} />
          )}
          {canAdjustBudget && (
            <BudgetAdjustmentForm
              disabled={pendingIds.has(order.id)}
              onSubmit={(amount, reason) => onAddBudgetAdjustment(order, amount, reason)}
            />
          )}
        </OrderPhase>

        <OrderPhase number={4} title="Cobro / Autorización del Cliente" state={phaseState(4, phase4Unlocked)}>
          <h4>Pago anticipado</h4>
          <PaymentSubmissionsView
            submissions={(order.advancePaymentSubmissions ?? []).filter((s) => s.kind === 'REVISION')}
            total={String(
              order.deliveryAmount != null
                ? Number(order.deliveryAmount) + Number(order.revisionAmount ?? 15)
                : Number(order.revisionAmount ?? 15)
            )}
            onApprove={onApproveAdvanceInstallment}
            onReject={onRejectAdvanceInstallment}
            pendingIds={pendingIds}
          />
          {showIntakeReceipt && (
            <p style={{ marginTop: 8 }}>
              <button className="btn btn-outline" onClick={() => onDownloadReceipt(order, 'intake')}>
                📄 Recibo de {isIntakePendingPickup(order) ? 'Anticipo' : 'Recepción'}
              </button>
            </p>
          )}

          {showBudgetAdvanceSection && (
            <>
              <h4 style={{ marginTop: 16 }}>Anticipo de presupuesto (mínimo 50%)</h4>
              <PaymentSubmissionsView
                submissions={(order.advancePaymentSubmissions ?? []).filter((s) => s.kind === 'BUDGET')}
                total={String(Number(order.budget ?? 0) - Number(order.revisionAmount ?? 15))}
                onApprove={onApproveAdvanceInstallment}
                onReject={onRejectAdvanceInstallment}
                pendingIds={pendingIds}
              />
              {canRegisterCounterBudgetPayment && (
                <CounterBudgetPaymentForm
                  suggestedAmount={budgetAdvanceSuggestedAmount}
                  disabled={pendingIds.has(order.id)}
                  onSubmit={(details, amount) => onSubmitCounterBudgetPayment(order, details, amount)}
                />
              )}
              {showBudgetAdvanceReceipt && (
                <p style={{ marginTop: 8 }}>
                  <button className="btn btn-outline" onClick={() => onDownloadReceipt(order, 'budget-advance')}>
                    📄 Recibo de Anticipo de Presupuesto
                  </button>
                </p>
              )}
            </>
          )}
        </OrderPhase>

        <OrderPhase number={5} title="Reparación y Pruebas" state={phaseState(5, phase5Unlocked)}>
          <p>{REPAIR_PHASE_LABEL[order.status] ?? '—'}</p>
        </OrderPhase>

        <OrderPhase number={6} title="Pago Final y Entrega" state={phaseState(6, phase6Unlocked)}>
          <h4>Pago final</h4>
          {order.budget != null && Number(order.budget) > Number(order.revisionAmount ?? 15) && !finalPaidInFull && (
            <p className="form-hint">Saldo pendiente al entregar: ${Math.max(finalRemaining, 0).toFixed(2)}</p>
          )}
          {finalPaidInFull ? (
            <p>✅ Pagado en su totalidad — sin cobro pendiente.</p>
          ) : (
            <>
              <PaymentDetailsView details={order.finalPaymentDetails} />
              {canRegisterCounterFinalPayment && (
                <CounterFinalPaymentForm
                  disabled={pendingIds.has(order.id)}
                  onSubmit={(details) => onSubmitCounterFinalPayment(order, details)}
                />
              )}
            </>
          )}
          {(showPaymentReceipt || order.status === 'PAID_PENDING_DELIVERY' || showFinalReceipt) && (
            <p style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {showPaymentReceipt && (
                <button className="btn btn-outline" onClick={() => onDownloadReceipt(order, 'payment')}>
                  📄 Recibo de Pago
                </button>
              )}
              {order.status === 'PAID_PENDING_DELIVERY' && (
                order.deliveryAmount != null ? (
                  <>
                    <span className="form-hint" style={{ width: '100%' }}>
                      📱 Orden a domicilio — esperando que el cliente confirme la recepción desde la app.
                    </span>
                    <button className="btn btn-outline" disabled={pendingIds.has(order.id)} onClick={() => onMarkDelivered(order)}>
                      Marcar como entregado manualmente (el cliente no confirmó)
                    </button>
                  </>
                ) : (
                  <button className="btn btn-primary" disabled={pendingIds.has(order.id)} onClick={() => onMarkDelivered(order)}>
                    Marcar como entregado
                  </button>
                )
              )}
              {showFinalReceipt && (
                <button className="btn btn-outline" onClick={() => onDownloadReceipt(order, 'final')}>
                  📄 Recibo de Entrega
                </button>
              )}
            </p>
          )}
        </OrderPhase>

        <p>
          <strong>Acciones:</strong>{' '}
          {(order.status === 'READY' || order.status === 'WAITING_APPROVAL') &&
          order.budget != null &&
          Number(order.budget) <= Number(order.revisionAmount ?? 15) ? (
            <button className="btn btn-primary" disabled={pendingIds.has(order.id)} onClick={() => onCloseZeroBudgetOrder(order)}>
              Marcar como entregada
            </button>
          ) : order.status === 'READY' ? (
            <>
              <button
                className="btn btn-primary"
                onClick={() => onApproveFinalPayment(order)}
                disabled={!order.finalPaymentDetails || pendingIds.has(order.id)}
              >
                Aprobar pago final
              </button>{' '}
              <button className="btn btn-danger" disabled={pendingIds.has(order.id)} onClick={() => onRejectFinalPayment(order)}>
                Rechazar
              </button>
            </>
          ) : order.status === 'REJECTED_PENDING_PICKUP' ? (
            <button className="btn btn-primary" disabled={pendingIds.has(order.id)} onClick={() => onMarkPickedUpUnrepaired(order)}>
              Marcar como entregado sin reparar
            </button>
          ) : (
            '—'
          )}
          {showClosureReceipt && (
            <>
              {' '}
              <button className="btn btn-outline" onClick={() => onDownloadReceipt(order, 'closure')}>
                📄 Recibo de Cierre
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  )
}
