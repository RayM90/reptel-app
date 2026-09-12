import { useEffect, useRef, useState } from 'react'
import { formatClientAddress, isIntakePendingPickup, type Order, type PaymentSubmission, type StatusHistoryEntry } from '../pages/admin/dashboard.types'
import { getStatusBadge, badgeClassName } from '../utils/statusBadge'
import { useConfirmDialogStore } from '../store/confirmDialog.store'
import PhoneInput from './PhoneInput'
import SelectWithOther from './SelectWithOther'
import { VENEZUELAN_BANKS } from '../constants/venezuela'

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
      {chronological.map((entry, i) => {
        const isLast = i === chronological.length - 1
        const start = new Date(entry.createdAt).getTime()
        const end = isLast ? Date.now() : new Date(chronological[i + 1].createdAt).getTime()
        const days = Math.floor((end - start) / (1000 * 60 * 60 * 24))
        const durationLabel = days > 0
          ? ` — ${days} día${days === 1 ? '' : 's'}${isLast ? ' (en curso)' : ''}`
          : isLast ? ' (recién)' : ''
        return (
          <p key={entry.id} className="form-hint" style={{ marginBottom: 4 }}>
            {isLast ? '○' : '✓'} {getStatusBadge('order', entry.status).label} — {new Date(entry.createdAt).toLocaleString('es-VE')}
            {durationLabel}
          </p>
        )
      })}
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
  const [method, setMethod] = useState<'TRANSFER' | 'BINANCE'>('TRANSFER')
  const [banco, setBanco] = useState('')
  const [telefono, setTelefono] = useState('')
  const [referencia, setReferencia] = useState('')
  const [correo, setCorreo] = useState('')
  const [uid, setUid] = useState('')
  const [nombre, setNombre] = useState('')

  const handleSubmit = () => {
    const details: Record<string, string> = method === 'BINANCE'
      ? { correo, uid, nombre }
      : { banco, telefono, referencia }
    onSubmit(details)
  }

  return (
    <div style={{ marginTop: 8 }}>
      <div className="form-group">
        <label>Método de pago</label>
        <select value={method} onChange={(e) => setMethod(e.target.value as 'TRANSFER' | 'BINANCE')}>
          <option value="TRANSFER">Transferencia / Pago Móvil</option>
          <option value="BINANCE">Binance</option>
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
      ) : (
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
            <label>Referencia</label>
            <input type="text" value={referencia} onChange={(e) => setReferencia(e.target.value)} />
          </div>
        </>
      )}
      <button className="btn btn-primary" disabled={disabled} onClick={handleSubmit}>
        Registrar pago
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
  onDownloadReceipt: (order: Order, type: 'intake' | 'payment' | 'final' | 'closure') => void
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
  onDownloadReceipt,
}: OrderDetailModalProps) {
  const boxRef = useRef<HTMLDivElement>(null)

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

  const clientAddress = formatClientAddress(order.client)

  // Cada recibo se muestra junto a la sección de la que es constancia, no
  // todos juntos al final — así queda claro a qué pago/paso corresponde
  // cada uno sin tener que adivinar.
  const showIntakeReceipt = order.status !== 'PENDING_PAYMENT'
  const showPaymentReceipt = order.finalPaymentConfirmed && order.budget != null && Number(order.budget) > 0
  const showFinalReceipt = order.status === 'DELIVERED'
  const showClosureReceipt = order.status === 'CANCELLED'
  const canRegisterCounterFinalPayment =
    order.status === 'READY' && order.finalPaymentDetails == null && order.budget != null && Number(order.budget) > 0

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

        <div className="card">
          <h4>Cliente</h4>
          <p><strong>Nombre:</strong> {order.client.name} {order.client.lastName}</p>
          <p><strong>Cédula:</strong> {order.client.idNumber}</p>
          <p><strong>Teléfono:</strong> {order.client.phone}</p>
          {order.client.email && <p><strong>Email:</strong> {order.client.email}</p>}
          {clientAddress && <p><strong>Dirección:</strong> {clientAddress}</p>}
        </div>

        <div className="card">
          <h4>Recepción</h4>
          <p><strong>Origen:</strong> {order.deliveryAmount != null ? '📱 App' : '🏢 Recepción'}</p>
          <p><strong>Falla reportada:</strong> {order.problem}</p>
          <p><strong>Accesorios entregados:</strong> {order.device.accessories || '—'}</p>
          {order.observations && <p><strong>Observaciones:</strong> {order.observations}</p>}
        </div>

        <div className="card">
          <h4>Técnico</h4>
          <p><strong>Asignado:</strong> {order.technician?.name || 'Sin asignar'}</p>
          <p><strong>Diagnóstico:</strong> {order.diagnosis || '—'}</p>
          <p><strong>Presupuesto:</strong> {order.budget ? `$${order.budget}` : '—'}</p>
        </div>

        <StatusTimeline history={order.statusHistory} />

        <div className="card">
          <h4>Pago anticipado</h4>
          <PaymentSubmissionsView
            submissions={order.advancePaymentSubmissions ?? []}
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
        </div>

        <div className="card">
          <h4>Pago final</h4>
          <PaymentDetailsView details={order.finalPaymentDetails} />
          {canRegisterCounterFinalPayment && (
            <CounterFinalPaymentForm
              disabled={pendingIds.has(order.id)}
              onSubmit={(details) => onSubmitCounterFinalPayment(order, details)}
            />
          )}
          {showPaymentReceipt && (
            <p style={{ marginTop: 8 }}>
              <button className="btn btn-outline" onClick={() => onDownloadReceipt(order, 'payment')}>
                📄 Recibo de Pago
              </button>
            </p>
          )}
        </div>

        <p>
          <strong>Acciones:</strong>{' '}
          {(order.status === 'READY' || order.status === 'WAITING_APPROVAL') && order.budget != null && Number(order.budget) === 0 ? (
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
          ) : order.status === 'PAID_PENDING_DELIVERY' ? (
            <button className="btn btn-primary" disabled={pendingIds.has(order.id)} onClick={() => onMarkDelivered(order)}>
              Marcar como entregado
            </button>
          ) : order.status === 'REJECTED_PENDING_PICKUP' ? (
            <button className="btn btn-primary" disabled={pendingIds.has(order.id)} onClick={() => onMarkPickedUpUnrepaired(order)}>
              Marcar como entregado sin reparar
            </button>
          ) : (
            '—'
          )}
          {showFinalReceipt && (
            <>
              {' '}
              <button className="btn btn-outline" onClick={() => onDownloadReceipt(order, 'final')}>
                📄 Recibo de Entrega
              </button>
            </>
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
