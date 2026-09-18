-- AlterTable
ALTER TABLE `inventorymovement` ADD COLUMN `lossDescription` TEXT NULL,
    ADD COLUMN `lossReportedAt` DATETIME(3) NULL,
    ADD COLUMN `lossReportedByUserId` VARCHAR(191) NULL;
