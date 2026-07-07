-- AlterTable
ALTER TABLE `order` ADD COLUMN `finalPaymentConfirmed` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `finalPaymentConfirmedAt` DATETIME(3) NULL,
    ADD COLUMN `finalPaymentDetails` JSON NULL,
    ADD COLUMN `finalPaymentRejectionReason` TEXT NULL,
    ADD COLUMN `technicianCommission` DECIMAL(10, 2) NULL;
