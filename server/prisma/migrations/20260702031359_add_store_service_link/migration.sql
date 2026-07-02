-- AlterTable
ALTER TABLE `product` ADD COLUMN `requiresInstallation` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `productorder` ADD COLUMN `installationCost` DECIMAL(10, 2) NULL,
    ADD COLUMN `requiresInstallation` BOOLEAN NOT NULL DEFAULT false,
    MODIFY `deliveryMethod` ENUM('PICKUP_AT_STORE', 'HOME_DELIVERY', 'TECHNICIAN_DELIVERY') NOT NULL;

-- AddForeignKey
ALTER TABLE `productorder` ADD CONSTRAINT `productorder_linkedOrderId_fkey` FOREIGN KEY (`linkedOrderId`) REFERENCES `Order`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
