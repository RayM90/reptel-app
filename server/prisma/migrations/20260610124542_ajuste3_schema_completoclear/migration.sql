-- DropForeignKey
ALTER TABLE `notification` DROP FOREIGN KEY `Notification_orderId_fkey`;

-- DropForeignKey
ALTER TABLE `notification` DROP FOREIGN KEY `Notification_userId_fkey`;

-- DropIndex
DROP INDEX `Notification_orderId_fkey` ON `notification`;

-- AlterTable
ALTER TABLE `deliveryphoto` MODIFY `type` ENUM('PICKUP', 'PROCESS', 'DELIVERY') NOT NULL;

-- AlterTable
ALTER TABLE `deliverytracking` ADD COLUMN `gpsLatitude` DECIMAL(10, 7) NULL,
    ADD COLUMN `gpsLongitude` DECIMAL(10, 7) NULL,
    ADD COLUMN `onSiteDiagnosis` TEXT NULL,
    ADD COLUMN `result` ENUM('RESOLVED_ON_SITE', 'TAKEN_TO_SHOP') NULL,
    MODIFY `status` ENUM('ASSIGNED', 'LEAVING_STORE', 'ON_THE_WAY', 'AT_LOCATION', 'DIAGNOSING_ON_SITE', 'EQUIPMENT_PICKED_UP', 'AT_THE_SHOP', 'RETURNING', 'DELIVERED', 'CANCELLED') NOT NULL DEFAULT 'ASSIGNED';

