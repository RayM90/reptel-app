-- AlterTable
ALTER TABLE `inventorymovement` ADD COLUMN `orderId` VARCHAR(191) NULL,
    ADD COLUMN `reversedAt` DATETIME(3) NULL,
    ADD COLUMN `reversedByUserId` VARCHAR(191) NULL,
    ADD COLUMN `unitPriceAtUse` DECIMAL(10, 2) NULL;

-- AddForeignKey
ALTER TABLE `inventorymovement` ADD CONSTRAINT `inventorymovement_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
