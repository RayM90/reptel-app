/*
  Warnings:

  - You are about to drop the column `servicePaymentId` on the `invoice` table. All the data in the column will be lost.
  - You are about to drop the `servicepayment` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `invoice` DROP FOREIGN KEY `Invoice_servicePaymentId_fkey`;

-- DropForeignKey
ALTER TABLE `servicepayment` DROP FOREIGN KEY `ServicePayment_orderId_fkey`;

-- DropIndex
DROP INDEX `Invoice_servicePaymentId_key` ON `invoice`;

-- AlterTable
ALTER TABLE `invoice` DROP COLUMN `servicePaymentId`;

-- DropTable
DROP TABLE `servicepayment`;