-- AlterTable
ALTER TABLE `notification` MODIFY `type` ENUM('STATUS_CHANGE', 'BUDGET_REQUEST', 'READY_FOR_PICKUP', 'DELIVERY_UPDATE', 'PAYMENT_CONFIRMED', 'ORDER_CREATED', 'GENERAL') NOT NULL,
    MODIFY `channel` ENUM('EMAIL', 'PUSH', 'SMS') NOT NULL,
    MODIFY `orderId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `order` MODIFY `status` ENUM('RECEIVED', 'DIAGNOSING', 'WAITING_APPROVAL', 'APPROVED', 'REPAIRING', 'WAITING_PART', 'READY', 'DELIVERED', 'CANCELLED') NOT NULL DEFAULT 'RECEIVED';

-- AlterTable
ALTER TABLE `orderstatushistory` MODIFY `status` ENUM('RECEIVED', 'DIAGNOSING', 'WAITING_APPROVAL', 'APPROVED', 'REPAIRING', 'WAITING_PART', 'READY', 'DELIVERED', 'CANCELLED') NOT NULL;

-- AlterTable
ALTER TABLE `servicedocument` ADD COLUMN `clientSignature` TEXT NULL,
    ADD COLUMN `gpsLatitude` DECIMAL(10, 7) NULL,
    ADD COLUMN `gpsLongitude` DECIMAL(10, 7) NULL,
    MODIFY `type` ENUM('RECEIPT_NOTE', 'DELIVERY_NOTE', 'WITHDRAWAL_ACT', 'ON_SITE_RECEIPT') NOT NULL;

-- AlterTable
ALTER TABLE `servicerequest` ADD COLUMN `model` VARCHAR(191) NULL,
    ADD COLUMN `symptoms` TEXT NULL,
    MODIFY `status` ENUM('PENDING', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED_ON_SITE', 'TAKEN_TO_SHOP', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    MODIFY `paymentMethod` ENUM('CASH', 'TRANSFER', 'POINT_OF_SALE', 'MOBILE_PAYMENT', 'MIXED') NOT NULL;

-- AlterTable
ALTER TABLE `user` ADD COLUMN `activeOrderCount` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `maxOrderCapacity` INTEGER NOT NULL DEFAULT 5,
    ADD COLUMN `technicianStatus` ENUM('AVAILABLE', 'BUSY', 'SATURATED', 'ABSENT') NOT NULL DEFAULT 'AVAILABLE',
    MODIFY `role` ENUM('ADMIN', 'CASHIER', 'TECHNICIAN', 'TECHNICIAN_DELIVERY', 'DELIVERY', 'CLIENT', 'MANAGER', 'SELLER') NOT NULL DEFAULT 'CLIENT';

-- CreateTable
CREATE TABLE `ServicePayment` (
    `id` VARCHAR(191) NOT NULL,
    `amount` DECIMAL(10, 2) NOT NULL,
    `amountBs` DECIMAL(12, 2) NULL,
    `exchangeRate` DECIMAL(10, 4) NULL,
    `method` ENUM('CASH', 'TRANSFER', 'POINT_OF_SALE', 'MOBILE_PAYMENT', 'MIXED') NOT NULL,
    `status` ENUM('PENDING', 'PAID', 'REFUNDED') NOT NULL DEFAULT 'PENDING',
    `reference` VARCHAR(191) NULL,
    `description` VARCHAR(191) NULL,
    `paidAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `orderId` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Invoice` (
    `id` VARCHAR(191) NOT NULL,
    `invoiceNumber` VARCHAR(191) NOT NULL,
    `controlNumber` VARCHAR(191) NULL,
    `series` VARCHAR(191) NULL DEFAULT 'A',
    `type` ENUM('SERVICE', 'STORE_PURCHASE', 'DELIVERY_SERVICE') NOT NULL,
    `subtotal` DECIMAL(10, 2) NOT NULL,
    `igtfBase` DECIMAL(10, 2) NULL,
    `igtfAmount` DECIMAL(10, 2) NULL,
    `total` DECIMAL(10, 2) NOT NULL,
    `totalBs` DECIMAL(12, 2) NULL,
    `exchangeRate` DECIMAL(10, 4) NULL,
    `pdfUrl` VARCHAR(191) NULL,
    `sentByEmail` BOOLEAN NOT NULL DEFAULT false,
    `sentAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `orderId` VARCHAR(191) NULL,
    `servicePaymentId` VARCHAR(191) NULL,
    `productOrderId` VARCHAR(191) NULL,
    `clientId` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `Invoice_invoiceNumber_key`(`invoiceNumber`),
    UNIQUE INDEX `Invoice_servicePaymentId_key`(`servicePaymentId`),
    UNIQUE INDEX `Invoice_productOrderId_key`(`productOrderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `servicecatalog` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `basePrice` DECIMAL(10, 2) NOT NULL,
    `isOnSiteResolvable` BOOLEAN NOT NULL DEFAULT false,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `estimatedMinutes` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `productcategory` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `productcategory_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `product` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `price` DECIMAL(10, 2) NOT NULL,
    `stock` INTEGER NOT NULL DEFAULT 0,
    `minStock` INTEGER NOT NULL DEFAULT 3,
    `imageUrl` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `categoryId` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `productorder` (
    `id` VARCHAR(191) NOT NULL,
    `status` ENUM('PENDING', 'CONFIRMED', 'READY_FOR_PICKUP', 'ASSIGNED_DELIVERY', 'ON_THE_WAY', 'DELIVERED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `deliveryMethod` ENUM('PICKUP_AT_STORE', 'HOME_DELIVERY') NOT NULL,
    `address` VARCHAR(191) NULL,
    `deliveryCost` DECIMAL(10, 2) NULL,
    `total` DECIMAL(10, 2) NOT NULL,
    `paymentMethod` ENUM('CASH', 'TRANSFER', 'POINT_OF_SALE', 'MOBILE_PAYMENT', 'MIXED') NOT NULL,
    `paidAt` DATETIME(3) NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `clientId` VARCHAR(191) NOT NULL,
    `linkedOrderId` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `productorderitem` (
    `id` VARCHAR(191) NOT NULL,
    `quantity` INTEGER NOT NULL,
    `unitPrice` DECIMAL(10, 2) NOT NULL,
    `subtotal` DECIMAL(10, 2) NOT NULL,
    `productId` VARCHAR(191) NOT NULL,
    `productOrderId` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `productdelivery` (
    `id` VARCHAR(191) NOT NULL,
    `status` ENUM('ASSIGNED', 'LEAVING_STORE', 'ON_THE_WAY', 'AT_LOCATION', 'DIAGNOSING_ON_SITE', 'EQUIPMENT_PICKED_UP', 'AT_THE_SHOP', 'RETURNING', 'DELIVERED', 'CANCELLED') NOT NULL DEFAULT 'ASSIGNED',
    `gpsLatitude` DECIMAL(10, 7) NULL,
    `gpsLongitude` DECIMAL(10, 7) NULL,
    `photoUrl` VARCHAR(191) NULL,
    `deliveredAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `productOrderId` VARCHAR(191) NOT NULL,
    `agentId` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `productdelivery_productOrderId_key`(`productOrderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ServicePayment` ADD CONSTRAINT `ServicePayment_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Invoice` ADD CONSTRAINT `Invoice_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Invoice` ADD CONSTRAINT `Invoice_servicePaymentId_fkey` FOREIGN KEY (`servicePaymentId`) REFERENCES `ServicePayment`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Invoice` ADD CONSTRAINT `Invoice_productOrderId_fkey` FOREIGN KEY (`productOrderId`) REFERENCES `productorder`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Invoice` ADD CONSTRAINT `Invoice_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `Client`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product` ADD CONSTRAINT `product_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `productcategory`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `productorder` ADD CONSTRAINT `productorder_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `Client`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `productorderitem` ADD CONSTRAINT `productorderitem_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `productorderitem` ADD CONSTRAINT `productorderitem_productOrderId_fkey` FOREIGN KEY (`productOrderId`) REFERENCES `productorder`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `productdelivery` ADD CONSTRAINT `productdelivery_productOrderId_fkey` FOREIGN KEY (`productOrderId`) REFERENCES `productorder`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `productdelivery` ADD CONSTRAINT `productdelivery_agentId_fkey` FOREIGN KEY (`agentId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notification` ADD CONSTRAINT `notification_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notification` ADD CONSTRAINT `notification_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
