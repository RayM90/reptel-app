export interface KpiItem { label: string; value: string; detail?: string; failed?: boolean }

export default function KpiRow({ items, loading }: { items: KpiItem[]; loading: boolean }) {
  return (
    <div className="kpi-row" aria-busy={loading}>
      {items.map((k) => (
        <div className="kpi" key={k.label}>
          <p className="kpi-label">{k.label}</p>
          {loading ? <div className="skeleton" style={{ height: 34, width: '60%' }} /> : <p className="kpi-value">{k.failed ? '—' : k.value}</p>}
          {!loading && (k.failed || k.detail) && <p className="kpi-detail">{k.failed ? 'No se pudo cargar' : k.detail}</p>}
        </div>
      ))}
    </div>
  )
}
