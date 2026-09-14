// apps/admin-web/src/utils/productStatus.ts
//
// Estado de stock de un producto — SIEMPRE calculado, nunca persistido (ver
// docs/superpowers/specs/2026-09-13-inventario-estados-historial-design.md). isActive se
// evalúa primero y queda reservado exclusivamente para "descontinuado": un producto
// descontinuado con stock residual debe mostrar INACTIVE, no IN_STOCK.

export type StockStatus = 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK' | 'INACTIVE'

export function getStockStatus(p: { stock: number; minStock: number; isActive: boolean }): StockStatus {
  if (!p.isActive) return 'INACTIVE'
  if (p.stock <= 0) return 'OUT_OF_STOCK'
  if (p.stock <= p.minStock) return 'LOW_STOCK'
  return 'IN_STOCK'
}

export const STOCK_STATUS_LABELS: Record<StockStatus, string> = {
  IN_STOCK: 'En stock',
  LOW_STOCK: 'Stock bajo',
  OUT_OF_STOCK: 'Agotado',
  INACTIVE: 'Inactivo / Descontinuado',
}

export const STOCK_STATUS_BADGE_CLASS: Record<StockStatus, string> = {
  IN_STOCK: 'badge badge-success',
  LOW_STOCK: 'badge badge-warning',
  OUT_OF_STOCK: 'badge badge-danger',
  INACTIVE: 'badge',
}
