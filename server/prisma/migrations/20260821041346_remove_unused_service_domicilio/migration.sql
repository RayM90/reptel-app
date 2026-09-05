/*
  Warnings:

  - You are about to drop the column `serviceRequestId` on the `order` table. All the data in the column will be lost.
  - You are about to drop the `deliverytracking` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `servicerequest` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `deliverytracking` DROP FOREIGN KEY `DeliveryTracking_deliveryUserId_fkey`;

-- DropForeignKey
ALTER TABLE `deliverytracking` DROP FOREIGN KEY `DeliveryTracking_serviceRequestId_fkey`;

-- DropForeignKey
ALTER TABLE `order` DROP FOREIGN KEY `Order_serviceRequestId_fkey`;

-- DropForeignKey
ALTER TABLE `servicerequest` DROP FOREIGN KEY `ServiceRequest_clientId_fkey`;

-- DropIndex
DROP INDEX `Order_serviceRequestId_key` ON `order`;

-- AlterTable
ALTER TABLE `order` DROP COLUMN `serviceRequestId`;

-- DropTable
DROP TABLE `deliverytracking`;

-- DropTable
DROP TABLE `servicerequest`;
