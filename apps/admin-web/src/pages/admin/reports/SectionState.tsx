import type { ReactNode } from 'react'

interface Props { loading: boolean; error: string; empty: boolean; emptyText: string; onRetry: () => void; children: ReactNode }

export default function SectionState({ loading, error, empty, emptyText, onRetry, children }: Props) {
  if (loading) return <div role="status" aria-label="Cargando"><div className="skeleton" style={{ height: 120 }} /></div>
  if (error) return (
    <div role="alert" className="form-hint">
      {error} <button type="button" className="btn btn-outline" onClick={onRetry}>Reintentar</button>
    </div>
  )
  if (empty) return <p className="form-hint">{emptyText}</p>
  return <>{children}</>
}
