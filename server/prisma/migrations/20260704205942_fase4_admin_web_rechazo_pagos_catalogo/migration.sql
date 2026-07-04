-- AlterTable
ALTER TABLE `order` ADD COLUMN `advancePaymentRejectionReason` TEXT NULL,
    ADD COLUMN `serviceCatalogId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `productdelivery` ADD COLUMN `clientConfirmedAt` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `productorder` ADD COLUMN `rejectionReason` TEXT NULL,
    MODIFY `status` ENUM('PENDING', 'CONFIRMED', 'REJECTED', 'READY_FOR_PICKUP', 'ASSIGNED_DELIVERY', 'ON_THE_WAY', 'DELIVERED', 'CANCELLED') NOT NULL DEFAULT 'PENDING';

-- AddForeignKey
ALTER TABLE `Order` ADD CONSTRAINT `Order_serviceCatalogId_fkey` FOREIGN KEY (`serviceCatalogId`) REFERENCES `servicecatalog`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
