-- AlterTable
ALTER TABLE `order` ADD COLUMN `advancePaymentDetails` JSON NULL;

-- AlterTable
ALTER TABLE `productorder` ADD COLUMN `paymentDetails` JSON NULL;
