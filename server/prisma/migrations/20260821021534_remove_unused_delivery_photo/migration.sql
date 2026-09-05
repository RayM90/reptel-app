/*
  Warnings:

  - You are about to drop the `deliveryphoto` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `deliveryphoto` DROP FOREIGN KEY `DeliveryPhoto_deliveryTrackingId_fkey`;

-- DropTable
DROP TABLE `deliveryphoto`;
