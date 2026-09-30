import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useReportFilters } from './reports/useReportFilters'
import ReportFilters from './reports/ReportFilters'
import PendingTab from './reports/PendingTab'
import PeriodTab from './reports/PeriodTab'

export default function Reports() {
  const { filters, update } = useReportFilters()
  const tabs = [
    { key: 'hoy' as const, label: 'Hoy y pendientes' },
    { key: 'periodo' as const, label: 'Período' },
  ]

  // Forzar que los <details className="card"> se muestren expandidos al
  // exportar a PDF — ver comentario original conservado, misma técnica.
  useEffect(() => {
    const detailsToRestore: HTMLDetailsElement[] = []
    const handleBeforePrint = () => {
      document.querySelectorAll<HTMLDetailsElement>('details.card').forEach((d) => {
        if (!d.open) {
          d.open = true
          detailsToRestore.push(d)
        }
      })
    }
    const handleAfterPrint = () => {
      detailsToRestore.forEach((d) => { d.open = false })
      detailsToRestore.length = 0
    }
    window.addEventListener('beforeprint', handleBeforePrint)
    window.addEventListener('afterprint', handleAfterPrint)
    return () => {
      window.removeEventListener('beforeprint', handleBeforePrint)
      window.removeEventListener('afterprint', handleAfterPrint)
    }
  }, [])

  return (
    <div className="page-container">
      <div className="no-print page-header">
        <h1>Reportes</h1>
        <div className="page-header-actions">
          <button className="btn btn-outline" onClick={() => window.print()}>Imprimir / PDF</button>
          <Link to="/admin" className="btn btn-secondary">← Volver al panel</Link>
        </div>
      </div>

      <div className="report-tabs" role="tablist" aria-label="Vistas de reportes">
        {tabs.map((t) => (
          <button key={t.key} role="tab" id={`tab-${t.key}`} aria-controls={`panel-${t.key}`}
            aria-selected={filters.tab === t.key} tabIndex={filters.tab === t.key ? 0 : -1}
            onClick={() => update({ tab: t.key })}
            onKeyDown={(e) => {
              const i = tabs.findIndex((x) => x.key === t.key)
              const next = e.key === 'ArrowRight' ? (i + 1) % tabs.length
                : e.key === 'ArrowLeft' ? (i - 1 + tabs.length) % tabs.length
                : e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : -1
              if (next < 0) return
              e.preventDefault()
              update({ tab: tabs[next].key })
              document.getElementById(`tab-${tabs[next].key}`)?.focus()
            }}>
            {t.label}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`panel-${filters.tab}`} aria-labelledby={`tab-${filters.tab}`}>
        <ReportFilters mode={filters.tab} />
        {filters.tab === 'hoy' ? <PendingTab /> : <PeriodTab />}
      </div>
    </div>
  )
}
