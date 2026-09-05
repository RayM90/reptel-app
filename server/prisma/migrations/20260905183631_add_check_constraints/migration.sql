-- CHECK constraints como respaldo a nivel de motor de las validaciones de
-- aplicación (products.controller.ts, product-orders.service.ts). MySQL
-- 8.0.16+ sí las hace cumplir (versiones anteriores las ignoraban en
-- silencio) — confirmar la versión de MySQL antes de aplicar en producción.
ALTER TABLE `product`
  ADD CONSTRAINT `product_price_non_negative` CHECK (`price` >= 0),
  ADD CONSTRAINT `product_stock_non_negative` CHECK (`stock` >= 0),
  ADD CONSTRAINT `product_minstock_non_negative` CHECK (`minStock` >= 0);

ALTER TABLE `productorderitem`
  ADD CONSTRAINT `productorderitem_quantity_positive` CHECK (`quantity` > 0),
  ADD CONSTRAINT `productorderitem_unitprice_non_negative` CHECK (`unitPrice` >= 0);

ALTER TABLE `Order`
  ADD CONSTRAINT `order_budget_non_negative` CHECK (`budget` IS NULL OR `budget` >= 0);