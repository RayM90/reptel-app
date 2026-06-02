/*
  Warnings:

  - You are about to drop the column `clientId` on the `device` table. All the data in the column will be lost.
  - The values [CELLPHONE,TABLET] on the enum `ServiceRequest_deviceType` will be removed. If these variants are still used in the database, this will fail.
  - The values [SMS] on the enum `Notification_channel` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `cognitoId` on the `user` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[serviceRequestId]` on the table `Order` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE `device` DROP FOREIGN KEY `Device_clientId_fkey`;

-- DropForeignKey
ALTER TABLE `order` DROP FOREIGN KEY `Order_clientId_fkey`;

-- DropIndex
DROP INDEX `Device_clientId_fkey` ON `device`;

-- DropIndex
DROP INDEX `Order_clientId_fkey` ON `order`;

-- DropIndex
DROP INDEX `User_cognitoId_key` ON `user`;

-- AlterTable
ALTER TABLE `device` DROP COLUMN `clientId`,
    MODIFY `type` ENUM('LAPTOP', 'PC', 'OTHER') NOT NULL;

-- AlterTable
ALTER TABLE `notification` MODIFY `type` ENUM('STATUS_CHANGE', 'BUDGET_REQUEST', 'READY_FOR_PICKUP', 'DELIVERY_UPDATE', 'GENERAL') NOT NULL,
    MODIFY `channel` ENUM('EMAIL', 'PUSH') NOT NULL;

-- AlterTable
ALTER TABLE `order` ADD COLUMN `serviceRequestId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `user` DROP COLUMN `cognitoId`,
    MODIFY `role` ENUM('ADMIN', 'CASHIER', 'TECHNICIAN', 'DELIVERY', 'CLIENT', 'MANAGER', 'SELLER') NOT NULL DEFAULT 'CLIENT';

-- CreateTable
CREATE TABLE `Client` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `lastName` VARCHAR(191) NOT NULL,
    `idNumber` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NULL,
    `address` VARCHAR(191) NULL,
    `password` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Client_idNumber_key`(`idNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ServiceRequest` (
    `id` VARCHAR(191) NOT NULL,
    `type` ENUM('PRESENCIAL', 'DELIVERY') NOT NULL,
    `status` ENUM('PENDING', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `deviceType` ENUM('LAPTOP', 'PC', 'OTHER') NOT NULL,
    `brand` VARCHAR(191) NOT NULL,
    `description` TEXT NOT NULL,
    `address` VARCHAR(191) NULL,
    `paymentMethod` ENUM('CASH', 'TRANSFER', 'POINT_OF_SALE') NOT NULL,
    `deliveryCost` DECIMAL(10, 2) NULL,
    `tip` DECIMAL(10, 2) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `clientId` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DeliveryTracking` (
    `id` VARCHAR(191) NOT NULL,
    `status` ENUM('ASSIGNED', 'LEAVING_STORE', 'ON_THE_WAY', 'EQUIPMENT_PICKED_UP', 'AT_THE_SHOP', 'RETURNING', 'DELIVERED', 'CANCELLED') NOT NULL DEFAULT 'ASSIGNED',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `serviceRequestId` VARCHAR(191) NOT NULL,
    `deliveryUserId` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `DeliveryTracking_serviceRequestId_key`(`serviceRequestId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DeliveryPhoto` (
    `id` VARCHAR(191) NOT NULL,
    `url` VARCHAR(191) NOT NULL,
    `type` ENUM('PICKUP', 'DELIVERY') NOT NULL,
    `confirmedByClient` BOOLEAN NOT NULL DEFAULT false,
    `confirmedByCashier` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `deliveryTrackingId` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `Order_serviceRequestId_key` ON `Order`(`serviceRequestId`);

-- AddForeignKey
ALTER TABLE `Order` ADD CONSTRAINT `Order_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `Client`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Order` ADD CONSTRAINT `Order_serviceRequestId_fkey` FOREIGN KEY (`serviceRequestId`) REFERENCES `ServiceRequest`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ServiceRequest` ADD CONSTRAINT `ServiceRequest_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `Client`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DeliveryTracking` ADD CONSTRAINT `DeliveryTracking_serviceRequestId_fkey` FOREIGN KEY (`serviceRequestId`) REFERENCES `ServiceRequest`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DeliveryTracking` ADD CONSTRAINT `DeliveryTracking_deliveryUserId_fkey` FOREIGN KEY (`deliveryUserId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DeliveryPhoto` ADD CONSTRAINT `DeliveryPhoto_deliveryTrackingId_fkey` FOREIGN KEY (`deliveryTrackingId`) REFERENCES `DeliveryTracking`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
