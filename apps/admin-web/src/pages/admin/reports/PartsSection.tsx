import SectionState from './SectionState'
import { formatDay } from './dateRange'
import type { PartsReport } from './reports.types'

const money = (n: number) => `$${n.toFixed(2)}`

interface Props { data: PartsReport | null; loading: boolean; error: string; onRetry: () => void; rangeLabel: string; onShowDetail: () => void }

export default function PartsSection({ data, loading, error, onRetry, rangeLabel, onShowDetail }: Props) {
  return (
    <section className="card">
      <div className="section-head">
        <h2 style={{ margin: 0 }}>Repuestos</h2>
        <button type="button" className="btn btn-outline btn-compact no-print" onClick={onShowDetail}>Ver detalle →</button>
      </div>
      <SectionState loading={loading} error={error} onRetry={onRetry}
        empty={!!data && data.used.units === 0 && data.technicianLosses.units === 0 && (!data.store || (data.store.sales.units + data.store.damagedOnArrival.units + data.store.otherAdjustments.units === 0))}
        emptyText={`No se usaron repuestos (${rangeLabel}). Prueba otro rango.`}>
        {data && (
          <>
            <p>
              <strong>{data.used.units} usados en reparaciones</strong> · {money(data.used.amount)} a precio de venta
              {data.used.awaitingPaymentAmount > 0 && <> · <span className="form-hint">{money(data.used.awaitingPaymentAmount)} todavía sin pagar</span></>}
            </p>
            {data.used.byProduct.length > 0 && (
              <div className="table-wrapper">
                <table className="styled-table">
                  <thead><tr><th scope="col">Repuesto</th><th scope="col">Unidades</th><th scope="col">Órdenes</th><th scope="col" className="money">Cobrado</th></tr></thead>
                  <tbody>
                    {data.used.byProduct.map((p) => (
                      <tr key={p.productId}>
                        <td data-label="Repuesto">{p.productName}</td>
                        <td data-label="Unidades">{p.units}</td>
                        <td data-label="Órdenes">{p.orders}</td>
                        <td className="money" data-label="Cobrado">{money(p.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <h3 className="subsection-title">Mermas de técnicos</h3>
            {data.technicianLosses.items.length === 0 ? (
              <p className="form-hint">Ningún técnico reportó repuestos dañados en este período.</p>
            ) : (
              <>
                <p>{data.technicianLosses.units} unidades · {money(data.technicianLosses.amount)} que no se cobraron al cliente</p>
                <div className="table-wrapper">
                  <table className="styled-table">
                    <thead><tr><th scope="col">Día</th><th scope="col">Repuesto</th><th scope="col">Orden</th><th scope="col">Técnico</th><th scope="col">Qué pasó</th><th scope="col" className="money">Valor</th></tr></thead>
                    <tbody>
                      {data.technicianLosses.items.map((m) => (
                        <tr key={m.movementId}>
                          <td data-label="Día">{formatDay(m.day)}</td>
                          <td data-label="Repuesto">{m.productName} ×{m.quantity}</td>
                          <td data-label="Orden">{m.orderNumber}</td>
                          <td data-label="Técnico">{m.technicianName}</td>
                          <td data-label="Qué pasó">{m.description}</td>
                          <td className="money" data-label="Valor">{money(m.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            <h3 className="subsection-title">Movimientos de tienda</h3>
            {data.store ? (
              <ul>
                <li><strong>Dañados al recibir:</strong> {data.store.damagedOnArrival.units} uds. · {money(data.store.damagedOnArrival.amount)}</li>
                <li><strong>Ventas en tienda:</strong> {data.store.sales.units} uds. · {money(data.store.sales.estimatedAmount)} <span className="form-hint">(estimado con el precio actual; la venta no guarda el precio cobrado)</span></li>
                <li><strong>Correcciones de conteo y otros:</strong> {data.store.otherAdjustments.units} uds. <span className="form-hint">(no son pérdidas)</span></li>
              </ul>
            ) : (
              <p className="form-hint">No aplica con filtro de técnico, cliente o canal: son movimientos de la tienda, sin orden ni técnico.</p>
            )}
          </>
        )}
      </SectionState>
    </section>
  )
}
