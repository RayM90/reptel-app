export interface KpiItem { label: string; value: string; detail?: string }

export default function KpiRow({ items, loading }: { items: KpiItem[]; loading: boolean }) {
  return (
    <div className="kpi-row" aria-busy={loading}>
      {items.map((k) => (
        <div className="kpi" key={k.label}>
          <p className="kpi-label">{k.label}</p>
          {loading ? <div className="skeleton" style={{ height: 34, width: '60%' }} /> : <p className="kpi-value">{k.value}</p>}
          {!loading && k.detail && <p className="kpi-detail">{k.detail}</p>}
        </div>
      ))}
    </div>
  )
}
