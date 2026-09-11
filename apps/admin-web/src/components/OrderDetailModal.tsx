import { useEffect, useRef } from 'react'
import { isIntakePendingPickup, type Order, type PaymentSubmission } from '../pages/admin/dashboard.types'
import { getStatusBadge, badgeClassName } from '../utils/statusBadge'

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

interface OrderDetailModalProps {
  order: Order
  pendingIds: Set<string>
  onClose: () => void
  onApproveAdvanceInstallment: (submissionId: string, amount: string) => void
  onRejectAdvanceInstallment: (submissionId: string, amount: string) => void
  onApproveFinalPayment: (order: Order) => void
  onRejectFinalPayment: (order: Order) => void
  onCloseZeroBudgetOrder: (order: Order) => void
  onDownloadReceipt: (order: Order, type: 'intake' | 'final') => void
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
  onDownloadReceipt,
}: OrderDetailModalProps) {
  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    boxRef.current?.focus()

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

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

        <p><strong>Problema:</strong> {order.problem}</p>
        <p><strong>Presupuesto:</strong> {order.budget ? `$${order.budget}` : '—'}</p>

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
        </div>

        <div className="card">
          <h4>Pago final</h4>
          <PaymentDetailsView details={order.finalPaymentDetails} />
        </div>

        <p>
          <strong>Recibo:</strong>{' '}
          {order.status === 'PENDING_PAYMENT' ? (
            '—'
          ) : (
            <button className="btn btn-outline" onClick={() => onDownloadReceipt(order, 'intake')}>
              📄 {isIntakePendingPickup(order) ? 'Anticipo' : 'Recepción'}
            </button>
          )}
        </p>

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
          ) : (
            '—'
          )}
        </p>
      </div>
    </div>
  )
}
