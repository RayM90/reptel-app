-- AlterTable
ALTER TABLE `notification` ADD COLUMN `productOrderId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `productorder` ADD COLUMN `receiptUrl` VARCHAR(191) NULL;

-- AddForeignKey
ALTER TABLE `notification` ADD CONSTRAINT `notification_productOrderId_fkey` FOREIGN KEY (`productOrderId`) REFERENCES `productorder`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
