-- CreateIndex
CREATE INDEX `Order_status_deliveredAt_idx` ON `Order`(`status`, `deliveredAt`);

-- CreateIndex
CREATE INDEX `Order_receivedAt_idx` ON `Order`(`receivedAt`);
